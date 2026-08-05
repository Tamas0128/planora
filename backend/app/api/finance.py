from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Project, User, UserRole
from app.models_finance import (
    CustomerInvoice,
    CustomerInvoiceStatus,
    Partner,
    SubcontractorInvoice,
    SubcontractorInvoiceStatus,
    Tig,
)
from app.schemas_finance import (
    CashFlowSummary,
    CustomerInvoiceCreate,
    CustomerInvoiceResponse,
    CustomerInvoiceStatusUpdate,
    CustomerInvoiceUpdate,
    PartnerCreate,
    PartnerResponse,
    PartnerUpdate,
    ProjectFinanceOverviewRow,
    ProjectFinanceResponse,
    ProjectFinanceUpdate,
    SubcontractorInvoiceCreate,
    SubcontractorInvoiceResponse,
    SubcontractorInvoiceStatusUpdate,
    SubcontractorInvoiceUpdate,
    TigCreate,
    TigResponse,
    TigStatusUpdate,
    TigUpdate,
)
from app.services.audit import log_change
from app.services.finance import (
    compute_cash_flow,
    compute_cash_flow_for_projects,
    compute_finance_status_for_projects,
    compute_gross,
)
from app.services.numbering import next_sequence_number
from app.services.scoping import can_view_project

router = APIRouter(prefix="/finance", tags=["finance"])

FINANCE_ROLES = (UserRole.ADMIN, UserRole.MANAGEMENT, UserRole.BILLING)


def _is_finance_role(user: User) -> bool:
    return user.role in FINANCE_ROLES


def _can_edit_tig(user: User, project: Project) -> bool:
    """TIG create/edit/note is opened up to the project's own
    PROJECT_MANAGER as well, per the spec's permission table — every other
    finance object (invoices, partners, the project's contract fields) is
    ADMIN/MANAGEMENT/BILLING-only.
    """
    if _is_finance_role(user):
        return True
    return user.role == UserRole.PROJECT_MANAGER and project.project_manager_id == user.id


def _scoped_projects_query(db: Session, user: User):
    """Projects visible for the cross-project finance views (overview/global
    lists) — mirrors app/api/projects.py::list_projects' scoping exactly
    (only PROJECT_MANAGER/SITE_MANAGER are restricted to their own projects;
    every other role, including BILLING, sees everything), rather than
    can_view_project's more permissive per-project fallthrough, since these
    are aggregate/reporting views spec §15 scopes to Projektvezető/Pénzügy/Admin.
    """
    q = db.query(Project)
    if user.role == UserRole.PROJECT_MANAGER:
        q = q.filter(Project.project_manager_id == user.id)
    elif user.role == UserRole.SITE_MANAGER:
        q = q.filter(Project.site_manager_id == user.id)
    return q


def _get_project_or_404(db: Session, project_id: int, user: User) -> Project:
    project = db.query(Project).get(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if not can_view_project(user, project):
        raise HTTPException(status_code=403, detail="Access denied")
    return project


def _require_finance_role(user: User) -> None:
    if not _is_finance_role(user):
        raise HTTPException(status_code=403, detail="Insufficient permissions")


# --- Partners ----------------------------------------------------------


@router.get("/partners", response_model=list[PartnerResponse])
def list_partners(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return db.query(Partner).order_by(Partner.name).all()


@router.post("/partners", response_model=PartnerResponse)
def create_partner(
    body: PartnerCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _require_finance_role(user)
    partner = Partner(**body.model_dump())
    db.add(partner)
    db.commit()
    db.refresh(partner)
    log_change(db, user, "partner", "created", None, partner.name, None, partner.id)
    db.commit()
    return partner


@router.patch("/partners/{partner_id}", response_model=PartnerResponse)
def update_partner(
    partner_id: int,
    body: PartnerUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _require_finance_role(user)
    partner = db.query(Partner).get(partner_id)
    if not partner:
        raise HTTPException(status_code=404, detail="Partner nem található")
    updates = body.model_dump(exclude_unset=True)
    for field_name, value in updates.items():
        setattr(partner, field_name, value)
    if updates:
        log_change(db, user, "partner", "edit", None, ",".join(updates.keys()), None, partner.id)
    db.commit()
    db.refresh(partner)
    return partner


# --- TIG -----------------------------------------------------------------


def _tig_invoice_aggregates(db: Session, tig_ids: list[int]) -> dict[int, tuple[Decimal, int]]:
    if not tig_ids:
        return {}
    rows = (
        db.query(
            SubcontractorInvoice.tig_id,
            func.sum(SubcontractorInvoice.net_value),
            func.count(SubcontractorInvoice.id),
        )
        .filter(SubcontractorInvoice.tig_id.in_(tig_ids))
        .group_by(SubcontractorInvoice.tig_id)
        .all()
    )
    return {tig_id: (total or Decimal("0"), count or 0) for tig_id, total, count in rows}


def _tig_to_response(tig: Tig, aggregates: dict[int, tuple[Decimal, int]]) -> TigResponse:
    consumed, count = aggregates.get(tig.id, (Decimal("0"), 0))
    resp = TigResponse.model_validate(tig)
    resp.consumed_amount = consumed
    resp.invoice_count = count
    return resp


@router.get("/projects/{project_id}/tigs", response_model=list[TigResponse])
def list_tigs(
    project_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _get_project_or_404(db, project_id, user)
    tigs = db.query(Tig).filter(Tig.project_id == project_id).order_by(Tig.date.desc()).all()
    aggregates = _tig_invoice_aggregates(db, [t.id for t in tigs])
    return [_tig_to_response(t, aggregates) for t in tigs]


@router.post("/projects/{project_id}/tigs", response_model=TigResponse)
def create_tig(
    project_id: int,
    body: TigCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    project = _get_project_or_404(db, project_id, user)
    if not _can_edit_tig(user, project):
        raise HTTPException(status_code=403, detail="Access denied")
    gross = compute_gross(body.net_value, body.vat_type)
    tig = Tig(
        project_id=project_id,
        partner_id=body.partner_id,
        date=body.date,
        period_start=body.period_start,
        period_end=body.period_end,
        net_value=body.net_value,
        vat_type=body.vat_type,
        gross_value=gross,
        note=body.note,
    )
    db.add(tig)
    db.commit()
    db.refresh(tig)
    log_change(db, user, "tig", "created", None, str(tig.net_value), project_id, tig.id)
    db.commit()
    return _tig_to_response(tig, {})


@router.patch("/projects/{project_id}/tigs/{tig_id}", response_model=TigResponse)
def update_tig(
    project_id: int,
    tig_id: int,
    body: TigUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    project = _get_project_or_404(db, project_id, user)
    tig = db.query(Tig).filter(Tig.id == tig_id, Tig.project_id == project_id).first()
    if not tig:
        raise HTTPException(status_code=404, detail="TIG nem található")
    if not _can_edit_tig(user, project):
        raise HTTPException(status_code=403, detail="Access denied")
    updates = body.model_dump(exclude_unset=True)
    for field_name, value in updates.items():
        setattr(tig, field_name, value)
    if "net_value" in updates or "vat_type" in updates:
        tig.gross_value = compute_gross(tig.net_value, tig.vat_type)
    if updates:
        log_change(db, user, "tig", "edit", None, ",".join(updates.keys()), project_id, tig.id)
    db.commit()
    db.refresh(tig)
    aggregates = _tig_invoice_aggregates(db, [tig.id])
    return _tig_to_response(tig, aggregates)


@router.patch("/projects/{project_id}/tigs/{tig_id}/status", response_model=TigResponse)
def update_tig_status(
    project_id: int,
    tig_id: int,
    body: TigStatusUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    project = _get_project_or_404(db, project_id, user)
    tig = db.query(Tig).filter(Tig.id == tig_id, Tig.project_id == project_id).first()
    if not tig:
        raise HTTPException(status_code=404, detail="TIG nem található")
    if not _can_edit_tig(user, project):
        raise HTTPException(status_code=403, detail="Access denied")
    old_status = tig.status
    tig.status = body.status
    if old_status != body.status:
        log_change(db, user, "tig", "status", old_status.value, body.status.value, project_id, tig.id)
    db.commit()
    db.refresh(tig)
    aggregates = _tig_invoice_aggregates(db, [tig.id])
    return _tig_to_response(tig, aggregates)


# --- Subcontractor invoices --------------------------------------------------


@router.get(
    "/projects/{project_id}/subcontractor-invoices", response_model=list[SubcontractorInvoiceResponse]
)
def list_subcontractor_invoices(
    project_id: int,
    tig_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _get_project_or_404(db, project_id, user)
    q = db.query(SubcontractorInvoice).filter(SubcontractorInvoice.project_id == project_id)
    if tig_id is not None:
        q = q.filter(SubcontractorInvoice.tig_id == tig_id)
    return q.order_by(SubcontractorInvoice.due_date.desc()).all()


@router.post("/projects/{project_id}/subcontractor-invoices", response_model=SubcontractorInvoiceResponse)
def create_subcontractor_invoice(
    project_id: int,
    body: SubcontractorInvoiceCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    project = _get_project_or_404(db, project_id, user)
    _require_finance_role(user)
    existing = (
        db.query(SubcontractorInvoice)
        .filter(
            SubcontractorInvoice.partner_id == body.partner_id,
            SubcontractorInvoice.invoice_number == body.invoice_number,
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="Ez a számlaszám már létezik ennél a partnernél")
    gross = compute_gross(body.net_value, body.vat_type)
    invoice = SubcontractorInvoice(
        project_id=project_id,
        partner_id=body.partner_id,
        tig_id=body.tig_id,
        invoice_number=body.invoice_number,
        performance_date=body.performance_date,
        issue_date=body.issue_date,
        due_date=body.due_date,
        payment_date=body.payment_date,
        net_value=body.net_value,
        vat_type=body.vat_type,
        gross_value=gross,
        paid_amount=body.paid_amount,
    )
    db.add(invoice)
    db.commit()
    db.refresh(invoice)
    log_change(
        db, user, "subcontractor_invoice", "created", None, invoice.invoice_number, project_id, invoice.id
    )
    db.commit()
    return invoice


@router.patch(
    "/projects/{project_id}/subcontractor-invoices/{invoice_id}",
    response_model=SubcontractorInvoiceResponse,
)
def update_subcontractor_invoice(
    project_id: int,
    invoice_id: int,
    body: SubcontractorInvoiceUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _get_project_or_404(db, project_id, user)
    _require_finance_role(user)
    invoice = (
        db.query(SubcontractorInvoice)
        .filter(SubcontractorInvoice.id == invoice_id, SubcontractorInvoice.project_id == project_id)
        .first()
    )
    if not invoice:
        raise HTTPException(status_code=404, detail="Számla nem található")
    updates = body.model_dump(exclude_unset=True)
    for field_name, value in updates.items():
        setattr(invoice, field_name, value)
    if "net_value" in updates or "vat_type" in updates:
        invoice.gross_value = compute_gross(invoice.net_value, invoice.vat_type)
    if updates:
        log_change(
            db, user, "subcontractor_invoice", "edit", None, ",".join(updates.keys()), project_id, invoice.id
        )
    db.commit()
    db.refresh(invoice)
    return invoice


@router.patch(
    "/projects/{project_id}/subcontractor-invoices/{invoice_id}/status",
    response_model=SubcontractorInvoiceResponse,
)
def update_subcontractor_invoice_status(
    project_id: int,
    invoice_id: int,
    body: SubcontractorInvoiceStatusUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _get_project_or_404(db, project_id, user)
    _require_finance_role(user)
    invoice = (
        db.query(SubcontractorInvoice)
        .filter(SubcontractorInvoice.id == invoice_id, SubcontractorInvoice.project_id == project_id)
        .first()
    )
    if not invoice:
        raise HTTPException(status_code=404, detail="Számla nem található")
    old_status = invoice.status
    invoice.status = body.status
    if body.paid_amount is not None:
        invoice.paid_amount = body.paid_amount
    if body.status == SubcontractorInvoiceStatus.PAID and invoice.payment_date is None:
        invoice.payment_date = datetime.utcnow().date()
    if old_status != body.status:
        log_change(
            db, user, "subcontractor_invoice", "status", old_status.value, body.status.value, project_id, invoice.id
        )
    db.commit()
    db.refresh(invoice)
    return invoice


# --- Customer invoices --------------------------------------------------------


def _customer_invoice_to_response(invoice: CustomerInvoice, project: Project) -> CustomerInvoiceResponse:
    resp = CustomerInvoiceResponse.model_validate(invoice)
    resp.customer_name = project.customer.name if project.customer else None
    return resp


@router.get("/projects/{project_id}/customer-invoices", response_model=list[CustomerInvoiceResponse])
def list_customer_invoices(
    project_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    project = _get_project_or_404(db, project_id, user)
    invoices = (
        db.query(CustomerInvoice)
        .filter(CustomerInvoice.project_id == project_id)
        .order_by(CustomerInvoice.due_date.desc())
        .all()
    )
    return [_customer_invoice_to_response(inv, project) for inv in invoices]


@router.post("/projects/{project_id}/customer-invoices", response_model=CustomerInvoiceResponse)
def create_customer_invoice(
    project_id: int,
    body: CustomerInvoiceCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    project = _get_project_or_404(db, project_id, user)
    _require_finance_role(user)
    gross = compute_gross(body.net_value, body.vat_type)
    invoice = CustomerInvoice(
        project_id=project_id,
        invoice_number=next_sequence_number(db, CustomerInvoice, "invoice_number", "OSZ"),
        issue_date=body.issue_date,
        performance_date=body.performance_date,
        due_date=body.due_date,
        payment_received_date=body.payment_received_date,
        net_value=body.net_value,
        vat_type=body.vat_type,
        gross_value=gross,
        paid_amount=body.paid_amount,
    )
    db.add(invoice)
    db.commit()
    db.refresh(invoice)
    log_change(
        db, user, "customer_invoice", "created", None, invoice.invoice_number, project_id, invoice.id
    )
    db.commit()
    return _customer_invoice_to_response(invoice, project)


@router.patch(
    "/projects/{project_id}/customer-invoices/{invoice_id}", response_model=CustomerInvoiceResponse
)
def update_customer_invoice(
    project_id: int,
    invoice_id: int,
    body: CustomerInvoiceUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    project = _get_project_or_404(db, project_id, user)
    _require_finance_role(user)
    invoice = (
        db.query(CustomerInvoice)
        .filter(CustomerInvoice.id == invoice_id, CustomerInvoice.project_id == project_id)
        .first()
    )
    if not invoice:
        raise HTTPException(status_code=404, detail="Számla nem található")
    updates = body.model_dump(exclude_unset=True)
    for field_name, value in updates.items():
        setattr(invoice, field_name, value)
    if "net_value" in updates or "vat_type" in updates:
        invoice.gross_value = compute_gross(invoice.net_value, invoice.vat_type)
    if updates:
        log_change(
            db, user, "customer_invoice", "edit", None, ",".join(updates.keys()), project_id, invoice.id
        )
    db.commit()
    db.refresh(invoice)
    return _customer_invoice_to_response(invoice, project)


@router.patch(
    "/projects/{project_id}/customer-invoices/{invoice_id}/status",
    response_model=CustomerInvoiceResponse,
)
def update_customer_invoice_status(
    project_id: int,
    invoice_id: int,
    body: CustomerInvoiceStatusUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    project = _get_project_or_404(db, project_id, user)
    _require_finance_role(user)
    invoice = (
        db.query(CustomerInvoice)
        .filter(CustomerInvoice.id == invoice_id, CustomerInvoice.project_id == project_id)
        .first()
    )
    if not invoice:
        raise HTTPException(status_code=404, detail="Számla nem található")
    old_status = invoice.status
    invoice.status = body.status
    if body.paid_amount is not None:
        invoice.paid_amount = body.paid_amount
    if body.status == CustomerInvoiceStatus.PAID and invoice.payment_received_date is None:
        invoice.payment_received_date = datetime.utcnow().date()
    if old_status != body.status:
        log_change(
            db, user, "customer_invoice", "status", old_status.value, body.status.value, project_id, invoice.id
        )
    db.commit()
    db.refresh(invoice)
    return _customer_invoice_to_response(invoice, project)


# --- Project finance summary / cash flow ------------------------------------


@router.get("/projects/{project_id}/cash-flow", response_model=CashFlowSummary)
def get_cash_flow(
    project_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    project = _get_project_or_404(db, project_id, user)
    summary = compute_cash_flow(db, project)
    return CashFlowSummary.model_validate(summary)


@router.patch("/projects/{project_id}", response_model=ProjectFinanceResponse)
def update_project_finance(
    project_id: int,
    body: ProjectFinanceUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    project = _get_project_or_404(db, project_id, user)
    _require_finance_role(user)
    updates = body.model_dump(exclude_unset=True)
    for field_name, value in updates.items():
        setattr(project, field_name, value)
    if "contract_net_value" in updates or "contract_vat_type" in updates:
        project.contract_gross_value = compute_gross(project.contract_net_value, project.contract_vat_type)
    if updates:
        log_change(
            db, user, "project_finance", "edit", None, ",".join(updates.keys()), project_id, project_id
        )
    db.commit()
    db.refresh(project)
    return project


# --- Cross-project views (spec §11 "Pénzügyi áttekintő" + §10 "Lejárt számlák") ---
# Scoped tighter than the per-project endpoints above: only roles the spec's
# §15 permission table actually names for these aggregate/reporting views.


def _require_overview_role(user: User) -> None:
    if user.role not in (*FINANCE_ROLES, UserRole.PROJECT_MANAGER):
        raise HTTPException(status_code=403, detail="Insufficient permissions")


@router.get("/overview", response_model=list[ProjectFinanceOverviewRow])
def finance_overview(
    project_id: Optional[int] = Query(None),
    project_manager_id: Optional[int] = Query(None),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _require_overview_role(user)
    q = _scoped_projects_query(db, user).options(
        joinedload(Project.project_manager), joinedload(Project.customer)
    )
    if project_id is not None:
        q = q.filter(Project.id == project_id)
    if project_manager_id is not None:
        q = q.filter(Project.project_manager_id == project_manager_id)
    projects = q.order_by(Project.name).all()

    summaries = compute_cash_flow_for_projects(db, projects, date_from, date_to)
    finance_status_map = compute_finance_status_for_projects(db, projects)

    rows = []
    for project in projects:
        summary = summaries[project.id]
        rows.append(
            ProjectFinanceOverviewRow(
                project_id=project.id,
                project_name=project.name,
                project_code=project.project_code,
                project_manager_name=project.project_manager.full_name if project.project_manager else None,
                customer_name=project.customer.name if project.customer else None,
                contract_gross=project.contract_gross_value,
                invoiced_gross=summary.invoiced_gross,
                received_gross=summary.received_gross,
                subcontractor_invoiced_gross=summary.subcontractor_invoiced_gross,
                subcontractor_paid_gross=summary.subcontractor_paid_gross,
                cash_flow_balance=summary.cash_flow_balance,
                overdue_receivable=summary.overdue_receivable,
                overdue_payable=summary.overdue_payable,
                finance_status=finance_status_map[project.id],
            )
        )
    return rows


@router.get("/all/tigs", response_model=list[TigResponse])
def all_tigs(
    project_id: Optional[int] = Query(None),
    partner_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _require_overview_role(user)
    project_ids = [p.id for p in _scoped_projects_query(db, user).all()]
    q = db.query(Tig).options(joinedload(Tig.project)).filter(Tig.project_id.in_(project_ids))
    if project_id is not None:
        q = q.filter(Tig.project_id == project_id)
    if partner_id is not None:
        q = q.filter(Tig.partner_id == partner_id)
    tigs = q.order_by(Tig.date.desc()).all()
    aggregates = _tig_invoice_aggregates(db, [t.id for t in tigs])

    responses = []
    for t in tigs:
        resp = _tig_to_response(t, aggregates)
        resp.project_name = t.project.name
        resp.project_code = t.project.project_code
        responses.append(resp)
    return responses


@router.get("/all/subcontractor-invoices", response_model=list[SubcontractorInvoiceResponse])
def all_subcontractor_invoices(
    project_id: Optional[int] = Query(None),
    partner_id: Optional[int] = Query(None),
    overdue_only: bool = Query(False),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _require_overview_role(user)
    project_ids = [p.id for p in _scoped_projects_query(db, user).all()]
    q = (
        db.query(SubcontractorInvoice)
        .options(joinedload(SubcontractorInvoice.project))
        .filter(SubcontractorInvoice.project_id.in_(project_ids))
    )
    if project_id is not None:
        q = q.filter(SubcontractorInvoice.project_id == project_id)
    if partner_id is not None:
        q = q.filter(SubcontractorInvoice.partner_id == partner_id)
    if overdue_only:
        q = q.filter(
            SubcontractorInvoice.due_date < date.today(), SubcontractorInvoice.payment_date.is_(None)
        )
    invoices = q.order_by(SubcontractorInvoice.due_date).all()

    responses = []
    for inv in invoices:
        resp = SubcontractorInvoiceResponse.model_validate(inv)
        resp.project_name = inv.project.name
        resp.project_code = inv.project.project_code
        responses.append(resp)
    return responses


@router.get("/all/customer-invoices", response_model=list[CustomerInvoiceResponse])
def all_customer_invoices(
    project_id: Optional[int] = Query(None),
    overdue_only: bool = Query(False),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _require_overview_role(user)
    project_ids = [p.id for p in _scoped_projects_query(db, user).all()]
    q = (
        db.query(CustomerInvoice)
        .options(joinedload(CustomerInvoice.project).joinedload(Project.customer))
        .filter(CustomerInvoice.project_id.in_(project_ids))
    )
    if project_id is not None:
        q = q.filter(CustomerInvoice.project_id == project_id)
    if overdue_only:
        q = q.filter(
            CustomerInvoice.due_date < date.today(), CustomerInvoice.payment_received_date.is_(None)
        )
    invoices = q.order_by(CustomerInvoice.due_date).all()

    responses = []
    for inv in invoices:
        resp = _customer_invoice_to_response(inv, inv.project)
        resp.project_name = inv.project.name
        resp.project_code = inv.project.project_code
        responses.append(resp)
    return responses
