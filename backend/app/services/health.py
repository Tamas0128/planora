from collections import defaultdict
from datetime import date

from sqlalchemy.orm import Session

from app.models import Activity, ActivityStatus, Project

HEALTH_OK = "ok"
HEALTH_WARNING = "warning"
HEALTH_CRITICAL = "critical"


def _health_from_counts(is_late: bool, blocked_count: int, overdue_prep_count: int) -> str:
    if is_late or blocked_count > 0 or overdue_prep_count >= 3:
        return HEALTH_CRITICAL
    if overdue_prep_count > 0:
        return HEALTH_WARNING
    return HEALTH_OK


def compute_health_for_projects(db: Session, projects: list[Project]) -> dict[int, str]:
    """Rule-based Rendben/Figyelendő/Kritikus health per project.

    Heuristic (no ML/LLM — see PLANora refactor plan's "szabály-alapú AI"
    decision): a project is critical if it's already past its delivery date
    and not yet turnkey, has any blocked active activity, or has 3+ overdue
    (unstarted) prep tasks; warning if it has 1-2 overdue prep tasks;
    otherwise ok. Computed in bulk (one query for all projects' activities)
    so the kanban board and project list don't pay an N+1 query per card.
    """
    if not projects:
        return {}
    today = date.today()
    project_ids = [p.id for p in projects]
    activities = (
        db.query(Activity)
        .filter(Activity.project_id.in_(project_ids), Activity.is_active.is_(True))
        .all()
    )
    blocked_by_project: dict[int, int] = defaultdict(int)
    overdue_prep_by_project: dict[int, int] = defaultdict(int)
    for a in activities:
        if a.status == ActivityStatus.BLOCKED:
            blocked_by_project[a.project_id] += 1
        if a.prep_date and a.prep_date < today and a.status != ActivityStatus.DONE:
            overdue_prep_by_project[a.project_id] += 1

    result: dict[int, str] = {}
    for project in projects:
        is_late = project.delivery_date < today and project.status.value != "turnkey"
        result[project.id] = _health_from_counts(
            is_late, blocked_by_project.get(project.id, 0), overdue_prep_by_project.get(project.id, 0)
        )
    return result


def compute_health(db: Session, project: Project) -> str:
    return compute_health_for_projects(db, [project]).get(project.id, HEALTH_OK)


def predict_delay_risk(db: Session, project: Project) -> tuple[str, str]:
    """Rule-based (no LLM) delay-risk estimate for a single project's Áttekintés tab.

    Returns (risk, reason) where risk is "low"/"medium"/"high" — same
    ingredients as compute_health, but phrased as a forward-looking
    prediction with an explanation string instead of a status badge.
    """
    today = date.today()
    activities = (
        db.query(Activity)
        .filter(Activity.project_id == project.id, Activity.is_active.is_(True))
        .all()
    )
    blocked = [a for a in activities if a.status == ActivityStatus.BLOCKED]
    overdue_prep = [a for a in activities if a.prep_date and a.prep_date < today and a.status != ActivityStatus.DONE]
    is_late = project.delivery_date < today and project.status.value != "turnkey"
    days_left = (project.delivery_date - today).days

    reasons: list[str] = []
    if is_late:
        reasons.append("az átadási határidő már lejárt")
    if blocked:
        reasons.append(f"{len(blocked)} blokkolt tevékenység van a fő ütemtervben")
    if overdue_prep:
        reasons.append(f"{len(overdue_prep)} előkészítési feladat lejárt")
    if not is_late and 0 <= days_left <= 14 and project.completion_percent < 70:
        reasons.append(f"csak {project.completion_percent:.0f}% kész {days_left} nappal az átadás előtt")

    if is_late or blocked or len(overdue_prep) >= 3:
        risk = HEALTH_CRITICAL
    elif reasons:
        risk = HEALTH_WARNING
    else:
        risk = HEALTH_OK

    reason = "; ".join(reasons) if reasons else "Az ütemterv jelenleg nem mutat csúszásra utaló jelet."
    return risk, reason
