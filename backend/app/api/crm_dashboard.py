from datetime import date, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import User
from app.models_crm import (
    Contract,
    ContractStatus,
    CrmTask,
    CrmTaskStatus,
    Customer,
    CustomerStatus,
    Quote,
    QuoteStatus,
)
from app.schemas_crm import CrmDashboardStats
from app.services.scoping import scoped_contract_query, scoped_customer_query, scoped_quote_query

router = APIRouter(prefix="/crm/dashboard", tags=["crm-dashboard"])


@router.get("/stats", response_model=CrmDashboardStats)
def crm_dashboard_stats(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    today = date.today()
    thirty_days_ago = today - timedelta(days=30)
    thirty_days_ahead = today + timedelta(days=30)

    customers_q = scoped_customer_query(db, user)
    total_customers = customers_q.count()
    # "Active" now means the pipeline's final stage (Megrendelő) — CustomerStatus
    # no longer has a separate ACTIVE/INACTIVE pair (folded into the pipeline).
    active_customers = customers_q.filter(Customer.status == CustomerStatus.ORDERED).count()
    new_customers_30d = customers_q.filter(Customer.created_at >= thirty_days_ago).count()
    customers_by_type: dict[str, int] = {}
    for type_, count in customers_q.with_entities(Customer.type, func.count()).group_by(Customer.type):
        customers_by_type[type_.value] = count

    open_tasks = (
        db.query(CrmTask)
        .filter(CrmTask.owner_id == user.id, CrmTask.status != CrmTaskStatus.DONE)
        .count()
    )

    contracts_q = scoped_contract_query(db, user)
    active_contracts = contracts_q.filter(Contract.status == ContractStatus.ACTIVE).count()
    expiring_contracts_30d = contracts_q.filter(
        Contract.status == ContractStatus.ACTIVE,
        Contract.end_date >= today,
        Contract.end_date <= thirty_days_ahead,
    ).count()

    pending_quotes = (
        scoped_quote_query(db, user)
        .filter(Quote.status.in_([QuoteStatus.SENT, QuoteStatus.APPROVAL_PENDING]))
        .count()
    )

    return CrmDashboardStats(
        total_customers=total_customers,
        active_customers=active_customers,
        new_customers_30d=new_customers_30d,
        customers_by_type=customers_by_type,
        open_tasks=open_tasks,
        active_contracts=active_contracts,
        expiring_contracts_30d=expiring_contracts_30d,
        pending_quotes=pending_quotes,
    )
