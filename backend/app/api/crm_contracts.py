from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import User
from app.models_crm import Contract, ContractStatus
from app.schemas_crm import ContractCreate, ContractResponse, ContractStatusUpdate
from app.services.audit import log_change
from app.services.numbering import next_sequence_number
from app.services.scoping import scoped_contract_query

router = APIRouter(prefix="/crm/contracts", tags=["crm-contracts"])


@router.get("", response_model=list[ContractResponse])
def list_contracts(
    customer_id: Optional[int] = Query(None),
    status: Optional[ContractStatus] = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = scoped_contract_query(db, user)
    if customer_id:
        q = q.filter(Contract.customer_id == customer_id)
    if status:
        q = q.filter(Contract.status == status)
    return q.order_by(Contract.start_date.desc()).all()


@router.post("", response_model=ContractResponse)
def create_contract(
    body: ContractCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    contract = Contract(
        customer_id=body.customer_id,
        quote_id=body.quote_id,
        contract_number=next_sequence_number(db, Contract, "contract_number", "SZ"),
        start_date=body.start_date,
        end_date=body.end_date,
        status=ContractStatus.DRAFT,
    )
    db.add(contract)
    db.commit()
    db.refresh(contract)
    log_change(db, user, "contract", "created", None, contract.contract_number, None, contract.id)
    db.commit()
    return contract


@router.get("/{contract_id}", response_model=ContractResponse)
def get_contract(
    contract_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    contract = scoped_contract_query(db, user).filter(Contract.id == contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Szerződés nem található")
    return contract


@router.patch("/{contract_id}/status", response_model=ContractResponse)
def update_contract_status(
    contract_id: int,
    body: ContractStatusUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    contract = scoped_contract_query(db, user).filter(Contract.id == contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Szerződés nem található")
    old_status = contract.status
    contract.status = body.status
    if old_status != body.status:
        log_change(
            db, user, "contract", "status", old_status.value, body.status.value, None, contract.id
        )
    db.commit()
    db.refresh(contract)
    return contract
