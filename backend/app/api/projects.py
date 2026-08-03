from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
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
    Favorite,
    Project,
    ProjectStatus,
    User,
    UserRole,
)
from app.schemas import (
    ActivityCreate,
    ActivityResponse,
    ActivityUpdate,
    DependencyCreate,
    ProjectCard,
    ProjectCreate,
    ProjectDetail,
    ProjectUpdate,
)
from app.services.audit import log_change
from app.services.geocoding import geocode_project_in_background
from app.services.health import compute_health_for_projects, predict_delay_risk
from app.services.numbering import generate_project_code
from app.services.schedule_engine import cascade_from_activity, create_project_activities, recalculate_schedule

router = APIRouter(prefix="/projects", tags=["projects"])

STATUS_ORDER = list(ProjectStatus)


def _project_to_card(
    project: Project, favorite_ids: set[int] = frozenset(), health_map: dict[int, str] | None = None
) -> ProjectCard:
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
        has_thumbnail=project.has_thumbnail,
        is_favorite=project.id in favorite_ids,
        health=(health_map or {}).get(project.id, "ok"),
        latitude=project.latitude,
        longitude=project.longitude,
        waiting_deadline=project.waiting_deadline,
        planning_deadline=project.planning_deadline,
        foundation_deadline=project.foundation_deadline,
        structure_deadline=project.structure_deadline,
        exterior_done_deadline=project.exterior_done_deadline,
        turnkey_deadline=project.turnkey_deadline,
    )


def _schedule_geocode_if_needed(
    background_tasks: BackgroundTasks,
    has_coords: bool,
    project_id: int,
    settlement: str,
    address: str,
) -> None:
    """Kick off a background re-geocode unless the project already has (or
    was just given) coordinates for its current address. Shared by
    create_project and update_project so the two call sites can't drift.
    """
    if not has_coords:
        background_tasks.add_task(geocode_project_in_background, project_id, settlement, address)


def _favorite_ids(db: Session, user: User) -> set[int]:
    return {
        row.project_id
        for row in db.query(Favorite.project_id).filter(Favorite.user_id == user.id).all()
    }


def _can_view_project(user: User, project: Project) -> bool:
    if user.role in (UserRole.ADMIN, UserRole.MANAGEMENT):
        return True
    if user.role == UserRole.PROJECT_MANAGER:
        return project.project_manager_id == user.id
    if user.role == UserRole.SITE_MANAGER:
        return project.site_manager_id == user.id
    return True


def _can_edit_project(user: User, project: Project) -> bool:
    if user.role in (UserRole.ADMIN, UserRole.MANAGEMENT):
        return True
    if user.role == UserRole.PROJECT_MANAGER:
        return project.project_manager_id == user.id
    if user.role == UserRole.SITE_MANAGER:
        return project.site_manager_id == user.id
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
    elif user.role == UserRole.SITE_MANAGER:
        q = q.filter(Project.site_manager_id == user.id)
    projects = q.order_by(Project.delivery_date).all()
    favorite_ids = _favorite_ids(db, user)
    health_map = compute_health_for_projects(db, projects)
    return [_project_to_card(p, favorite_ids, health_map) for p in projects]


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
    elif user.role == UserRole.SITE_MANAGER:
        q = q.filter(Project.site_manager_id == user.id)
    projects = q.all()
    favorite_ids = _favorite_ids(db, user)
    health_map = compute_health_for_projects(db, projects)
    statuses = list(ProjectStatus)
    # Lezárva is a separate function for admin/management/project_manager
    # only — other roles never see the column at all, not just "can't drag
    # into it".
    if user.role not in (UserRole.ADMIN, UserRole.MANAGEMENT, UserRole.PROJECT_MANAGER):
        statuses = [s for s in statuses if s != ProjectStatus.CLOSED]
    board = {s.value: [] for s in statuses}
    for p in projects:
        if p.status.value in board:
            board[p.status.value].append(_project_to_card(p, favorite_ids, health_map))
    return board


@router.post("/{project_id}/favorite")
def add_favorite(
    project_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    project = db.query(Project).get(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if not _can_view_project(user, project):
        raise HTTPException(status_code=403, detail="Access denied")
    existing = db.query(Favorite).filter(
        Favorite.user_id == user.id, Favorite.project_id == project_id
    ).first()
    if not existing:
        db.add(Favorite(user_id=user.id, project_id=project_id))
        db.commit()
    return {"ok": True}


@router.delete("/{project_id}/favorite")
def remove_favorite(
    project_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    db.query(Favorite).filter(
        Favorite.user_id == user.id, Favorite.project_id == project_id
    ).delete()
    db.commit()
    return {"ok": True}


@router.post("", response_model=ProjectDetail)
def create_project(
    body: ProjectCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.ADMIN, UserRole.MANAGEMENT, UserRole.PROJECT_MANAGER, UserRole.SITE_MANAGER)),
):
    project_code = body.project_code
    if project_code:
        if db.query(Project).filter(Project.project_code == project_code).first():
            raise HTTPException(status_code=400, detail="Project code already exists")
    else:
        project_code = generate_project_code(db, body.building_type)
    project = Project(**{**body.model_dump(exclude={"with_schedule", "project_code"}), "project_code": project_code})
    if user.role == UserRole.PROJECT_MANAGER and not project.project_manager_id:
        project.project_manager_id = user.id
    elif user.role == UserRole.SITE_MANAGER and not project.site_manager_id:
        project.site_manager_id = user.id
    db.add(project)
    db.flush()
    if body.with_schedule:
        create_project_activities(db, project)
        recalculate_schedule(db, project)
    log_change(db, user, "project", "created", None, project.name, project.id, project.id)
    db.commit()
    db.refresh(project)
    _schedule_geocode_if_needed(
        background_tasks,
        project.latitude is not None or project.longitude is not None,
        project.id, project.settlement, project.address,
    )
    return _get_project_detail(db, project.id, user)


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
    return _get_project_detail(db, project_id, user)


def _get_project_detail(db: Session, project_id: int, user: User | None = None) -> ProjectDetail:
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
    is_favorite = False
    if user is not None:
        is_favorite = (
            db.query(Favorite)
            .filter(Favorite.user_id == user.id, Favorite.project_id == project_id)
            .first()
            is not None
        )
    health = compute_health_for_projects(db, [project]).get(project.id, "ok")
    delay_risk, delay_risk_reason = predict_delay_risk(db, project)
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
        has_thumbnail=project.has_thumbnail,
        is_favorite=is_favorite,
        health=health,
        delay_risk=delay_risk,
        delay_risk_reason=delay_risk_reason,
        latitude=project.latitude,
        longitude=project.longitude,
        waiting_deadline=project.waiting_deadline,
        planning_deadline=project.planning_deadline,
        foundation_deadline=project.foundation_deadline,
        structure_deadline=project.structure_deadline,
        exterior_done_deadline=project.exterior_done_deadline,
        turnkey_deadline=project.turnkey_deadline,
        address=project.address,
        lot_number=project.lot_number,
        client_phone=project.client_phone,
        client_email=project.client_email,
        client_phone_2=project.client_phone_2,
        client_email_2=project.client_email_2,
        project_manager_id=project.project_manager_id,
        site_manager_id=project.site_manager_id,
        procurement_id=project.procurement_id,
        procurement_name=project.procurement.full_name if project.procurement else None,
        billing_id=project.billing_id,
        billing_name=project.billing.full_name if project.billing else None,
        subcontractors=project.subcontractors,
        status_text=project.status_text,
        created_at=project.created_at,
        updated_at=project.updated_at,
    )


@router.patch("/{project_id}", response_model=ProjectDetail)
def update_project(
    project_id: int,
    body: ProjectUpdate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    project = db.query(Project).get(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if not _can_edit_project(user, project):
        raise HTTPException(status_code=403, detail="Access denied")
    # Lezárás ("closed") is a separate, more restricted function than the
    # rest of the kanban board — site_manager/procurement/billing/
    # subcontractor never see or use it, even if they can otherwise edit
    # this project.
    if body.status == ProjectStatus.CLOSED and user.role not in (
        UserRole.ADMIN, UserRole.MANAGEMENT, UserRole.PROJECT_MANAGER,
    ):
        raise HTTPException(status_code=403, detail="Access denied")
    old_latitude, old_longitude = project.latitude, project.longitude
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
    # Address/settlement changing clears the now-stale pin automatically (see
    # Project's before_update hook in models.py) unless the caller supplied
    # both new coordinates of their own — log that side effect here, while we
    # still have request/user context, and decide whether to re-geocode.
    location_changed = "settlement" in changed_fields or "address" in changed_fields
    coords_supplied = "latitude" in updates and "longitude" in updates
    if location_changed and not coords_supplied and (old_latitude is not None or old_longitude is not None):
        log_change(db, user, "project", "latitude", str(old_latitude), None, project.id, project.id)
        log_change(db, user, "project", "longitude", str(old_longitude), None, project.id, project.id)
    # Capture the new address before committing — SessionLocal's default
    # expire_on_commit means reading these off `project` after db.commit()
    # would force an implicit re-SELECT that fails if the row was deleted
    # concurrently in that window.
    settlement, address = project.settlement, project.address
    db.commit()
    if location_changed:
        _schedule_geocode_if_needed(background_tasks, coords_supplied, project_id, settlement, address)
    return _get_project_detail(db, project_id, user)


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


@router.post("/{project_id}/activities", response_model=ActivityResponse)
def create_activity(
    project_id: int,
    body: ActivityCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    project = db.query(Project).get(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if not _can_edit_project(user, project):
        raise HTTPException(status_code=403, detail="Access denied")
    max_sort = (
        db.query(Activity)
        .filter(Activity.project_id == project_id, Activity.is_archived.is_(False))
        .count()
    )
    activity = Activity(
        project_id=project_id,
        name=body.name,
        duration_days=body.duration_days,
        prep_days=body.prep_days,
        responsible_role=body.responsible_role,
        assignee_id=body.assignee_id,
        sort_order=max_sort,
        category=body.category,
        documentation_subtype=body.documentation_subtype,
        notes=body.notes,
        status_text=body.status_text,
        reminder_date=body.reminder_date,
    )
    db.add(activity)
    db.flush()
    log_change(db, user, "activity", "created", None, activity.name, project.id, activity.id)
    recalculate_schedule(db, project)
    db.commit()
    db.refresh(activity)
    return ActivityResponse(
        id=activity.id,
        name=activity.name,
        duration_days=activity.duration_days,
        prep_days=activity.prep_days,
        responsible_role=activity.responsible_role,
        assignee_id=activity.assignee_id,
        assignee_name=activity.assignee.full_name if activity.assignee else None,
        start_date=activity.start_date,
        end_date=activity.end_date,
        prep_date=activity.prep_date,
        status=activity.status,
        is_active=activity.is_active,
        sort_order=activity.sort_order,
        prerequisite_ids=[],
        category=activity.category,
        documentation_subtype=activity.documentation_subtype,
        notes=activity.notes,
        status_text=activity.status_text,
        reminder_date=activity.reminder_date,
    )


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
        .options(joinedload(Activity.assignee))
        .filter(Activity.project_id == project_id, Activity.is_archived.is_(False))
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
                assignee_id=a.assignee_id,
                assignee_name=a.assignee.full_name if a.assignee else None,
                start_date=a.start_date,
                end_date=a.end_date,
                prep_date=a.prep_date,
                status=a.status,
                is_active=a.is_active,
                sort_order=a.sort_order,
                prerequisite_ids=[d.prerequisite_id for d in deps],
                category=a.category,
                documentation_subtype=a.documentation_subtype,
                notes=a.notes,
                status_text=a.status_text,
                reminder_date=a.reminder_date,
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
    reordered = False

    if "sort_order" in updates:
        # `sort_order` in the request is the 1-based position the caller
        # wants this activity moved to among ALL of the project's activities
        # (active or not, matching list_activities' ordering) — not a raw
        # column value. Move it there and resequence every sibling to a
        # dense 0..n-1 range so the stored sort_order always stays gapless
        # and unique, whether the reorder came from dragging a kanban-style
        # row or editing the position number directly.
        requested_position = updates.pop("sort_order")
        siblings = (
            db.query(Activity)
            .filter(Activity.project_id == project_id, Activity.is_archived.is_(False))
            .order_by(Activity.sort_order)
            .all()
        )
        siblings.remove(activity)
        insert_at = max(0, min(requested_position - 1, len(siblings)))
        siblings.insert(insert_at, activity)
        for idx, sib in enumerate(siblings):
            if sib.sort_order != idx:
                log_change(
                    db, user, "activity", "sort_order",
                    str(sib.sort_order), str(idx), project.id, sib.id,
                )
                sib.sort_order = idx
        reordered = True

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
    elif "duration_days" in updates or "prep_days" in updates or "is_active" in updates or reordered:
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
        assignee_id=activity.assignee_id,
        assignee_name=activity.assignee.full_name if activity.assignee else None,
        start_date=activity.start_date,
        end_date=activity.end_date,
        prep_date=activity.prep_date,
        status=activity.status,
        is_active=activity.is_active,
        sort_order=activity.sort_order,
        prerequisite_ids=[d.prerequisite_id for d in deps],
        category=activity.category,
        documentation_subtype=activity.documentation_subtype,
        notes=activity.notes,
        status_text=activity.status_text,
        reminder_date=activity.reminder_date,
    )


@router.delete("/{project_id}/activities/{activity_id}")
def delete_activity(
    project_id: int,
    activity_id: int,
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
    if not activity or activity.is_archived:
        raise HTTPException(status_code=404, detail="Activity not found")

    blockers = (
        db.query(Activity)
        .join(ActivityDependency, ActivityDependency.activity_id == Activity.id)
        .filter(
            ActivityDependency.prerequisite_id == activity_id,
            Activity.is_active.is_(True),
            Activity.is_archived.is_(False),
        )
        .all()
    )
    if blockers:
        names = ", ".join(b.name for b in blockers)
        raise HTTPException(
            status_code=400,
            detail=f"A tevékenység nem törölhető, mert az alábbi aktív tevékenységek függenek tőle: {names}",
        )

    log_change(db, user, "activity", "deleted", activity.name, None, project.id, activity.id)
    activity.is_archived = True
    activity.is_active = False
    activity.start_date = None
    activity.end_date = None
    activity.prep_date = None
    db.flush()
    recalculate_schedule(db, project)
    db.commit()
    return {"ok": True}


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

