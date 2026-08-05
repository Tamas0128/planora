"""Cash-flow calculation and traffic-light finance status for a Project.

Aggregation is deliberately Python-side (fetch rows with plain filters, sum/
compare in Python) rather than SQL-side, matching crm_sales_dashboard.py's
house rule: the test suite runs against sqlite (backend/tests/conftest.py)
while prod is Postgres, so Postgres-only SQL would silently break pytest.
"""

from collections import defaultdict
from dataclasses import dataclass
from datetime import date
from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy.orm import Session

from app.models import Project
from app.models_finance import (
    CustomerInvoice,
    CustomerInvoiceStatus,
    SubcontractorInvoice,
    SubcontractorInvoiceStatus,
    Tig,
    VatType,
)

STATUS_GREEN = "green"
STATUS_YELLOW = "yellow"
STATUS_RED = "red"

ZERO = Decimal("0")
# Yellow-rule ratio thresholds (not day-counts — those are a deferred
# notification-feature concern, see the financial-module plan §5.5): margin
# thinning below 10% of contract net, or received income covering less than
# half of what's been invoiced to the customer so far.
LOW_MARGIN_RATIO = Decimal("0.1")
LOW_COVERAGE_RATIO = Decimal("0.5")


def compute_gross(net: Decimal | None, vat_type: VatType | None) -> Decimal | None:
    """27% -> net*1.27, 5% -> net*1.05, reverse charge -> gross=net, VAT=0."""
    if net is None or vat_type is None:
        return None
    if vat_type == VatType.STANDARD_27:
        result = net * Decimal("1.27")
    elif vat_type == VatType.REDUCED_5:
        result = net * Decimal("1.05")
    else:
        result = net
    return result.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


@dataclass
class CashFlowSummary:
    contract_net: Decimal | None
    contract_gross: Decimal | None
    invoiced_net: Decimal
    invoiced_gross: Decimal
    received_gross: Decimal
    outstanding_receivable: Decimal
    tig_total_net: Decimal
    subcontractor_invoiced_gross: Decimal
    subcontractor_paid_gross: Decimal
    payable_obligations: Decimal
    expected_margin: Decimal | None
    actual_margin: Decimal
    cash_flow_balance: Decimal
    has_overdue_customer_invoice: bool
    has_overdue_subcontractor_invoice: bool
    overdue_receivable: Decimal
    overdue_payable: Decimal


def _received_gross(invoices: list[CustomerInvoice]) -> Decimal:
    total = ZERO
    for inv in invoices:
        if inv.status == CustomerInvoiceStatus.PAID:
            total += inv.gross_value or ZERO
        elif inv.paid_amount is not None:
            total += inv.paid_amount
    return total


def _paid_gross(invoices: list[SubcontractorInvoice]) -> Decimal:
    total = ZERO
    for inv in invoices:
        if inv.status == SubcontractorInvoiceStatus.PAID:
            total += inv.gross_value or ZERO
        elif inv.paid_amount is not None:
            total += inv.paid_amount
    return total


def _build_summary(
    project: Project,
    tigs: list[Tig],
    subcontractor_invoices: list[SubcontractorInvoice],
    customer_invoices: list[CustomerInvoice],
    today: date,
) -> CashFlowSummary:
    invoiced_net = sum((ci.net_value for ci in customer_invoices), ZERO)
    invoiced_gross = sum((ci.gross_value for ci in customer_invoices), ZERO)
    received_gross = _received_gross(customer_invoices)
    outstanding_receivable = invoiced_gross - received_gross

    tig_total_net = sum((t.net_value for t in tigs), ZERO)
    subcontractor_invoiced_gross = sum((si.gross_value for si in subcontractor_invoices), ZERO)
    subcontractor_paid_gross = _paid_gross(subcontractor_invoices)
    payable_obligations = subcontractor_invoiced_gross - subcontractor_paid_gross

    expected_margin = (
        project.contract_net_value - tig_total_net
        if project.contract_net_value is not None
        else None
    )
    actual_margin = received_gross - subcontractor_paid_gross
    cash_flow_balance = received_gross - subcontractor_paid_gross

    has_overdue_customer_invoice = any(
        ci.due_date < today and ci.payment_received_date is None for ci in customer_invoices
    )
    has_overdue_subcontractor_invoice = any(
        si.due_date < today and si.payment_date is None for si in subcontractor_invoices
    )
    # "Lejárt követelés"/"Lejárt kötelezettség" (spec §11) — the outstanding
    # (gross minus whatever was already recorded via paid_amount) balance of
    # invoices that are overdue, not just a boolean flag.
    overdue_receivable = sum(
        (
            (ci.gross_value or ZERO) - (ci.paid_amount or ZERO)
            for ci in customer_invoices
            if ci.due_date < today and ci.payment_received_date is None
        ),
        ZERO,
    )
    overdue_payable = sum(
        (
            (si.gross_value or ZERO) - (si.paid_amount or ZERO)
            for si in subcontractor_invoices
            if si.due_date < today and si.payment_date is None
        ),
        ZERO,
    )

    return CashFlowSummary(
        contract_net=project.contract_net_value,
        contract_gross=project.contract_gross_value,
        invoiced_net=invoiced_net,
        invoiced_gross=invoiced_gross,
        received_gross=received_gross,
        outstanding_receivable=outstanding_receivable,
        tig_total_net=tig_total_net,
        subcontractor_invoiced_gross=subcontractor_invoiced_gross,
        subcontractor_paid_gross=subcontractor_paid_gross,
        payable_obligations=payable_obligations,
        expected_margin=expected_margin,
        actual_margin=actual_margin,
        cash_flow_balance=cash_flow_balance,
        has_overdue_customer_invoice=has_overdue_customer_invoice,
        has_overdue_subcontractor_invoice=has_overdue_subcontractor_invoice,
        overdue_receivable=overdue_receivable,
        overdue_payable=overdue_payable,
    )


def compute_cash_flow(db: Session, project: Project) -> CashFlowSummary:
    tigs = db.query(Tig).filter(Tig.project_id == project.id).all()
    subcontractor_invoices = (
        db.query(SubcontractorInvoice).filter(SubcontractorInvoice.project_id == project.id).all()
    )
    customer_invoices = (
        db.query(CustomerInvoice).filter(CustomerInvoice.project_id == project.id).all()
    )
    return _build_summary(project, tigs, subcontractor_invoices, customer_invoices, date.today())


def _evaluate_status(project: Project, summary: CashFlowSummary) -> tuple[str, list[str]]:
    reasons: list[str] = []

    if summary.has_overdue_customer_invoice:
        reasons.append("Lejárt ügyfél számla")
    if summary.has_overdue_subcontractor_invoice:
        reasons.append("Lejárt alvállalkozói számla")
    if summary.cash_flow_balance < 0:
        reasons.append("Negatív cash flow egyenleg")
    if summary.contract_gross is not None and summary.subcontractor_invoiced_gross > summary.contract_gross:
        reasons.append("Túlköltés a szerződéshez képest")
    if reasons:
        return STATUS_RED, reasons

    if (
        summary.expected_margin is not None
        and project.contract_net_value
        and project.contract_net_value > 0
        and 0 <= summary.expected_margin < project.contract_net_value * LOW_MARGIN_RATIO
    ):
        reasons.append("Csökkenő fedezeti arány")
    if summary.invoiced_gross > 0 and summary.received_gross < summary.invoiced_gross * LOW_COVERAGE_RATIO:
        reasons.append("Alacsony beérkezett bevétel a kiszámlázotthoz képest")
    if reasons:
        return STATUS_YELLOW, reasons

    return STATUS_GREEN, []


def compute_finance_status(
    db: Session, project: Project, summary: CashFlowSummary | None = None
) -> tuple[str, list[str]]:
    if summary is None:
        summary = compute_cash_flow(db, project)
    return _evaluate_status(project, summary)


def _bulk_fetch_finance_rows(
    db: Session,
    project_ids: list[int],
    date_from: date | None = None,
    date_to: date | None = None,
) -> tuple[
    dict[int, list[Tig]], dict[int, list[SubcontractorInvoice]], dict[int, list[CustomerInvoice]]
]:
    """One query per finance entity for all projects — shared by the bulk
    status/cash-flow helpers below so the kanban board, project list, and the
    cross-project finance overview don't pay an N+1 query per project.

    date_from/date_to (optional, inclusive) filter TIG.date and both invoice
    types' due_date — only used by the "Pénzügyi áttekintő" overview's period
    filter (spec §11); every other caller passes neither, matching the
    project-detail/Kanban badge's always-current-totals semantics.
    """
    tigs_by_project: dict[int, list[Tig]] = defaultdict(list)
    q = db.query(Tig).filter(Tig.project_id.in_(project_ids))
    if date_from is not None:
        q = q.filter(Tig.date >= date_from)
    if date_to is not None:
        q = q.filter(Tig.date <= date_to)
    for t in q.all():
        tigs_by_project[t.project_id].append(t)

    sub_invoices_by_project: dict[int, list[SubcontractorInvoice]] = defaultdict(list)
    q = db.query(SubcontractorInvoice).filter(SubcontractorInvoice.project_id.in_(project_ids))
    if date_from is not None:
        q = q.filter(SubcontractorInvoice.due_date >= date_from)
    if date_to is not None:
        q = q.filter(SubcontractorInvoice.due_date <= date_to)
    for si in q.all():
        sub_invoices_by_project[si.project_id].append(si)

    cust_invoices_by_project: dict[int, list[CustomerInvoice]] = defaultdict(list)
    q = db.query(CustomerInvoice).filter(CustomerInvoice.project_id.in_(project_ids))
    if date_from is not None:
        q = q.filter(CustomerInvoice.due_date >= date_from)
    if date_to is not None:
        q = q.filter(CustomerInvoice.due_date <= date_to)
    for ci in q.all():
        cust_invoices_by_project[ci.project_id].append(ci)

    return tigs_by_project, sub_invoices_by_project, cust_invoices_by_project


def compute_cash_flow_for_projects(
    db: Session,
    projects: list[Project],
    date_from: date | None = None,
    date_to: date | None = None,
) -> dict[int, CashFlowSummary]:
    """Bulk variant of compute_cash_flow — see _bulk_fetch_finance_rows."""
    if not projects:
        return {}
    today = date.today()
    project_ids = [p.id for p in projects]
    tigs_by_project, sub_invoices_by_project, cust_invoices_by_project = _bulk_fetch_finance_rows(
        db, project_ids, date_from, date_to
    )
    return {
        project.id: _build_summary(
            project,
            tigs_by_project.get(project.id, []),
            sub_invoices_by_project.get(project.id, []),
            cust_invoices_by_project.get(project.id, []),
            today,
        )
        for project in projects
    }


def compute_finance_status_for_projects(db: Session, projects: list[Project]) -> dict[int, str]:
    """Bulk variant mirroring services/health.py::compute_health_for_projects
    — one query per finance entity for all projects, so the kanban board and
    project list don't pay an N+1 query per card.
    """
    summaries = compute_cash_flow_for_projects(db, projects)
    return {
        project.id: _evaluate_status(project, summaries[project.id])[0] for project in projects
    }
