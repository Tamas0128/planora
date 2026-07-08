from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Project, User, UserRole
from app.schemas import ProjectCard
from app.services.health import compute_health_for_projects

router = APIRouter(tags=["search"])


@router.get("/search", response_model=list[ProjectCard])
def search_projects(
    q: str = Query(..., min_length=1),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    from app.api.projects import _favorite_ids, _project_to_card

    like = f"%{q}%"
    query = (
        db.query(Project)
        .options(joinedload(Project.project_manager), joinedload(Project.site_manager))
        .filter(
            or_(
                Project.name.ilike(like),
                Project.client_name.ilike(like),
                Project.settlement.ilike(like),
                Project.project_code.ilike(like),
                Project.lot_number.ilike(like),
                Project.project_manager.has(User.full_name.ilike(like)),
            )
        )
    )
    if user.role == UserRole.PROJECT_MANAGER:
        query = query.filter(Project.project_manager_id == user.id)
    elif user.role == UserRole.SITE_MANAGER:
        query = query.filter(Project.site_manager_id == user.id)

    projects = query.order_by(Project.name).limit(20).all()
    favorite_ids = _favorite_ids(db, user)
    health_map = compute_health_for_projects(db, projects)
    return [_project_to_card(p, favorite_ids, health_map) for p in projects]
