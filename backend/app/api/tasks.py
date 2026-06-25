from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Activity, ActivityStatus, User
from app.schemas import PrepTaskItem
from app.services.scoping import scoped_activity_query

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.get("/prep-center", response_model=list[PrepTaskItem])
def prep_center(
    filter: str = Query("all"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    today = date.today()
    q = scoped_activity_query(db, user).filter(Activity.prep_date.isnot(None))

    items: list[PrepTaskItem] = []
    for activity, project in q.all():
        prep = activity.prep_date
        days_until = (prep - today).days if prep else None
        is_overdue = prep < today if prep else False
        if filter == "overdue" and not is_overdue:
            continue
        if filter == "today" and days_until != 0:
            continue
        if filter == "7d" and (days_until is None or days_until < 0 or days_until > 7):
            continue
        if filter == "14d" and (days_until is None or days_until < 0 or days_until > 14):
            continue
        items.append(
            PrepTaskItem(
                project_id=project.id,
                project_name=project.name,
                client_name=project.client_name,
                activity_id=activity.id,
                activity_name=activity.name,
                prep_date=prep,
                start_date=activity.start_date,
                responsible_role=activity.responsible_role,
                status=activity.status,
                is_overdue=is_overdue,
                days_until=days_until,
            )
        )
    items.sort(key=lambda x: (x.prep_date or date.max))
    return items


@router.get("/my-tasks", response_model=list[PrepTaskItem])
def my_tasks(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    today = date.today()
    q = scoped_activity_query(db, user)

    items = []
    for activity, project in q.filter(Activity.status != ActivityStatus.DONE).all():
        prep = activity.prep_date
        days_until = (prep - today).days if prep else None
        items.append(
            PrepTaskItem(
                project_id=project.id,
                project_name=project.name,
                client_name=project.client_name,
                activity_id=activity.id,
                activity_name=activity.name,
                prep_date=prep,
                start_date=activity.start_date,
                responsible_role=activity.responsible_role,
                status=activity.status,
                is_overdue=prep < today if prep else False,
                days_until=days_until,
            )
        )
    return items
