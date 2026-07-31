from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import User
from app.models_crm import Customer, CustomerRelation, CustomerType
from app.schemas_crm import CustomerRelationCreate, CustomerRelationResponse
from app.services.scoping import scoped_customer_query

router = APIRouter(prefix="/crm/customer-relations", tags=["crm-relations"])


def _visible_customer(db: Session, user: User, customer_id: int) -> Customer:
    customer = scoped_customer_query(db, user).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Ügyfél nem található")
    return customer


@router.get("", response_model=list[CustomerRelationResponse])
def list_relations(
    customer_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = db.query(CustomerRelation)
    if customer_id:
        _visible_customer(db, user, customer_id)
        q = q.filter(
            (CustomerRelation.company_customer_id == customer_id)
            | (CustomerRelation.person_customer_id == customer_id)
        )
    return q.all()


@router.post("", response_model=CustomerRelationResponse)
def create_relation(
    body: CustomerRelationCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if body.company_customer_id == body.person_customer_id:
        raise HTTPException(status_code=422, detail="Egy ügyfél nem lehet önmagával kapcsolatban")
    company = _visible_customer(db, user, body.company_customer_id)
    person = _visible_customer(db, user, body.person_customer_id)
    if company.type == CustomerType.PERSON:
        raise HTTPException(status_code=422, detail="A company_customer_id nem lehet magánszemély")
    if person.type != CustomerType.PERSON:
        raise HTTPException(status_code=422, detail="A person_customer_id csak magánszemély lehet")

    existing = (
        db.query(CustomerRelation)
        .filter(
            CustomerRelation.company_customer_id == body.company_customer_id,
            CustomerRelation.person_customer_id == body.person_customer_id,
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="Ez a kapcsolat már létezik")

    relation = CustomerRelation(
        company_customer_id=body.company_customer_id,
        person_customer_id=body.person_customer_id,
        role_label=body.role_label,
        is_primary=body.is_primary,
    )
    db.add(relation)
    db.commit()
    db.refresh(relation)
    return relation


@router.delete("/{relation_id}")
def delete_relation(
    relation_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    relation = db.query(CustomerRelation).filter(CustomerRelation.id == relation_id).first()
    if not relation:
        raise HTTPException(status_code=404, detail="Kapcsolat nem található")
    _visible_customer(db, user, relation.company_customer_id)
    db.delete(relation)
    db.commit()
    return {"ok": True}
