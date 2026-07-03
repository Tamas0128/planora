from datetime import date, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models import Activity, ActivityStatus, AuditLog, Project, ProjectStatus, User, UserRole
from app.schemas import AuditLogResponse, DashboardStats, ProjectCard

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
    activities_q = db.query(Activity).join(Project).filter(Activity.is_active.is_(True))

    if user.role == UserRole.PROJECT_MANAGER:
        projects_q = projects_q.filter(Project.project_manager_id == user.id)
        activities_q = activities_q.filter(Project.project_manager_id == user.id)
    elif user.role == UserRole.SITE_MANAGER:
        projects_q = projects_q.filter(Project.site_manager_id == user.id)
        activities_q = activities_q.filter(Project.site_manager_id == user.id)

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


@router.get("/dashboard/slipping-projects", response_model=list[ProjectCard])
def slipping_projects(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    today = date.today()
    q = db.query(Project).options(
        joinedload(Project.project_manager), joinedload(Project.site_manager)
    ).filter(
        Project.delivery_date < today,
        Project.status != ProjectStatus.TURNKEY,
    )
    if user.role == UserRole.PROJECT_MANAGER:
        q = q.filter(Project.project_manager_id == user.id)
    elif user.role == UserRole.SITE_MANAGER:
        q = q.filter(Project.site_manager_id == user.id)
    projects = q.order_by(Project.delivery_date).all()

    from app.api.projects import _project_to_card
    return [_project_to_card(p) for p in projects]


@router.get("/audit-logs", response_model=list[AuditLogResponse])
def audit_logs(
    project_id: int | None = None,
    limit: int = 100,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN, UserRole.MANAGEMENT)),
):
    q = (
        db.query(AuditLog)
        .options(joinedload(AuditLog.user), joinedload(AuditLog.project))
        .order_by(AuditLog.created_at.desc())
    )
    if project_id:
        q = q.filter(AuditLog.project_id == project_id)
    logs = q.limit(limit).all()
    return [
        AuditLogResponse(
            id=log.id,
            user_id=log.user_id,
            user_name=log.user.full_name if log.user else None,
            project_id=log.project_id,
            project_name=log.project.name if log.project else None,
            entity_type=log.entity_type,
            entity_id=log.entity_id,
            field_name=log.field_name,
            old_value=log.old_value,
            new_value=log.new_value,
            created_at=log.created_at,
        )
        for log in logs
    ]
