import logging
import smtplib
from datetime import date, timedelta
from email.mime.text import MIMEText

from sqlalchemy.orm import Session

from app.config import settings
from app.models import Activity, ActivityStatus, Project, User
from app.services.scoping import scoped_activity_query

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


def send_daily_digest(db: Session) -> int:
    sent = 0
    users = db.query(User).filter(User.is_active.is_(True)).all()
    for user in users:
        overdue, upcoming = get_user_digest_items(db, user)
        if not overdue and not upcoming:
            continue
        subject, body = render_digest(user, overdue, upcoming)
        send_email(user.email, subject, body)
        sent += 1
    return sent
