"""CRM module models — Customer/Quote/Contract and support entities.

See docs/CRM_modul_fejlesztesi_terv.md for the full spec these implement.
Kept in a separate file from app/models.py purely for size — same Base/
metadata/registry, so relationships resolve across the two files as long as
both modules are imported before mappers configure (main.py and
migrations/env.py both import this module explicitly).
"""

import enum
from datetime import date, datetime

from sqlalchemy import (
    JSON,
    Boolean,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class CustomerType(str, enum.Enum):
    PERSON = "person"
    COMPANY = "company"
    SOLE_PROPRIETOR = "sole_proprietor"


class RelationshipType(str, enum.Enum):
    CUSTOMER = "customer"
    SUPPLIER = "supplier"
    BOTH = "both"


class CustomerStatus(str, enum.Enum):
    """The customer's own status IS the sales pipeline (no separate
    Lead/Opportunity entity — user's explicit simplification, 2026-07-31:
    "nem kell külön kiszervezni, hanem az ügyfél kártyán kell integrálni").
    Reaching ORDERED for the first time auto-creates the construction
    project (services/crm_project_bridge.py::ensure_project_for_customer,
    called from crm_customers.py::update_customer).
    """

    NEW = "new"  # Új
    INQUIRING = "inquiring"  # Érdeklődő
    QUOTE_SENT = "quote_sent"  # Ajánlatadás
    ORDERED = "ordered"  # Megrendelő — triggers project creation
    ARCHIVED = "archived"  # Archivált — soft-delete-instead-of-delete target


class QuoteStatus(str, enum.Enum):
    DRAFT = "draft"
    APPROVAL_PENDING = "approval_pending"
    SENT = "sent"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    EXPIRED = "expired"


class ContractStatus(str, enum.Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    EXPIRED = "expired"
    TERMINATED = "terminated"
    ARCHIVED = "archived"


class CommunicationType(str, enum.Enum):
    PHONE = "phone"
    EMAIL = "email"
    SMS = "sms"
    IN_PERSON = "in_person"
    ONLINE_MEETING = "online_meeting"
    OTHER = "other"


class CrmTaskStatus(str, enum.Enum):
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    WAITING = "waiting"
    DONE = "done"


class CrmTaskPriority(str, enum.Enum):
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    CRITICAL = "critical"


class CrmDocumentType(str, enum.Enum):
    QUOTE = "quote"
    CONTRACT = "contract"
    MINUTES = "minutes"
    PDF = "pdf"
    IMAGE = "image"
    OTHER = "other"


CUSTOMER_TYPE_LABELS = {
    CustomerType.PERSON: "Magánszemély",
    CustomerType.COMPANY: "Cég",
    CustomerType.SOLE_PROPRIETOR: "Egyéni vállalkozó",
}

CUSTOMER_STATUS_LABELS = {
    CustomerStatus.NEW: "Új",
    CustomerStatus.INQUIRING: "Érdeklődő",
    CustomerStatus.QUOTE_SENT: "Ajánlatadás",
    CustomerStatus.ORDERED: "Megrendelő",
    CustomerStatus.ARCHIVED: "Archivált",
}


class Customer(Base):
    __tablename__ = "customers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    customer_number: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    type: Mapped[CustomerType] = mapped_column(Enum(CustomerType))
    relationship_type: Mapped[RelationshipType] = mapped_column(
        Enum(RelationshipType), default=RelationshipType.CUSTOMER
    )
    name: Mapped[str] = mapped_column(String(255), index=True)
    status: Mapped[CustomerStatus] = mapped_column(
        Enum(CustomerStatus), default=CustomerStatus.NEW
    )
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)

    # Only ever populated for type in (COMPANY, SOLE_PROPRIETOR) — enforced at
    # the API layer, not the DB layer (see 4.1 in the dev plan): a PERSON
    # customer's row must keep these NULL, no other personal data stored.
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    tax_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    billing_address: Mapped[str | None] = mapped_column(String(500), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    owner: Mapped["User"] = relationship(foreign_keys=[owner_id])
    quotes: Mapped[list["Quote"]] = relationship(back_populates="customer")
    contracts: Mapped[list["Contract"]] = relationship(back_populates="customer")
    communication_events: Mapped[list["CommunicationEvent"]] = relationship(
        back_populates="customer"
    )
    crm_tasks: Mapped[list["CrmTask"]] = relationship(back_populates="customer")


class CustomerRelation(Base):
    """Company <-> person links — fills the gap left by the BRS's missing
    6.2 "Kapcsolatkezelés" section (see docs/CRM_modul_fejlesztesi_terv.md 2.3).
    """

    __tablename__ = "customer_relations"
    __table_args__ = (
        UniqueConstraint(
            "company_customer_id", "person_customer_id", name="uq_customer_relation"
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    company_customer_id: Mapped[int] = mapped_column(
        ForeignKey("customers.id", ondelete="CASCADE"), index=True
    )
    person_customer_id: Mapped[int] = mapped_column(
        ForeignKey("customers.id", ondelete="CASCADE"), index=True
    )
    role_label: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False)

    company: Mapped["Customer"] = relationship(foreign_keys=[company_customer_id])
    person: Mapped["Customer"] = relationship(foreign_keys=[person_customer_id])


class Quote(Base):
    __tablename__ = "quotes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id"), index=True)
    quote_number: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    date: Mapped[date] = mapped_column(Date)
    status: Mapped[QuoteStatus] = mapped_column(Enum(QuoteStatus), default=QuoteStatus.DRAFT)
    current_version: Mapped[int] = mapped_column(Integer, default=1)

    customer: Mapped["Customer"] = relationship(back_populates="quotes")
    versions: Mapped[list["QuoteVersion"]] = relationship(
        back_populates="quote", cascade="all, delete-orphan", order_by="QuoteVersion.version"
    )


class QuoteVersion(Base):
    __tablename__ = "quote_versions"
    __table_args__ = (UniqueConstraint("quote_id", "version", name="uq_quote_version"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    quote_id: Mapped[int] = mapped_column(
        ForeignKey("quotes.id", ondelete="CASCADE"), index=True
    )
    version: Mapped[int] = mapped_column(Integer)
    # Structured line items/terms, rendered natively by the frontend — no
    # backend PDF generation (dev plan 0/4, 2.6).
    content_json: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    created_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"))

    quote: Mapped["Quote"] = relationship(back_populates="versions")
    created_by: Mapped["User"] = relationship(foreign_keys=[created_by_id])


class Contract(Base):
    __tablename__ = "contracts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id"), index=True)
    quote_id: Mapped[int | None] = mapped_column(
        ForeignKey("quotes.id", ondelete="SET NULL"), nullable=True
    )
    contract_number: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    start_date: Mapped[date] = mapped_column(Date)
    end_date: Mapped[date] = mapped_column(Date)
    status: Mapped[ContractStatus] = mapped_column(
        Enum(ContractStatus), default=ContractStatus.DRAFT
    )

    customer: Mapped["Customer"] = relationship(back_populates="contracts")
    quote: Mapped["Quote | None"] = relationship(foreign_keys=[quote_id])


class CommunicationEvent(Base):
    __tablename__ = "communication_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id"), index=True)
    type: Mapped[CommunicationType] = mapped_column(Enum(CommunicationType))
    date: Mapped[date] = mapped_column(Date)
    agent_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    summary: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    customer: Mapped["Customer"] = relationship(back_populates="communication_events")
    agent: Mapped["User"] = relationship(foreign_keys=[agent_id])


class CrmTask(Base):
    """CRM-side task — deliberately NOT named `Task`: the existing codebase
    already uses "task"/`Activity` for construction-schedule items
    (`/api/tasks` prep-center/my-tasks). Keeping the name distinct avoids
    confusing the two entirely different concepts.
    """

    __tablename__ = "crm_tasks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id"), index=True)
    due_date: Mapped[date] = mapped_column(Date)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    status: Mapped[CrmTaskStatus] = mapped_column(
        Enum(CrmTaskStatus), default=CrmTaskStatus.OPEN
    )
    priority: Mapped[CrmTaskPriority] = mapped_column(
        Enum(CrmTaskPriority), default=CrmTaskPriority.NORMAL
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    customer: Mapped["Customer"] = relationship(back_populates="crm_tasks")
    owner: Mapped["User"] = relationship(foreign_keys=[owner_id])


class CrmDocument(Base):
    """Parallel to `Document` (app/models.py), not an extension of it — a CRM
    document can link to several business records (BRS 6.9), while `Document`
    is hard-bound to a single project_id. See dev plan 2.10.
    """

    __tablename__ = "crm_documents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    filename: Mapped[str] = mapped_column(String(500))
    original_filename: Mapped[str] = mapped_column(String(500))
    content_type: Mapped[str] = mapped_column(String(100))
    file_size: Mapped[int] = mapped_column(Integer)
    s3_key: Mapped[str] = mapped_column(String(1000))
    document_type: Mapped[CrmDocumentType] = mapped_column(
        Enum(CrmDocumentType), default=CrmDocumentType.OTHER
    )
    version: Mapped[int] = mapped_column(Integer, default=1)
    uploaded_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    uploaded_by: Mapped["User"] = relationship(foreign_keys=[uploaded_by_id])
    links: Mapped[list["CrmDocumentLink"]] = relationship(
        back_populates="document", cascade="all, delete-orphan"
    )


class CrmDocumentLink(Base):
    __tablename__ = "crm_document_links"
    __table_args__ = (
        UniqueConstraint("document_id", "entity_type", "entity_id", name="uq_crm_doc_link"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    document_id: Mapped[int] = mapped_column(
        ForeignKey("crm_documents.id", ondelete="CASCADE"), index=True
    )
    entity_type: Mapped[str] = mapped_column(String(50), index=True)
    entity_id: Mapped[int] = mapped_column(Integer, index=True)

    document: Mapped["CrmDocument"] = relationship(back_populates="links")
