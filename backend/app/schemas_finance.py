from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel

from app.models_finance import (
    CustomerInvoiceStatus,
    SubcontractorContractStatus,
    SubcontractorInvoiceStatus,
    TigStatus,
    VatType,
)


# --- Partner -----------------------------------------------------------


class PartnerCreate(BaseModel):
    name: str
    tax_number: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    billing_address: Optional[str] = None
    mailing_address: Optional[str] = None
    company_registry_number: Optional[str] = None
    bank_account_number: Optional[str] = None
    representative_name: Optional[str] = None
    representative_title: Optional[str] = None
    contact_name: Optional[str] = None


class PartnerUpdate(BaseModel):
    name: Optional[str] = None
    tax_number: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    billing_address: Optional[str] = None
    mailing_address: Optional[str] = None
    company_registry_number: Optional[str] = None
    bank_account_number: Optional[str] = None
    representative_name: Optional[str] = None
    representative_title: Optional[str] = None
    contact_name: Optional[str] = None


class PartnerResponse(BaseModel):
    id: int
    name: str
    tax_number: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    billing_address: Optional[str] = None
    mailing_address: Optional[str] = None
    company_registry_number: Optional[str] = None
    bank_account_number: Optional[str] = None
    representative_name: Optional[str] = None
    representative_title: Optional[str] = None
    contact_name: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# --- OwnCompany (Megrendelő/fővállalkozó saját cégadatok) ----------------


class OwnCompanyCreate(BaseModel):
    name: str
    registered_address: Optional[str] = None
    mailing_address: Optional[str] = None
    tax_number: Optional[str] = None
    company_registry_number: Optional[str] = None
    bank_account_number: Optional[str] = None
    representative_name: Optional[str] = None
    representative_title: Optional[str] = None
    contact_name: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None


class OwnCompanyUpdate(BaseModel):
    name: Optional[str] = None
    registered_address: Optional[str] = None
    mailing_address: Optional[str] = None
    tax_number: Optional[str] = None
    company_registry_number: Optional[str] = None
    bank_account_number: Optional[str] = None
    representative_name: Optional[str] = None
    representative_title: Optional[str] = None
    contact_name: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    is_active: Optional[bool] = None


class OwnCompanyResponse(BaseModel):
    id: int
    name: str
    registered_address: Optional[str] = None
    mailing_address: Optional[str] = None
    tax_number: Optional[str] = None
    company_registry_number: Optional[str] = None
    bank_account_number: Optional[str] = None
    representative_name: Optional[str] = None
    representative_title: Optional[str] = None
    contact_name: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# --- TIG -----------------------------------------------------------------


class TigCreate(BaseModel):
    partner_id: int
    subcontractor_contract_id: Optional[int] = None
    date: date
    period_start: date
    period_end: date
    net_value: Decimal
    vat_type: VatType
    note: Optional[str] = None


class TigUpdate(BaseModel):
    partner_id: Optional[int] = None
    subcontractor_contract_id: Optional[int] = None
    date: Optional[date] = None
    period_start: Optional[date] = None
    period_end: Optional[date] = None
    net_value: Optional[Decimal] = None
    vat_type: Optional[VatType] = None
    note: Optional[str] = None


class TigStatusUpdate(BaseModel):
    status: TigStatus


class TigResponse(BaseModel):
    id: int
    project_id: int
    partner_id: int
    subcontractor_contract_id: Optional[int] = None
    date: date
    period_start: date
    period_end: date
    net_value: Decimal
    vat_type: VatType
    gross_value: Decimal
    status: TigStatus
    note: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    # Computed at query time by the router — sum of linked
    # SubcontractorInvoice.net_value / their count, not DB columns.
    consumed_amount: Decimal = Decimal("0")
    invoice_count: int = 0
    # Only populated by the cross-project /finance/all/tigs list — left None
    # on the per-project endpoints where the caller already knows the project.
    project_name: Optional[str] = None
    project_code: Optional[str] = None

    model_config = {"from_attributes": True}


# --- SubcontractorInvoice --------------------------------------------------


class SubcontractorInvoiceCreate(BaseModel):
    partner_id: int
    tig_id: Optional[int] = None
    invoice_number: str
    performance_date: date
    issue_date: date
    due_date: date
    payment_date: Optional[date] = None
    net_value: Decimal
    vat_type: VatType
    paid_amount: Optional[Decimal] = None


class SubcontractorInvoiceUpdate(BaseModel):
    partner_id: Optional[int] = None
    tig_id: Optional[int] = None
    invoice_number: Optional[str] = None
    performance_date: Optional[date] = None
    issue_date: Optional[date] = None
    due_date: Optional[date] = None
    payment_date: Optional[date] = None
    net_value: Optional[Decimal] = None
    vat_type: Optional[VatType] = None
    paid_amount: Optional[Decimal] = None


class SubcontractorInvoiceStatusUpdate(BaseModel):
    status: SubcontractorInvoiceStatus
    paid_amount: Optional[Decimal] = None


class SubcontractorInvoiceResponse(BaseModel):
    id: int
    project_id: int
    partner_id: int
    tig_id: Optional[int] = None
    invoice_number: str
    performance_date: date
    issue_date: date
    due_date: date
    payment_date: Optional[date] = None
    net_value: Decimal
    vat_type: VatType
    gross_value: Decimal
    paid_amount: Optional[Decimal] = None
    status: SubcontractorInvoiceStatus
    created_at: datetime
    updated_at: datetime
    # Only populated by the cross-project /finance/all/subcontractor-invoices list.
    project_name: Optional[str] = None
    project_code: Optional[str] = None

    model_config = {"from_attributes": True}


# --- CustomerInvoice --------------------------------------------------------


class CustomerInvoiceCreate(BaseModel):
    issue_date: date
    performance_date: date
    due_date: date
    payment_received_date: Optional[date] = None
    net_value: Decimal
    vat_type: VatType
    paid_amount: Optional[Decimal] = None


class CustomerInvoiceUpdate(BaseModel):
    issue_date: Optional[date] = None
    performance_date: Optional[date] = None
    due_date: Optional[date] = None
    payment_received_date: Optional[date] = None
    net_value: Optional[Decimal] = None
    vat_type: Optional[VatType] = None
    paid_amount: Optional[Decimal] = None


class CustomerInvoiceStatusUpdate(BaseModel):
    status: CustomerInvoiceStatus
    paid_amount: Optional[Decimal] = None


class CustomerInvoiceResponse(BaseModel):
    id: int
    project_id: int
    invoice_number: str
    issue_date: date
    performance_date: date
    due_date: date
    payment_received_date: Optional[date] = None
    net_value: Decimal
    vat_type: VatType
    gross_value: Decimal
    paid_amount: Optional[Decimal] = None
    status: CustomerInvoiceStatus
    created_at: datetime
    updated_at: datetime
    # Resolved by the router from project.customer.name — CustomerInvoice
    # has no customer_id column of its own (reuses Project.customer_id).
    customer_name: Optional[str] = None
    # Only populated by the cross-project /finance/all/customer-invoices list.
    project_name: Optional[str] = None
    project_code: Optional[str] = None

    model_config = {"from_attributes": True}


# --- SubcontractorContract --------------------------------------------------


class SubcontractorContractCreate(BaseModel):
    partner_id: int
    own_company_id: Optional[int] = None
    contract_type: Optional[str] = None
    scope_of_work: Optional[str] = None
    value: Optional[Decimal] = None
    vat_type: Optional[VatType] = None
    currency: str = "HUF"
    payment_terms_days: Optional[int] = None
    payment_method: Optional[str] = None
    start_date: date
    end_date: date
    effective_date: Optional[date] = None


class SubcontractorContractUpdate(BaseModel):
    partner_id: Optional[int] = None
    own_company_id: Optional[int] = None
    contract_type: Optional[str] = None
    scope_of_work: Optional[str] = None
    value: Optional[Decimal] = None
    vat_type: Optional[VatType] = None
    currency: Optional[str] = None
    payment_terms_days: Optional[int] = None
    payment_method: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    effective_date: Optional[date] = None


class SubcontractorContractStatusUpdate(BaseModel):
    status: SubcontractorContractStatus


class SubcontractorContractResponse(BaseModel):
    id: int
    project_id: int
    partner_id: int
    own_company_id: Optional[int] = None
    contract_number: str
    contract_type: Optional[str] = None
    scope_of_work: Optional[str] = None
    value: Optional[Decimal] = None
    vat_type: Optional[VatType] = None
    currency: str = "HUF"
    payment_terms_days: Optional[int] = None
    payment_method: Optional[str] = None
    start_date: date
    end_date: date
    effective_date: Optional[date] = None
    status: SubcontractorContractStatus
    signed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    # Only populated by cross-project listing endpoints, if added later —
    # left None on the per-project endpoint (mirrors TigResponse/CustomerInvoiceResponse).
    project_name: Optional[str] = None
    project_code: Optional[str] = None

    model_config = {"from_attributes": True}


# --- Project finance summary / cash flow ------------------------------------


class ProjectFinanceUpdate(BaseModel):
    contract_net_value: Optional[Decimal] = None
    contract_vat_type: Optional[VatType] = None


class ProjectFinanceResponse(BaseModel):
    contract_net_value: Optional[Decimal] = None
    contract_vat_type: Optional[VatType] = None
    contract_gross_value: Optional[Decimal] = None

    model_config = {"from_attributes": True}


class CashFlowSummary(BaseModel):
    contract_net: Optional[Decimal] = None
    contract_gross: Optional[Decimal] = None
    invoiced_net: Decimal
    invoiced_gross: Decimal
    received_gross: Decimal
    outstanding_receivable: Decimal
    tig_total_net: Decimal
    subcontractor_invoiced_gross: Decimal
    subcontractor_paid_gross: Decimal
    payable_obligations: Decimal
    expected_margin: Optional[Decimal] = None
    actual_margin: Decimal
    cash_flow_balance: Decimal
    has_overdue_customer_invoice: bool
    has_overdue_subcontractor_invoice: bool
    overdue_receivable: Decimal
    overdue_payable: Decimal

    model_config = {"from_attributes": True}


class ProjectFinanceOverviewRow(BaseModel):
    """One row per project — spec §11 "Pénzügyi áttekintő" columns."""

    project_id: int
    project_name: str
    project_code: str
    project_manager_name: Optional[str] = None
    customer_name: Optional[str] = None
    contract_gross: Optional[Decimal] = None
    invoiced_gross: Decimal
    received_gross: Decimal
    subcontractor_invoiced_gross: Decimal
    subcontractor_paid_gross: Decimal
    cash_flow_balance: Decimal
    overdue_receivable: Decimal
    overdue_payable: Decimal
    finance_status: str


class FinanceStatus(BaseModel):
    status: str  # "green" | "yellow" | "red"
    reasons: list[str] = []
