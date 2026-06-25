from sqlalchemy.orm import Session

from app.models import AuditLog, User


def log_change(
    db: Session,
    user: User,
    entity_type: str,
    field_name: str,
    old_value: str | None,
    new_value: str | None,
    project_id: int | None = None,
    entity_id: int | None = None,
) -> None:
    db.add(
        AuditLog(
            user_id=user.id,
            project_id=project_id,
            entity_type=entity_type,
            entity_id=entity_id,
            field_name=field_name,
            old_value=old_value,
            new_value=new_value,
        )
    )
