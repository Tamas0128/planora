from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session, joinedload

from app.api.crm_documents import store_and_link_document
from app.database import get_db
from app.dependencies import get_current_user
from app.models import User
from app.models_crm import (
    Contract,
    ContractStatus,
    CrmDocumentType,
    Customer,
    Quote,
    QuoteStatus,
    QuoteVersion,
)
from app.schemas_crm import (
    ContractResponse,
    QuoteResponse,
    QuoteStatusUpdate,
)
from app.services.audit import log_change
from app.services.numbering import next_sequence_number
from app.services.scoping import scoped_customer_query, scoped_quote_query

router = APIRouter(prefix="/crm/quotes", tags=["crm-quotes"])


def _visible_customer(db: Session, user: User, customer_id: int) -> Customer:
    customer = scoped_customer_query(db, user).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Ügyfél nem található")
    return customer


@router.get("", response_model=list[QuoteResponse])
def list_quotes(
    customer_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = scoped_quote_query(db, user).options(joinedload(Quote.versions))
    if customer_id:
        q = q.filter(Quote.customer_id == customer_id)
    return q.order_by(Quote.date.desc()).all()


@router.post("", response_model=QuoteResponse)
async def create_quote(
    customer_id: int = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _visible_customer(db, user, customer_id)
    quote = Quote(
        customer_id=customer_id,
        quote_number=next_sequence_number(db, Quote, "quote_number", "AJ"),
        date=date.today(),
        status=QuoteStatus.DRAFT,
        current_version=1,
    )
    db.add(quote)
    db.flush()
    version = QuoteVersion(quote_id=quote.id, version=1, content_json={}, created_by_id=user.id)
    db.add(version)
    db.flush()
    await store_and_link_document(db, user, file, "quote", quote.id, CrmDocumentType.QUOTE)
    db.commit()
    db.refresh(quote)
    log_change(db, user, "quote", "created", None, quote.quote_number, None, quote.id)
    db.commit()
    return quote


@router.get("/{quote_id}", response_model=QuoteResponse)
def get_quote(
    quote_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    quote = (
        scoped_quote_query(db, user)
        .options(joinedload(Quote.versions))
        .filter(Quote.id == quote_id)
        .first()
    )
    if not quote:
        raise HTTPException(status_code=404, detail="Ajánlat nem található")
    return quote


@router.post("/{quote_id}/versions", response_model=QuoteResponse)
async def add_quote_version(
    quote_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    quote = scoped_quote_query(db, user).filter(Quote.id == quote_id).first()
    if not quote:
        raise HTTPException(status_code=404, detail="Ajánlat nem található")
    new_version_number = quote.current_version + 1
    version = QuoteVersion(
        quote_id=quote.id,
        version=new_version_number,
        content_json={},
        created_by_id=user.id,
    )
    db.add(version)
    quote.current_version = new_version_number
    await store_and_link_document(db, user, file, "quote", quote.id, CrmDocumentType.QUOTE)
    log_change(
        db, user, "quote", "version", str(new_version_number - 1), str(new_version_number), None, quote.id
    )
    db.commit()
    db.refresh(quote)
    return quote


@router.patch("/{quote_id}/status", response_model=QuoteResponse)
def update_quote_status(
    quote_id: int,
    body: QuoteStatusUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    quote = scoped_quote_query(db, user).filter(Quote.id == quote_id).first()
    if not quote:
        raise HTTPException(status_code=404, detail="Ajánlat nem található")
    old_status = quote.status
    quote.status = body.status
    if old_status != body.status:
        log_change(db, user, "quote", "status", old_status.value, body.status.value, None, quote.id)
    db.commit()
    db.refresh(quote)
    return quote


@router.post("/{quote_id}/create-contract", response_model=ContractResponse)
async def create_contract_from_quote(
    quote_id: int,
    start_date: date = Form(...),
    end_date: date = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    quote = scoped_quote_query(db, user).filter(Quote.id == quote_id).first()
    if not quote:
        raise HTTPException(status_code=404, detail="Ajánlat nem található")
    if quote.status != QuoteStatus.ACCEPTED:
        raise HTTPException(
            status_code=422, detail="Csak elfogadott ajánlatból hozható létre szerződés"
        )
    customer = db.query(Customer).filter(Customer.id == quote.customer_id).first()

    contract = Contract(
        customer_id=customer.id,
        quote_id=quote.id,
        contract_number=next_sequence_number(db, Contract, "contract_number", "SZ"),
        start_date=start_date,
        end_date=end_date,
        status=ContractStatus.ACTIVE,
    )
    db.add(contract)
    db.flush()
    await store_and_link_document(db, user, file, "contract", contract.id, CrmDocumentType.CONTRACT)
    log_change(db, user, "contract", "created", None, contract.contract_number, None, contract.id)
    db.commit()
    db.refresh(contract)
    return contract
