from sqlalchemy import case, or_
from sqlalchemy.orm import Session

from app.models import BuildingType, Project
from app.models_documents import DocumentFamily, DocumentTemplate, TigDocumentSubtype
from app.services.health import HEALTH_OK, predict_delay_risk


class NoActiveTemplateError(Exception):
    """Raised when no DocumentTemplate matches (automatic selection), or the
    manually-chosen one is inactive — surfaced by the API router as a 422
    with a Hungarian message the caller can show as-is.
    """


class TemplateNotFoundError(Exception):
    """Raised when an explicit override_template_id doesn't exist or belongs
    to a different family — surfaced by the API router as a 404.
    """


def select_template(
    db: Session,
    family: DocumentFamily,
    doc_subtype: TigDocumentSubtype,
    building_type: BuildingType | None,
    project: Project | None,
    *,
    currency: str | None = None,
    is_electronic: bool = False,
    override_template_id: int | None = None,
) -> DocumentTemplate:
    """Implements spec §3's priority logic: exact building-type match first,
    then the building-type-agnostic catch-all (building_type=NULL), and for
    family=TIG/doc_subtype=NORMAL a delay-variant is preferred over both when
    the project's live-computed delay risk is active (see
    services/health.py::predict_delay_risk — there's no persisted
    Project.has_delay column, this is evaluated fresh every time).

    `currency` follows the same exact-match-first-then-catch-all rule as
    building_type, independently (a template can be building_type-specific,
    currency-specific, both, or neither) — only meaningful for
    CLIENT_CONTRACT/SUBCONTRACTOR_CONTRACT, callers pass None otherwise.
    `is_electronic` is a hard filter, not a priority tiebreaker: the caller
    explicitly asks for the electronic or paper wording, so only templates
    matching exactly are considered.

    `override_template_id`, when given, bypasses all of the above and picks
    that exact template — this is the one place a caller should reach for a
    manual template choice (api/document_generator.py::generate_document),
    so the family/is_active checks live here once instead of being
    re-implemented at every call site.
    """
    if override_template_id is not None:
        template = db.query(DocumentTemplate).get(override_template_id)
        if not template or template.family != family:
            raise TemplateNotFoundError("A megadott sablon nem található")
        if not template.is_active:
            raise NoActiveTemplateError("A megadott sablon nem aktív")
        return template

    prefer_delay_variant = False
    if family == DocumentFamily.TIG and doc_subtype == TigDocumentSubtype.NORMAL and project is not None:
        risk, _ = predict_delay_risk(db, project)
        prefer_delay_variant = risk != HEALTH_OK

    # Single query instead of up to 4 sequential ones: filter to the
    # exact-building-type-or-catch-all (and exact-currency-or-catch-all)
    # rows, hard-filter on is_electronic, then ORDER BY a priority CASE that
    # mirrors the old fallback chain (delay-variant beats non-delay-variant
    # first, then more exact dimension matches beat fewer), then by version
    # so a re-upload always wins over an older active version.
    q = db.query(DocumentTemplate).filter(
        DocumentTemplate.family == family,
        DocumentTemplate.doc_subtype == doc_subtype,
        DocumentTemplate.is_active.is_(True),
        DocumentTemplate.is_electronic.is_(is_electronic),
    )
    if building_type is not None:
        q = q.filter(or_(DocumentTemplate.building_type == building_type, DocumentTemplate.building_type.is_(None)))
    else:
        q = q.filter(DocumentTemplate.building_type.is_(None))
    if currency is not None:
        q = q.filter(or_(DocumentTemplate.currency == currency, DocumentTemplate.currency.is_(None)))
    else:
        q = q.filter(DocumentTemplate.currency.is_(None))

    specificity = case((DocumentTemplate.building_type.is_not(None), 1), else_=0) + case(
        (DocumentTemplate.currency.is_not(None), 1), else_=0
    )
    if prefer_delay_variant:
        priority = case((DocumentTemplate.is_delay_variant.is_(True), 0), else_=1) * 10 - specificity
    else:
        q = q.filter(DocumentTemplate.is_delay_variant.is_(False))
        priority = -specificity

    template = q.order_by(priority, DocumentTemplate.version.desc()).first()
    if not template:
        raise NoActiveTemplateError("Nincs aktív sablon ehhez a kombinációhoz")
    return template
