"""Auditnapló-segéd: a hívó commitol (a naplózás a művelettel egy tranzakció)."""

from sqlalchemy.orm import Session

from app.models import User
from app.models_ext import AuditNaplo


def log_audit(
    db: Session,
    user: User | None,
    entitas: str,
    entitas_id: int | None,
    muvelet: str,
    reszletek: str | None = None,
) -> None:
    db.add(
        AuditNaplo(
            user_id=user.id if user else None,
            entitas=entitas,
            entitas_id=entitas_id,
            muvelet=muvelet,
            reszletek=reszletek,
        )
    )
