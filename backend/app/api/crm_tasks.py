from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import User, UserRole
from app.models_crm import Customer, CrmTask, CrmTaskStatus
from app.schemas_crm import CrmTaskCreate, CrmTaskResponse, CrmTaskUpdate
from app.services.audit import log_change
from app.services.scoping import scoped_crm_task_query, scoped_customer_query

router = APIRouter(prefix="/crm/tasks", tags=["crm-tasks"])


def _resolve_owner_id(user: User, requested_owner_id: Optional[int]) -> int:
    if user.role in (UserRole.ADMIN, UserRole.MANAGEMENT):
        if requested_owner_id is None:
            raise HTTPException(status_code=422, detail="owner_id kötelező")
        return requested_owner_id
    return user.id


def _visible_customer(db: Session, user: User, customer_id: int) -> Customer:
    customer = scoped_customer_query(db, user).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Ügyfél nem található")
    return customer


@router.get("", response_model=list[CrmTaskResponse])
def list_tasks(
    customer_id: Optional[int] = Query(None),
    status: Optional[CrmTaskStatus] = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = scoped_crm_task_query(db, user)
    if customer_id:
        _visible_customer(db, user, customer_id)
        q = q.filter(CrmTask.customer_id == customer_id)
    if status:
        q = q.filter(CrmTask.status == status)
    return q.order_by(CrmTask.due_date).all()


@router.post("", response_model=CrmTaskResponse)
def create_task(
    body: CrmTaskCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _visible_customer(db, user, body.customer_id)
    owner_id = _resolve_owner_id(user, body.owner_id)
    task = CrmTask(
        name=body.name,
        customer_id=body.customer_id,
        due_date=body.due_date,
        owner_id=owner_id,
        priority=body.priority,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    log_change(db, user, "crm_task", "created", None, task.name, None, task.id)
    db.commit()
    return task


@router.patch("/{task_id}", response_model=CrmTaskResponse)
def update_task(
    task_id: int,
    body: CrmTaskUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    task = scoped_crm_task_query(db, user).filter(CrmTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Feladat nem található")
    updates = body.model_dump(exclude_unset=True)
    for field, value in updates.items():
        old_value = getattr(task, field)
        if old_value != value:
            log_change(db, user, "crm_task", field, str(old_value), str(value), None, task.id)
            setattr(task, field, value)
    db.commit()
    db.refresh(task)
    return task
