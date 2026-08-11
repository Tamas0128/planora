from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel

from app.models_crm import (
    CommunicationType,
    ContractStatus,
    CrmDocumentType,
    CrmTaskPriority,
    CrmTaskStatus,
    CustomerStatus,
    CustomerType,
    QuoteStatus,
    RelationshipType,
    SourceType,
)


class CustomerCreate(BaseModel):
    type: CustomerType
    relationship_type: RelationshipType = RelationshipType.CUSTOMER
    name: str
    owner_id: Optional[int] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    tax_number: Optional[str] = None
    billing_address: Optional[str] = None
    mailing_address: Optional[str] = None
    company_registry_number: Optional[str] = None
    bank_account_number: Optional[str] = None
    representative_name: Optional[str] = None
    representative_title: Optional[str] = None
    contact_name: Optional[str] = None
    source: Optional[SourceType] = None
    confirm_duplicate: bool = False


class ProjectCreationFields(BaseModel):
    """Only required when the customer doesn't have a project yet — reaching
    CustomerStatus.ORDERED ("Megrendelő") is the "deal is signed" moment that
    auto-creates the construction project (dev plan's original Lead->WON
    trigger, simplified by the user 2026-07-31 onto Customer.status directly
    instead of a separate Contract-activation step). Project has no
    CRM-derivable equivalent for these, they're construction-specific fields
    the BRS doesn't cover.
    """

    project_code: Optional[str] = None
    settlement: Optional[str] = None
    address: Optional[str] = None
    floor_area_sqm: Optional[float] = None
    delivery_date: Optional[date] = None
    lot_number: Optional[str] = None


class CustomerUpdate(ProjectCreationFields):
    type: Optional[CustomerType] = None
    relationship_type: Optional[RelationshipType] = None
    name: Optional[str] = None
    status: Optional[CustomerStatus] = None
    owner_id: Optional[int] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    tax_number: Optional[str] = None
    billing_address: Optional[str] = None
    mailing_address: Optional[str] = None
    company_registry_number: Optional[str] = None
    bank_account_number: Optional[str] = None
    representative_name: Optional[str] = None
    representative_title: Optional[str] = None
    contact_name: Optional[str] = None
    source: Optional[SourceType] = None


class CustomerResponse(BaseModel):
    id: int
    customer_number: str
    type: CustomerType
    relationship_type: RelationshipType
    name: str
    status: CustomerStatus
    owner_id: int
    phone: Optional[str] = None
    email: Optional[str] = None
    tax_number: Optional[str] = None
    billing_address: Optional[str] = None
    mailing_address: Optional[str] = None
    company_registry_number: Optional[str] = None
    bank_account_number: Optional[str] = None
    representative_name: Optional[str] = None
    representative_title: Optional[str] = None
    contact_name: Optional[str] = None
    source: Optional[SourceType] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class CustomerCreateResponse(CustomerResponse):
    duplicate_name_warning: bool = False


class CustomerRelationCreate(BaseModel):
    company_customer_id: int
    person_customer_id: int
    role_label: Optional[str] = None
    is_primary: bool = False


class CustomerRelationResponse(BaseModel):
    id: int
    company_customer_id: int
    person_customer_id: int
    role_label: Optional[str] = None
    is_primary: bool

    model_config = {"from_attributes": True}


class CustomerImportRowResult(BaseModel):
    row: int
    success: bool
    customer_number: Optional[str] = None
    name: Optional[str] = None
    error: Optional[str] = None


class CustomerImportResult(BaseModel):
    results: list[CustomerImportRowResult]


# --- Quote / Contract ------------------------------------------------------


class QuoteVersionCreate(BaseModel):
    content_json: dict


class QuoteVersionResponse(BaseModel):
    id: int
    version: int
    content_json: dict
    created_at: datetime
    created_by_id: int

    model_config = {"from_attributes": True}


class QuoteCreate(BaseModel):
    customer_id: int
    content_json: dict
    value: Optional[Decimal] = None


class QuoteUpdate(BaseModel):
    """Separate from QuoteStatusUpdate — lets `value` be set/backfilled
    without going through a status transition, mirroring ContractUpdate."""

    value: Optional[Decimal] = None


class QuoteStatusUpdate(BaseModel):
    status: QuoteStatus


class QuoteResponse(BaseModel):
    id: int
    customer_id: int
    quote_number: str
    date: date
    status: QuoteStatus
    current_version: int
    sent_at: Optional[datetime] = None
    value: Optional[Decimal] = None
    versions: list[QuoteVersionResponse] = []

    model_config = {"from_attributes": True}


class ContractCreate(BaseModel):
    customer_id: int
    quote_id: Optional[int] = None
    own_company_id: Optional[int] = None
    contract_type: Optional[str] = None
    start_date: date
    end_date: date
    effective_date: Optional[date] = None
    value: Optional[Decimal] = None
    net_value_standard: Optional[Decimal] = None
    net_value_reduced: Optional[Decimal] = None
    currency: str = "HUF"
    payment_due_date: Optional[date] = None
    payment_method: Optional[str] = None


class ContractFromQuoteBody(BaseModel):
    start_date: date
    end_date: date
    value: Optional[Decimal] = None


class ContractStatusUpdate(BaseModel):
    status: ContractStatus


class ContractUpdate(BaseModel):
    """Separate from ContractStatusUpdate — lets `value` (and other editable
    fields) be backfilled after creation, e.g. for contracts predating the
    sales-dashboard's value field (2026-08-04)."""

    own_company_id: Optional[int] = None
    contract_type: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    effective_date: Optional[date] = None
    value: Optional[Decimal] = None
    net_value_standard: Optional[Decimal] = None
    net_value_reduced: Optional[Decimal] = None
    currency: Optional[str] = None
    payment_due_date: Optional[date] = None
    payment_method: Optional[str] = None


class ContractResponse(BaseModel):
    id: int
    customer_id: int
    quote_id: Optional[int] = None
    own_company_id: Optional[int] = None
    contract_number: str
    contract_type: Optional[str] = None
    start_date: date
    end_date: date
    effective_date: Optional[date] = None
    status: ContractStatus
    value: Optional[Decimal] = None
    net_value_standard: Optional[Decimal] = None
    net_value_reduced: Optional[Decimal] = None
    currency: str = "HUF"
    payment_due_date: Optional[date] = None
    payment_method: Optional[str] = None
    signed_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# --- Communication / CrmTask / CrmDocument (Fázis 4) ----------------------


class CommunicationEventCreate(BaseModel):
    customer_id: int
    type: CommunicationType
    date: date
    agent_id: Optional[int] = None
    summary: str


class CommunicationEventResponse(BaseModel):
    id: int
    customer_id: int
    type: CommunicationType
    date: date
    agent_id: int
    summary: str
    created_at: datetime

    model_config = {"from_attributes": True}


class CrmTaskCreate(BaseModel):
    name: str
    customer_id: int
    due_date: date
    owner_id: Optional[int] = None
    priority: CrmTaskPriority = CrmTaskPriority.NORMAL


class CrmTaskUpdate(BaseModel):
    name: Optional[str] = None
    due_date: Optional[date] = None
    owner_id: Optional[int] = None
    status: Optional[CrmTaskStatus] = None
    priority: Optional[CrmTaskPriority] = None


class CrmTaskResponse(BaseModel):
    id: int
    name: str
    customer_id: int
    due_date: date
    owner_id: int
    status: CrmTaskStatus
    priority: CrmTaskPriority
    created_at: datetime

    model_config = {"from_attributes": True}


class CrmDashboardStats(BaseModel):
    total_customers: int
    active_customers: int
    new_customers_30d: int
    customers_by_type: dict[str, int]
    open_tasks: int
    active_contracts: int
    expiring_contracts_30d: int
    pending_quotes: int


# --- B2C sales dashboard (2026-08-04) --------------------------------------


class PipelineBucket(BaseModel):
    status: CustomerStatus
    count: int


class SalesDashboardWeekly(BaseModel):
    week_start: date
    week_end: date
    contracts_signed_count: int
    contracts_signed_value: Decimal
    active_customers: int
    new_inquiries: int
    quotes_sent: int
    site_visits: int
    pipeline: list[PipelineBucket]


class TrendPoint(BaseModel):
    year: int
    month: int
    contracted_value: Decimal


class SourceBreakdown(BaseModel):
    source: Optional[SourceType] = None  # None = "Ismeretlen" (unknown)
    count: int


class ConversionFunnel(BaseModel):
    leads: int
    negotiations: int
    contracts: int
    lead_to_negotiation_pct: float
    negotiation_to_contract_pct: float


class SalesDashboardMonthly(BaseModel):
    month: date  # first day of the month
    total_contracted_value: Decimal
    average_contract_value: Optional[Decimal] = None
    average_sales_cycle_days: Optional[float] = None
    trend: list[TrendPoint]
    source_breakdown: list[SourceBreakdown]
    funnel: ConversionFunnel


class ValidQuotesSummary(BaseModel):
    """Currently-open quotes (not yet REJECTED/EXPIRED) — a point-in-time
    snapshot, not week/month-scoped like the rest of this dashboard."""

    count: int
    total_value: Decimal


class CrmDocumentResponse(BaseModel):
    id: int
    original_filename: str
    content_type: str
    file_size: int
    document_type: CrmDocumentType
    version: int
    uploaded_by_id: int
    created_at: datetime

    model_config = {"from_attributes": True}
