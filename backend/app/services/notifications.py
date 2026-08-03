import logging
import smtplib
from datetime import date, timedelta
from email.mime.text import MIMEText

from sqlalchemy.orm import Session

from app.config import settings
from app.models import Activity, ActivityStatus, Notification, NotificationType, Project, User
from app.models_crm import Contract, ContractStatus
from app.services.scoping import scoped_activity_query, scoped_contract_query

logger = logging.getLogger("planora.notifications")


def get_user_digest_items(
    db: Session, user: User
) -> tuple[list[tuple[Activity, Project]], list[tuple[Activity, Project]]]:
    today = date.today()
    week = today + timedelta(days=7)
    q = scoped_activity_query(db, user).filter(Activity.status != ActivityStatus.DONE)

    overdue: list[tuple[Activity, Project]] = []
    upcoming: list[tuple[Activity, Project]] = []
    for activity, project in q.all():
        if not activity.prep_date:
            continue
        if activity.prep_date < today:
            overdue.append((activity, project))
        elif activity.prep_date <= week:
            upcoming.append((activity, project))

    overdue.sort(key=lambda pair: pair[0].prep_date)
    upcoming.sort(key=lambda pair: pair[0].prep_date)
    return overdue, upcoming


def render_digest(
    user: User,
    overdue: list[tuple[Activity, Project]],
    upcoming: list[tuple[Activity, Project]],
) -> tuple[str, str]:
    subject = (
        f"PLANora napi összefoglaló — {len(overdue)} lejárt, {len(upcoming)} közelgő előkészítés"
    )
    lines = [f"Kedves {user.full_name}!", ""]
    if overdue:
        lines.append("LEJÁRT ELŐKÉSZÍTÉSEK:")
        for activity, project in overdue:
            lines.append(
                f"  - {project.name} / {activity.name} — előkészítés: {activity.prep_date.isoformat()}"
            )
        lines.append("")
    if upcoming:
        lines.append("KÖZELGŐ ELŐKÉSZÍTÉSEK (7 napon belül):")
        for activity, project in upcoming:
            lines.append(
                f"  - {project.name} / {activity.name} — előkészítés: {activity.prep_date.isoformat()}"
            )
        lines.append("")
    lines.append("— PLANora")
    return subject, "\n".join(lines)


def send_email(to_email: str, subject: str, body: str) -> None:
    if not settings.smtp_host:
        logger.info("SMTP not configured, logging email instead. To=%s Subject=%s\n%s", to_email, subject, body)
        return
    msg = MIMEText(body, "plain", "utf-8")
    msg["Subject"] = subject
    msg["From"] = settings.smtp_from
    msg["To"] = to_email
    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as server:
        if settings.smtp_use_tls:
            server.starttls()
        if settings.smtp_user:
            server.login(settings.smtp_user, settings.smtp_password)
        server.send_message(msg)


def get_user_reminders_due(db: Session, user: User) -> list[tuple[Activity, Project]]:
    """Tasks whose optional reminder_date has arrived — picked up by the same
    daily digest job as overdue/upcoming prep, not a separate real-time
    scheduler (see Activity.reminder_date).
    """
    today = date.today()
    q = scoped_activity_query(db, user).filter(
        Activity.status != ActivityStatus.DONE,
        Activity.reminder_date.isnot(None),
        Activity.reminder_date <= today,
    )
    return sorted(q.all(), key=lambda pair: pair[0].reminder_date)


def get_expiring_contracts_for_user(
    db: Session, user: User, within_days: int = 30
) -> list[Contract]:
    """Contracts nearing end_date — dev plan 4.1 "A rendszer automatikusan
    jelzi a közelgő lejáratot", modeled the same way as UPCOMING_PREP.
    """
    today = date.today()
    horizon = today + timedelta(days=within_days)
    return (
        scoped_contract_query(db, user)
        .filter(
            Contract.status == ContractStatus.ACTIVE,
            Contract.end_date >= today,
            Contract.end_date <= horizon,
        )
        .order_by(Contract.end_date)
        .all()
    )


def _create_notification_if_new(
    db: Session,
    user: User,
    ntype: NotificationType,
    title: str,
    body: str,
    project_id: int | None,
) -> None:
    # Avoid re-notifying about the same still-unread item on every digest run
    # (this job fires daily) — only insert if no matching unread notification
    # already exists for this user.
    exists = (
        db.query(Notification)
        .filter(
            Notification.user_id == user.id,
            Notification.type == ntype,
            Notification.related_project_id == project_id,
            Notification.title == title,
            Notification.read_at.is_(None),
        )
        .first()
    )
    if exists:
        return
    db.add(
        Notification(
            user_id=user.id,
            type=ntype,
            title=title,
            body=body,
            related_project_id=project_id,
        )
    )


def create_digest_notifications(
    db: Session,
    user: User,
    overdue: list[tuple[Activity, Project]],
    upcoming: list[tuple[Activity, Project]],
) -> None:
    for activity, project in overdue:
        _create_notification_if_new(
            db, user, NotificationType.OVERDUE_TASK,
            f"Lejárt előkészítés: {activity.name}",
            f"{project.name} / {activity.name} — előkészítés: {activity.prep_date.isoformat()}",
            project.id,
        )
    for activity, project in upcoming:
        _create_notification_if_new(
            db, user, NotificationType.UPCOMING_PREP,
            f"Közelgő előkészítés: {activity.name}",
            f"{project.name} / {activity.name} — előkészítés: {activity.prep_date.isoformat()}",
            project.id,
        )


def send_daily_digest(db: Session) -> int:
    sent = 0
    users = db.query(User).filter(User.is_active.is_(True)).all()
    for user in users:
        overdue, upcoming = get_user_digest_items(db, user)
        create_digest_notifications(db, user, overdue, upcoming)
        for activity, project in get_user_reminders_due(db, user):
            _create_notification_if_new(
                db, user, NotificationType.TASK_REMINDER,
                f"Emlékeztető: {activity.name}",
                f"{project.name} / {activity.name} — emlékeztető dátuma: {activity.reminder_date.isoformat()}",
                project.id,
            )
        for contract in get_expiring_contracts_for_user(db, user):
            _create_notification_if_new(
                db, user, NotificationType.CONTRACT_EXPIRING,
                f"Lejáró szerződés: {contract.contract_number}",
                f"Szerződés {contract.contract_number} lejárati dátuma: {contract.end_date.isoformat()}",
                None,
            )
        if not overdue and not upcoming:
            continue
        subject, body = render_digest(user, overdue, upcoming)
        send_email(user.email, subject, body)
        sent += 1
    db.commit()
    return sent
