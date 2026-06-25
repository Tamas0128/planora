from datetime import date, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models import Activity, ActivityStatus, AuditLog, Project, User, UserRole
from app.schemas import AuditLogResponse, DashboardStats

router = APIRouter(tags=["dashboard"])


@router.get("/dashboard/stats", response_model=DashboardStats)
def dashboard_stats(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    today = date.today()
    week = today + timedelta(days=7)
    two_weeks = today + timedelta(days=14)

    projects_q = db.query(Project)
    activities_q = db.query(Activity).join(Project)

    if user.role == UserRole.PROJECT_MANAGER:
        projects_q = projects_q.filter(Project.project_manager_id == user.id)
        activities_q = activities_q.filter(Project.project_manager_id == user.id)

    overdue = activities_q.filter(
        Activity.prep_date < today,
        Activity.status != ActivityStatus.DONE,
    ).count()

    prep_7 = activities_q.filter(
        Activity.prep_date >= today,
        Activity.prep_date <= week,
        Activity.status != ActivityStatus.DONE,
    ).count()

    prep_14 = activities_q.filter(
        Activity.prep_date >= today,
        Activity.prep_date <= two_weeks,
        Activity.status != ActivityStatus.DONE,
    ).count()

    from app.models import ProjectStatus

    slipping = projects_q.filter(
        Project.delivery_date < today,
        Project.status != ProjectStatus.TURNKEY,
    ).count()

    return DashboardStats(
        overdue_tasks=overdue,
        upcoming_prep_7d=prep_7,
        upcoming_prep_14d=prep_14,
        slipping_projects=slipping,
        total_projects=projects_q.count(),
    )


@router.get("/audit-logs", response_model=list[AuditLogResponse])
def audit_logs(
    project_id: int | None = None,
    limit: int = 100,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN, UserRole.MANAGEMENT)),
):
    q = db.query(AuditLog).order_by(AuditLog.created_at.desc())
    if project_id:
        q = q.filter(AuditLog.project_id == project_id)
    return q.limit(limit).all()
