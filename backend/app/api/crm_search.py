from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import User
from app.models_crm import Contract, Customer
from app.services.scoping import scoped_contract_query, scoped_customer_query_readonly

router = APIRouter(prefix="/crm/search", tags=["crm-search"])


class CrmSearchResult(BaseModel):
    type: str  # "customer" | "contract"
    id: int
    label: str
    sublabel: str | None = None
    customer_id: int


@router.get("", response_model=list[CrmSearchResult])
def crm_search(
    q: str = Query(..., min_length=1),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    like = f"%{q}%"
    results: list[CrmSearchResult] = []

    customers = (
        scoped_customer_query_readonly(db, user)
        .filter((Customer.name.ilike(like)) | (Customer.customer_number.ilike(like)))
        .order_by(Customer.name)
        .limit(10)
        .all()
    )
    for c in customers:
        results.append(
            CrmSearchResult(type="customer", id=c.id, label=c.name, sublabel=c.customer_number, customer_id=c.id)
        )

    contracts = (
        scoped_contract_query(db, user)
        .filter(Contract.contract_number.ilike(like))
        .order_by(Contract.contract_number)
        .limit(10)
        .all()
    )
    for ct in contracts:
        results.append(
            CrmSearchResult(
                type="contract",
                id=ct.id,
                label=ct.contract_number,
                sublabel=None,
                customer_id=ct.customer_id,
            )
        )

    return results
