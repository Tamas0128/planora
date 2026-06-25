from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_roles
from app.models import User, UserRole
from app.services.notifications import send_daily_digest

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.post("/send-digest")
def trigger_digest(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN)),
):
    sent = send_daily_digest(db)
    return {"sent": sent}
