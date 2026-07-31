from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import User
from app.models_crm import CommunicationEvent, Customer
from app.schemas_crm import CommunicationEventCreate, CommunicationEventResponse
from app.services.audit import log_change
from app.services.scoping import scoped_communication_event_query, scoped_customer_query

router = APIRouter(prefix="/crm/communications", tags=["crm-communications"])


def _visible_customer(db: Session, user: User, customer_id: int) -> Customer:
    customer = scoped_customer_query(db, user).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Ügyfél nem található")
    return customer


@router.get("", response_model=list[CommunicationEventResponse])
def list_communications(
    customer_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = scoped_communication_event_query(db, user)
    if customer_id:
        _visible_customer(db, user, customer_id)
        q = q.filter(CommunicationEvent.customer_id == customer_id)
    return q.order_by(CommunicationEvent.date.desc()).all()


@router.post("", response_model=CommunicationEventResponse)
def create_communication(
    body: CommunicationEventCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _visible_customer(db, user, body.customer_id)
    event = CommunicationEvent(
        customer_id=body.customer_id,
        type=body.type,
        date=body.date,
        agent_id=body.agent_id or user.id,
        summary=body.summary,
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    log_change(db, user, "communication_event", "created", None, body.summary[:100], None, event.id)
    db.commit()
    return event


@router.get("/{event_id}", response_model=CommunicationEventResponse)
def get_communication(
    event_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    event = scoped_communication_event_query(db, user).filter(CommunicationEvent.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Esemény nem található")
    return event


@router.patch("/{event_id}", response_model=CommunicationEventResponse)
def update_communication(
    event_id: int,
    body: CommunicationEventCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    event = scoped_communication_event_query(db, user).filter(CommunicationEvent.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Esemény nem található")
    event.type = body.type
    event.date = body.date
    event.summary = body.summary
    db.commit()
    db.refresh(event)
    return event
