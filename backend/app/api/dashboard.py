from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Activity, ActivityStatus, AuditLog, Project, ProjectStatus, User, UserRole
from app.models_crm import CommunicationEvent, Contract, CrmTask, Customer, Quote
from app.schemas import AuditLogResponse, DashboardStats, ProjectCard, WeeklyWorkloadItem
from app.services.scoping import (
    scoped_communication_event_query,
    scoped_contract_query,
    scoped_crm_task_query,
    scoped_customer_query,
    scoped_quote_query,
)

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

    slipping = projects_q.filter(
        Project.delivery_date < today,
        Project.status != ProjectStatus.TURNKEY,
    ).count()

    # "On time" is approximated from the data we actually have — there's no
    # separate actual-handover-date field, so we treat any non-turnkey project
    # whose target delivery_date hasn't passed yet as "on track". Turnkey
    # projects are excluded from the denominator (already delivered).
    active_projects = projects_q.filter(Project.status != ProjectStatus.TURNKEY).count()
    on_time_pct = round(((active_projects - slipping) / active_projects) * 100, 1) if active_projects else 100.0

    month_start = today.replace(day=1)
    next_month_start = (month_start + timedelta(days=32)).replace(day=1)
    handovers_this_month = projects_q.filter(
        Project.status == ProjectStatus.TURNKEY,
        Project.delivery_date >= month_start,
        Project.delivery_date < next_month_start,
    ).count()

    open_prep_tasks_total = activities_q.filter(
        Activity.prep_date.isnot(None),
        Activity.status != ActivityStatus.DONE,
    ).count()

    weekly_workload: list[WeeklyWorkloadItem] = []
    for i in range(4):
        week_start = today + timedelta(days=7 * i)
        week_end = week_start + timedelta(days=6)
        count = activities_q.filter(
            Activity.start_date >= week_start,
            Activity.start_date <= week_end,
        ).count()
        weekly_workload.append(WeeklyWorkloadItem(week_start=week_start, activity_count=count))

    return DashboardStats(
        overdue_tasks=overdue,
        upcoming_prep_7d=prep_7,
        upcoming_prep_14d=prep_14,
        slipping_projects=slipping,
        total_projects=projects_q.count(),
        on_time_delivery_pct=on_time_pct,
        handovers_this_month=handovers_this_month,
        open_prep_tasks_total=open_prep_tasks_total,
        weekly_workload=weekly_workload,
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
    user: User = Depends(get_current_user),
):
    from app.services.scoping import can_view_project

    q = (
        db.query(AuditLog)
        .options(joinedload(AuditLog.user), joinedload(AuditLog.project))
        .order_by(AuditLog.created_at.desc())
    )
    if project_id:
        project = db.query(Project).get(project_id)
        if not project or not can_view_project(user, project):
            raise HTTPException(status_code=403, detail="Access denied")
        q = q.filter(AuditLog.project_id == project_id)
    elif user.role in (UserRole.PROJECT_MANAGER, UserRole.SITE_MANAGER):
        # Project-scoped entries (project_id set) are matched via an owned
        # project id list rather than a JOIN, since a JOIN would silently drop
        # CRM audit entries below (they always have project_id NULL — CRM
        # ownership is scoped per entity type instead, following each
        # entity's own owner chain, same as the scoped_*_query helpers).
        owner_col = (
            Project.project_manager_id
            if user.role == UserRole.PROJECT_MANAGER
            else Project.site_manager_id
        )
        owned_project_ids = db.query(Project.id).filter(owner_col == user.id)
        q = q.filter(
            or_(
                AuditLog.project_id.in_(owned_project_ids),
                (AuditLog.entity_type == "customer")
                & AuditLog.entity_id.in_(scoped_customer_query(db, user).with_entities(Customer.id)),
                (AuditLog.entity_type == "quote")
                & AuditLog.entity_id.in_(scoped_quote_query(db, user).with_entities(Quote.id)),
                (AuditLog.entity_type == "contract")
                & AuditLog.entity_id.in_(scoped_contract_query(db, user).with_entities(Contract.id)),
                (AuditLog.entity_type == "communication_event")
                & AuditLog.entity_id.in_(
                    scoped_communication_event_query(db, user).with_entities(CommunicationEvent.id)
                ),
                (AuditLog.entity_type == "crm_task")
                & AuditLog.entity_id.in_(scoped_crm_task_query(db, user).with_entities(CrmTask.id)),
            )
        )
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
