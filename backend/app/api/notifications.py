from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models import Notification, User, UserRole
from app.schemas import DigestPreview, NotificationResponse, PrepTaskItem
from app.services.notifications import get_user_digest_items, send_daily_digest

router = APIRouter(prefix="/notifications", tags=["notifications"])


def _notification_to_response(n: Notification) -> NotificationResponse:
    return NotificationResponse(
        id=n.id,
        type=n.type,
        title=n.title,
        body=n.body,
        related_project_id=n.related_project_id,
        related_project_name=n.related_project.name if n.related_project else None,
        created_at=n.created_at,
        read_at=n.read_at,
    )


@router.get("", response_model=list[NotificationResponse])
def list_notifications(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    notifications = (
        db.query(Notification)
        .options(joinedload(Notification.related_project))
        .filter(Notification.user_id == user.id)
        .order_by(Notification.read_at.is_(None).desc(), Notification.created_at.desc())
        .limit(50)
        .all()
    )
    return [_notification_to_response(n) for n in notifications]


@router.post("/{notification_id}/read")
def mark_read(
    notification_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    notification = db.query(Notification).filter(
        Notification.id == notification_id, Notification.user_id == user.id
    ).first()
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    if not notification.read_at:
        notification.read_at = datetime.utcnow()
        db.commit()
    return {"ok": True}


@router.post("/read-all")
def mark_all_read(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    now = datetime.utcnow()
    (
        db.query(Notification)
        .filter(Notification.user_id == user.id, Notification.read_at.is_(None))
        .update({Notification.read_at: now})
    )
    db.commit()
    return {"ok": True}


@router.get("/digest-preview", response_model=DigestPreview)
def digest_preview(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """In-app rendering of the same 'napi összefoglaló' the daily email digest
    sends — reuses get_user_digest_items() rather than duplicating the
    overdue/upcoming-prep computation."""
    today = date.today()
    overdue, upcoming = get_user_digest_items(db, user)

    def to_item(activity, project) -> PrepTaskItem:
        days_until = (activity.prep_date - today).days if activity.prep_date else None
        return PrepTaskItem(
            project_id=project.id,
            project_name=project.name,
            client_name=project.client_name,
            activity_id=activity.id,
            activity_name=activity.name,
            prep_date=activity.prep_date,
            start_date=activity.start_date,
            responsible_role=activity.responsible_role,
            status=activity.status,
            is_overdue=activity.prep_date < today if activity.prep_date else False,
            days_until=days_until,
        )

    return DigestPreview(
        overdue=[to_item(a, p) for a, p in overdue],
        upcoming=[to_item(a, p) for a, p in upcoming],
    )


@router.post("/send-digest")
def trigger_digest(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN)),
):
    sent = send_daily_digest(db)
    return {"sent": sent}
