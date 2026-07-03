from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.api.documents import get_s3_client
from app.config import settings
from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models import (
    Activity,
    ActivityDependency,
    ActivityStatus,
    Document,
    Project,
    ProjectStatus,
    User,
    UserRole,
)
from app.schemas import (
    ActivityResponse,
    ActivityUpdate,
    DependencyCreate,
    ProjectCard,
    ProjectCreate,
    ProjectDetail,
    ProjectUpdate,
)
from app.services.audit import log_change
from app.services.schedule_engine import cascade_from_activity, create_project_activities, recalculate_schedule

router = APIRouter(prefix="/projects", tags=["projects"])

STATUS_ORDER = list(ProjectStatus)


def _project_to_card(project: Project) -> ProjectCard:
    return ProjectCard(
        id=project.id,
        name=project.name,
        project_code=project.project_code,
        settlement=project.settlement,
        client_name=project.client_name,
        building_type=project.building_type,
        floor_area_sqm=project.floor_area_sqm,
        status=project.status,
        delivery_date=project.delivery_date,
        completion_percent=project.completion_percent,
        project_manager_name=project.project_manager.full_name if project.project_manager else None,
        site_manager_name=project.site_manager.full_name if project.site_manager else None,
    )


def _can_view_project(user: User, project: Project) -> bool:
    if user.role in (UserRole.ADMIN, UserRole.MANAGEMENT):
        return True
    if user.role == UserRole.PROJECT_MANAGER:
        return project.project_manager_id == user.id
    return True


def _can_edit_project(user: User, project: Project) -> bool:
    if user.role in (UserRole.ADMIN, UserRole.MANAGEMENT):
        return True
    if user.role == UserRole.PROJECT_MANAGER:
        return project.project_manager_id == user.id
    return False


@router.get("", response_model=list[ProjectCard])
def list_projects(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = db.query(Project).options(
        joinedload(Project.project_manager), joinedload(Project.site_manager)
    )
    if user.role == UserRole.PROJECT_MANAGER:
        q = q.filter(Project.project_manager_id == user.id)
    projects = q.order_by(Project.delivery_date).all()
    return [_project_to_card(p) for p in projects]


@router.get("/kanban")
def kanban_board(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = db.query(Project).options(
        joinedload(Project.project_manager), joinedload(Project.site_manager)
    )
    if user.role == UserRole.PROJECT_MANAGER:
        q = q.filter(Project.project_manager_id == user.id)
    projects = q.all()
    board = {s.value: [] for s in ProjectStatus}
    for p in projects:
        board[p.status.value].append(_project_to_card(p))
    return board


@router.post("", response_model=ProjectDetail)
def create_project(
    body: ProjectCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.ADMIN, UserRole.MANAGEMENT, UserRole.PROJECT_MANAGER)),
):
    if db.query(Project).filter(Project.project_code == body.project_code).first():
        raise HTTPException(status_code=400, detail="Project code already exists")
    project = Project(**body.model_dump())
    if user.role == UserRole.PROJECT_MANAGER and not project.project_manager_id:
        project.project_manager_id = user.id
    db.add(project)
    db.flush()
    create_project_activities(db, project)
    recalculate_schedule(db, project)
    log_change(db, user, "project", "created", None, project.name, project.id, project.id)
    db.commit()
    db.refresh(project)
    return _get_project_detail(db, project.id)


@router.get("/{project_id}", response_model=ProjectDetail)
def get_project(
    project_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    project = db.query(Project).options(joinedload(Project.project_manager)).get(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if not _can_view_project(user, project):
        raise HTTPException(status_code=403, detail="Access denied")
    return _get_project_detail(db, project_id)


def _get_project_detail(db: Session, project_id: int) -> ProjectDetail:
    project = (
        db.query(Project)
        .options(
            joinedload(Project.project_manager),
            joinedload(Project.site_manager),
            joinedload(Project.procurement),
            joinedload(Project.billing),
        )
        .get(project_id)
    )
    return ProjectDetail(
        id=project.id,
        name=project.name,
        project_code=project.project_code,
        settlement=project.settlement,
        client_name=project.client_name,
        building_type=project.building_type,
        floor_area_sqm=project.floor_area_sqm,
        status=project.status,
        delivery_date=project.delivery_date,
        completion_percent=project.completion_percent,
        project_manager_name=project.project_manager.full_name if project.project_manager else None,
        site_manager_name=project.site_manager.full_name if project.site_manager else None,
        address=project.address,
        lot_number=project.lot_number,
        client_phone=project.client_phone,
        client_email=project.client_email,
        project_manager_id=project.project_manager_id,
        site_manager_id=project.site_manager_id,
        procurement_id=project.procurement_id,
        procurement_name=project.procurement.full_name if project.procurement else None,
        billing_id=project.billing_id,
        billing_name=project.billing.full_name if project.billing else None,
        subcontractors=project.subcontractors,
        created_at=project.created_at,
        updated_at=project.updated_at,
    )


@router.patch("/{project_id}", response_model=ProjectDetail)
def update_project(
    project_id: int,
    body: ProjectUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    project = db.query(Project).get(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if not _can_edit_project(user, project):
        raise HTTPException(status_code=403, detail="Access denied")
    updates = body.model_dump(exclude_unset=True)
    changed_fields = set()
    for field, value in updates.items():
        old = getattr(project, field)
        if old != value:
            log_change(
                db, user, "project", field,
                str(old) if old is not None else None,
                str(value) if value is not None else None,
                project.id, project.id,
            )
            setattr(project, field, value)
            changed_fields.add(field)
    if "delivery_date" in changed_fields:
        recalculate_schedule(db, project)
    db.commit()
    return _get_project_detail(db, project_id)


@router.delete("/{project_id}")
def delete_project(
    project_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    project = db.query(Project).get(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if not _can_edit_project(user, project):
        raise HTTPException(status_code=403, detail="Access denied")

    # Dependency rows (on both the activity_id and prerequisite_id side) and
    # audit log rows are cleaned up by the DB itself via ondelete=CASCADE /
    # ondelete=SET NULL on those foreign keys (see models.py + migration
    # 69cf170f42ab) — no need to pre-delete/null them by hand here.
    documents = db.query(Document).filter(Document.project_id == project_id).all()
    if documents:
        client = get_s3_client()
        for doc in documents:
            try:
                client.delete_object(Bucket=settings.s3_bucket, Key=doc.s3_key)
            except Exception:
                pass

    log_change(db, user, "project", "deleted", project.name, None, project_id, project_id)

    project_name = project.name
    db.delete(project)
    db.commit()
    return {"ok": True, "deleted": project_name}


@router.get("/{project_id}/activities", response_model=list[ActivityResponse])
def list_activities(
    project_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    project = db.query(Project).get(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if not _can_view_project(user, project):
        raise HTTPException(status_code=403, detail="Access denied")
    activities = (
        db.query(Activity)
        .filter(Activity.project_id == project_id)
        .order_by(Activity.sort_order)
        .all()
    )
    result = []
    for a in activities:
        deps = db.query(ActivityDependency).filter(ActivityDependency.activity_id == a.id).all()
        result.append(
            ActivityResponse(
                id=a.id,
                name=a.name,
                duration_days=a.duration_days,
                prep_days=a.prep_days,
                responsible_role=a.responsible_role,
                start_date=a.start_date,
                end_date=a.end_date,
                prep_date=a.prep_date,
                status=a.status,
                is_active=a.is_active,
                prerequisite_ids=[d.prerequisite_id for d in deps],
            )
        )
    return result


@router.patch("/{project_id}/activities/{activity_id}", response_model=ActivityResponse)
def update_activity(
    project_id: int,
    activity_id: int,
    body: ActivityUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    project = db.query(Project).get(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if not _can_edit_project(user, project):
        raise HTTPException(status_code=403, detail="Access denied")
    activity = db.query(Activity).filter(
        Activity.id == activity_id, Activity.project_id == project_id
    ).first()
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")
    updates = body.model_dump(exclude_unset=True)

    if updates.get("is_active") is False and activity.is_active:
        blockers = (
            db.query(Activity)
            .join(ActivityDependency, ActivityDependency.activity_id == Activity.id)
            .filter(
                ActivityDependency.prerequisite_id == activity_id,
                Activity.is_active.is_(True),
            )
            .all()
        )
        if blockers:
            names = ", ".join(b.name for b in blockers)
            raise HTTPException(
                status_code=400,
                detail=f"A tevékenység nem tiltható le, mert az alábbi aktív tevékenységek függenek tőle: {names}",
            )

    for field, value in updates.items():
        old = getattr(activity, field)
        if old != value:
            log_change(
                db, user, "activity", field,
                str(old) if old is not None else None,
                str(value) if value is not None else None,
                project.id, activity.id,
            )
            setattr(activity, field, value)
    db.flush()

    if updates.get("is_active") is False:
        activity.start_date = None
        activity.end_date = None
        activity.prep_date = None
        db.flush()

    if "start_date" in updates:
        cascade_from_activity(db, project, activity)
    elif "duration_days" in updates or "prep_days" in updates or "is_active" in updates:
        recalculate_schedule(db, project)
    else:
        done = db.query(Activity).filter(
            Activity.project_id == project_id, Activity.status == ActivityStatus.DONE,
            Activity.is_active.is_(True),
        ).count()
        total = db.query(Activity).filter(
            Activity.project_id == project_id, Activity.is_active.is_(True),
        ).count()
        project.completion_percent = round((done / total) * 100, 1) if total else 0
    db.commit()
    deps = db.query(ActivityDependency).filter(ActivityDependency.activity_id == activity.id).all()
    return ActivityResponse(
        id=activity.id,
        name=activity.name,
        duration_days=activity.duration_days,
        prep_days=activity.prep_days,
        responsible_role=activity.responsible_role,
        start_date=activity.start_date,
        end_date=activity.end_date,
        prep_date=activity.prep_date,
        status=activity.status,
        is_active=activity.is_active,
        prerequisite_ids=[d.prerequisite_id for d in deps],
    )


@router.post("/{project_id}/activities/{activity_id}/dependencies")
def add_dependency(
    project_id: int,
    activity_id: int,
    body: DependencyCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    project = db.query(Project).get(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if not _can_edit_project(user, project):
        raise HTTPException(status_code=403, detail="Access denied")
    if activity_id == body.prerequisite_id:
        raise HTTPException(status_code=400, detail="An activity cannot depend on itself")
    activity = db.query(Activity).filter(
        Activity.id == activity_id, Activity.project_id == project_id
    ).first()
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")
    prereq = db.query(Activity).filter(
        Activity.id == body.prerequisite_id, Activity.project_id == project_id
    ).first()
    if not prereq:
        raise HTTPException(status_code=404, detail="Prerequisite not found")
    existing = db.query(ActivityDependency).filter(
        ActivityDependency.activity_id == activity_id,
        ActivityDependency.prerequisite_id == body.prerequisite_id,
    ).first()
    if not existing:
        db.add(ActivityDependency(activity_id=activity_id, prerequisite_id=body.prerequisite_id))
        log_change(
            db, user, "activity_dependency", "added", None, prereq.name,
            project_id, activity.id,
        )
    recalculate_schedule(db, project)
    db.commit()
    return {"ok": True}


@router.delete("/{project_id}/activities/{activity_id}/dependencies/{prerequisite_id}")
def remove_dependency(
    project_id: int,
    activity_id: int,
    prerequisite_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    project = db.query(Project).get(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if not _can_edit_project(user, project):
        raise HTTPException(status_code=403, detail="Access denied")
    activity = db.query(Activity).filter(
        Activity.id == activity_id, Activity.project_id == project_id
    ).first()
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")
    dependency = db.query(ActivityDependency).filter(
        ActivityDependency.activity_id == activity_id,
        ActivityDependency.prerequisite_id == prerequisite_id,
    ).first()
    if not dependency:
        raise HTTPException(status_code=404, detail="Dependency not found")
    prereq = db.query(Activity).get(prerequisite_id)
    db.delete(dependency)
    log_change(
        db, user, "activity_dependency", "removed",
        prereq.name if prereq else str(prerequisite_id), None,
        project_id, activity_id,
    )
    recalculate_schedule(db, project)
    db.commit()
    return {"ok": True}


@router.post("/{project_id}/recalculate")
def recalculate(
    project_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    project = db.query(Project).get(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if not _can_edit_project(user, project):
        raise HTTPException(status_code=403, detail="Access denied")
    recalculate_schedule(db, project)
    db.commit()
    return {"ok": True}

