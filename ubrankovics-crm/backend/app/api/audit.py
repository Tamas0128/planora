"""Auditnapló lekérdezés — csak admin és vezetés."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.dependencies import require_roles
from app.models import User, UserRole
from app.models_ext import AuditNaplo
from app.schemas_ext import AuditResponse

router = APIRouter(prefix="/audit", tags=["audit"])


@router.get("", response_model=list[AuditResponse])
def list_audit(
    entitas: str | None = None,
    limit: int = 200,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN, UserRole.VEZETES)),
):
    q = db.query(AuditNaplo).options(joinedload(AuditNaplo.user))
    if entitas:
        q = q.filter(AuditNaplo.entitas == entitas)
    return q.order_by(AuditNaplo.created_at.desc(), AuditNaplo.id.desc()).limit(min(limit, 1000)).all()
