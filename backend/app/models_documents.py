"""Dynamic document generator models — DocumentTemplate/GeneratedDocument.

Kept in a separate file from app/models.py purely for size, same pattern as
models_crm.py/models_finance.py — same Base/metadata/registry, so
relationships resolve across files as long as this module is imported
before mappers configure (main.py and migrations/env.py both import this
module explicitly).

Covers three document families sharing one schema rather than one table per
family: TIG (teljesítésigazolás, linked to models_finance.Tig), client
contract (linked to models_crm.Contract) and subcontractor contract (linked
to models_finance.SubcontractorContract). `source_id` is a generic reference
to whichever of those three the `family` says it is — same "entity_type +
entity_id" idea as models_crm.CrmDocumentLink, just inlined as one column
pair instead of a join table since a GeneratedDocument only ever points at
one source.
"""

import enum
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models import BuildingType


class DocumentFamily(str, enum.Enum):
    TIG = "tig"
    CLIENT_CONTRACT = "client_contract"
    SUBCONTRACTOR_CONTRACT = "subcontractor_contract"


class TigDocumentSubtype(str, enum.Enum):
    """Only meaningfully varies for DocumentFamily.TIG (Normál/Helyesbítő/
    Pótmunka per spec §2); the two contract families always use NORMAL for
    now — kept on the same enum so DocumentTemplate/GeneratedDocument don't
    need a family-specific subtype column each.
    """

    NORMAL = "normal"
    HELYESBITO = "helyesbito"
    POTMUNKA = "potmunka"
    TORLESI = "torlesi"
    UTOLAGOS = "utolagos"


class GeneratedDocumentStatus(str, enum.Enum):
    PENDING = "pending"
    READY = "ready"
    FAILED = "failed"


DOCUMENT_FAMILY_LABELS = {
    DocumentFamily.TIG: "Teljesítésigazolás",
    DocumentFamily.CLIENT_CONTRACT: "Ügyfél szerződés",
    DocumentFamily.SUBCONTRACTOR_CONTRACT: "Alvállalkozói szerződés",
}

TIG_DOCUMENT_SUBTYPE_LABELS = {
    TigDocumentSubtype.NORMAL: "Normál",
    TigDocumentSubtype.HELYESBITO: "Helyesbítő / módosítási",
    TigDocumentSubtype.POTMUNKA: "Pótmunka",
    TigDocumentSubtype.TORLESI: "Törlési",
    TigDocumentSubtype.UTOLAGOS: "Utólagos",
}


class DocumentTemplate(Base):
    __tablename__ = "document_templates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    family: Mapped[DocumentFamily] = mapped_column(Enum(DocumentFamily), index=True)
    doc_subtype: Mapped[TigDocumentSubtype] = mapped_column(
        Enum(TigDocumentSubtype), default=TigDocumentSubtype.NORMAL
    )
    # NULL = catch-all, matches any building type (select_template's fallback).
    building_type: Mapped[BuildingType | None] = mapped_column(Enum(BuildingType), nullable=True)
    # "HUF"/"EUR" — only meaningful for CLIENT_CONTRACT/SUBCONTRACTOR_CONTRACT
    # (matches Contract.currency/SubcontractorContract.currency). NULL =
    # catch-all, same fallback semantics as building_type.
    currency: Mapped[str | None] = mapped_column(String(3), nullable=True)
    # Paper vs. e-signature-ready wording — meaningful for
    # SUBCONTRACTOR_CONTRACT and TIG. Not derived from any stored data (no
    # "is this document electronic" flag on Contract/Tig); the caller
    # chooses it explicitly at generation time.
    is_electronic: Mapped[bool] = mapped_column(Boolean, default=False)
    # Only meaningful for family=TIG, doc_subtype=NORMAL: a template flagged
    # here is preferred over its non-delay counterpart when
    # services.health.predict_delay_risk reports active risk on the project
    # (spec §3's "delayed_{template}" variant, modeled as a flag rather than
    # a separate filename convention).
    is_delay_variant: Mapped[bool] = mapped_column(Boolean, default=False)
    name: Mapped[str] = mapped_column(String(255))
    s3_key: Mapped[str] = mapped_column(String(500))
    # Prep for a not-yet-built feature: a JSON-encoded list of field
    # definitions describing what to prompt the user for before generating
    # a document from this template (beyond the family's fixed context
    # built by services/document_generation.py). Not read by any code yet —
    # generate_document ignores it until the field spec is defined.
    input_schema: Mapped[str | None] = mapped_column(Text, nullable=True)
    version: Mapped[int] = mapped_column(Integer, default=1)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    uploaded_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    uploaded_by: Mapped["User"] = relationship(foreign_keys=[uploaded_by_id])


class GeneratedDocument(Base):
    __tablename__ = "generated_documents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    family: Mapped[DocumentFamily] = mapped_column(Enum(DocumentFamily), index=True)
    # Tig.id / Contract.id / SubcontractorContract.id depending on `family` —
    # not a real FK since it targets three different tables.
    source_id: Mapped[int] = mapped_column(Integer)
    # Always set for TIG/SUBCONTRACTOR_CONTRACT (direct FK on the source);
    # for CLIENT_CONTRACT resolved via Contract.customer -> Project.customer_id
    # at generation time, nullable because that link may not exist yet.
    project_id: Mapped[int | None] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), nullable=True, index=True
    )
    template_id: Mapped[int] = mapped_column(ForeignKey("document_templates.id"))
    doc_subtype: Mapped[TigDocumentSubtype] = mapped_column(Enum(TigDocumentSubtype))
    # Only ever populated for family=TIG, doc_subtype=NORMAL with an active
    # delay-risk template variant (services/document_templates.py).
    delay_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[GeneratedDocumentStatus] = mapped_column(
        Enum(GeneratedDocumentStatus), default=GeneratedDocumentStatus.PENDING
    )
    docx_s3_key: Mapped[str] = mapped_column(String(500))
    # NULL until the background LibreOffice conversion finishes (or stays
    # NULL forever if status ends up FAILED).
    pdf_s3_key: Mapped[str | None] = mapped_column(String(500), nullable=True)
    version: Mapped[int] = mapped_column(Integer, default=1)
    generated_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    project: Mapped["Project | None"] = relationship()
    template: Mapped["DocumentTemplate"] = relationship()
    generated_by: Mapped["User"] = relationship(foreign_keys=[generated_by_id])
