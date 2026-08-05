"""Financial module models — Partner/TIG/SubcontractorInvoice/CustomerInvoice.

Project-based cash-flow tracker, not a bookkeeping system. Kept in a
separate file from app/models.py purely for size, same pattern as
models_crm.py — same Base/metadata/registry, so relationships resolve
across files as long as both modules are imported before mappers configure
(main.py and migrations/env.py both import this module explicitly).
"""

import enum
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class VatType(str, enum.Enum):
    STANDARD_27 = "standard_27"  # 27% ÁFA
    REDUCED_5 = "reduced_5"  # 5% ÁFA
    REVERSE_CHARGE = "reverse_charge"  # Fordított ÁFA


class TigStatus(str, enum.Enum):
    DRAFT = "draft"  # Tervezet
    PENDING_APPROVAL = "pending_approval"  # Jóváhagyás alatt
    APPROVED = "approved"  # Jóváhagyott
    INVOICED = "invoiced"  # Számlázott
    CLOSED = "closed"  # Lezárt


class SubcontractorInvoiceStatus(str, enum.Enum):
    RECEIVED = "received"  # Beérkezett
    APPROVED = "approved"  # Jóváhagyott
    AWAITING_PAYMENT = "awaiting_payment"  # Kifizetésre vár
    PAID = "paid"  # Kifizetett
    OVERDUE = "overdue"  # Lejárt


class CustomerInvoiceStatus(str, enum.Enum):
    ISSUED = "issued"  # Kiállított
    PARTIALLY_PAID = "partially_paid"  # Részben kiegyenlített
    PAID = "paid"  # Kiegyenlített
    OVERDUE = "overdue"  # Lejárt


VAT_TYPE_LABELS = {
    VatType.STANDARD_27: "27% ÁFA",
    VatType.REDUCED_5: "5% ÁFA",
    VatType.REVERSE_CHARGE: "Fordított ÁFA",
}

TIG_STATUS_LABELS = {
    TigStatus.DRAFT: "Tervezet",
    TigStatus.PENDING_APPROVAL: "Jóváhagyás alatt",
    TigStatus.APPROVED: "Jóváhagyott",
    TigStatus.INVOICED: "Számlázott",
    TigStatus.CLOSED: "Lezárt",
}

SUBCONTRACTOR_INVOICE_STATUS_LABELS = {
    SubcontractorInvoiceStatus.RECEIVED: "Beérkezett",
    SubcontractorInvoiceStatus.APPROVED: "Jóváhagyott",
    SubcontractorInvoiceStatus.AWAITING_PAYMENT: "Kifizetésre vár",
    SubcontractorInvoiceStatus.PAID: "Kifizetett",
    SubcontractorInvoiceStatus.OVERDUE: "Lejárt",
}

CUSTOMER_INVOICE_STATUS_LABELS = {
    CustomerInvoiceStatus.ISSUED: "Kiállított",
    CustomerInvoiceStatus.PARTIALLY_PAID: "Részben kiegyenlített",
    CustomerInvoiceStatus.PAID: "Kiegyenlített",
    CustomerInvoiceStatus.OVERDUE: "Lejárt",
}


class Partner(Base):
    """Subcontractor/vendor contact record — the cost-side counterpart to
    CRM's Customer (sales-side). Kept separate from Customer: subcontractors
    have no sales pipeline (status/source/owner), just billing contact info.
    """

    __tablename__ = "partners"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255), index=True)
    tax_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    billing_address: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    tigs: Mapped[list["Tig"]] = relationship(back_populates="partner")
    subcontractor_invoices: Mapped[list["SubcontractorInvoice"]] = relationship(
        back_populates="partner"
    )


class Tig(Base):
    """Teljesítésigazolás (completion certificate) — the basis a subcontractor
    invoices against. Belongs to exactly one Project; a TIG can have zero,
    one, or several SubcontractorInvoices linked to it (partial billing).
    """

    __tablename__ = "tigs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), index=True
    )
    partner_id: Mapped[int] = mapped_column(ForeignKey("partners.id"), index=True)
    date: Mapped[date] = mapped_column(Date)
    period_start: Mapped[date] = mapped_column(Date)
    period_end: Mapped[date] = mapped_column(Date)
    net_value: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    vat_type: Mapped[VatType] = mapped_column(Enum(VatType))
    gross_value: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    status: Mapped[TigStatus] = mapped_column(Enum(TigStatus), default=TigStatus.DRAFT)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    project: Mapped["Project"] = relationship(back_populates="tigs")
    partner: Mapped["Partner"] = relationship(back_populates="tigs")
    subcontractor_invoices: Mapped[list["SubcontractorInvoice"]] = relationship(
        back_populates="tig"
    )


class SubcontractorInvoice(Base):
    """Alvállalkozói számla. invoice_number is the vendor's own document
    number (not ours to generate), so uniqueness is scoped per partner —
    two unrelated subcontractors can both legitimately issue a "1/2026".
    """

    __tablename__ = "subcontractor_invoices"
    __table_args__ = (
        UniqueConstraint("partner_id", "invoice_number", name="uq_subcontractor_invoice_number"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), index=True
    )
    partner_id: Mapped[int] = mapped_column(ForeignKey("partners.id"), index=True)
    tig_id: Mapped[int | None] = mapped_column(
        ForeignKey("tigs.id", ondelete="SET NULL"), nullable=True, index=True
    )
    invoice_number: Mapped[str] = mapped_column(String(50))
    performance_date: Mapped[date] = mapped_column(Date)
    issue_date: Mapped[date] = mapped_column(Date)
    due_date: Mapped[date] = mapped_column(Date)
    payment_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    net_value: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    vat_type: Mapped[VatType] = mapped_column(Enum(VatType))
    gross_value: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    # Only meaningful once status reaches PARTIALLY_PAID-equivalent tracking —
    # not in the original spec's field list, added so a partial payment
    # actually contributes a real amount to the cash-flow sums.
    paid_amount: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    status: Mapped[SubcontractorInvoiceStatus] = mapped_column(
        Enum(SubcontractorInvoiceStatus), default=SubcontractorInvoiceStatus.RECEIVED
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    project: Mapped["Project"] = relationship(back_populates="subcontractor_invoices")
    partner: Mapped["Partner"] = relationship(back_populates="subcontractor_invoices")
    tig: Mapped["Tig | None"] = relationship(back_populates="subcontractor_invoices")


class CustomerInvoice(Base):
    """Ügyfél számla. Deliberately has no customer_id column — the
    "Megrendelő" is Project.customer_id, resolved at read time; we are the
    issuer, so invoice_number is auto-generated (globally unique).
    """

    __tablename__ = "customer_invoices"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), index=True
    )
    invoice_number: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    issue_date: Mapped[date] = mapped_column(Date)
    performance_date: Mapped[date] = mapped_column(Date)
    due_date: Mapped[date] = mapped_column(Date)
    payment_received_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    net_value: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    vat_type: Mapped[VatType] = mapped_column(Enum(VatType))
    gross_value: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    paid_amount: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    status: Mapped[CustomerInvoiceStatus] = mapped_column(
        Enum(CustomerInvoiceStatus), default=CustomerInvoiceStatus.ISSUED
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    project: Mapped["Project"] = relationship(back_populates="customer_invoices")
