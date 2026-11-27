from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Project, User
from app.models_project_extras import ProjectSpecItem
from app.schemas import (
    ProjectSpecImportCommitRequest,
    ProjectSpecImportParseResponse,
    ProjectSpecItemCreate,
    ProjectSpecItemResponse,
    ProjectSpecItemUpdate,
)
from app.services.audit import log_change
from app.services.project_extras_import import parse_spec_items
from app.services.scoping import can_edit_project, can_view_project

router = APIRouter(prefix="/projects", tags=["project-specs"])


def _get_project_or_404(db: Session, project_id: int) -> Project:
    project = db.query(Project).get(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.get("/{project_id}/specs", response_model=list[ProjectSpecItemResponse])
def list_spec_items(
    project_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    project = _get_project_or_404(db, project_id)
    if not can_view_project(user, project):
        raise HTTPException(status_code=403, detail="Access denied")
    return (
        db.query(ProjectSpecItem)
        .filter(ProjectSpecItem.project_id == project_id)
        .order_by(ProjectSpecItem.sort_order)
        .all()
    )


@router.post("/{project_id}/specs", response_model=ProjectSpecItemResponse)
def create_spec_item(
    project_id: int,
    body: ProjectSpecItemCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    project = _get_project_or_404(db, project_id)
    if not can_edit_project(user, project):
        raise HTTPException(status_code=403, detail="Access denied")
    max_sort = db.query(ProjectSpecItem).filter(ProjectSpecItem.project_id == project_id).count()
    item = ProjectSpecItem(project_id=project_id, sort_order=max_sort, **body.model_dump())
    db.add(item)
    db.flush()
    log_change(db, user, "project_spec_item", "created", None, item.label, project.id, item.id)
    db.commit()
    db.refresh(item)
    return item


@router.patch("/{project_id}/specs/{item_id}", response_model=ProjectSpecItemResponse)
def update_spec_item(
    project_id: int,
    item_id: int,
    body: ProjectSpecItemUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    project = _get_project_or_404(db, project_id)
    if not can_edit_project(user, project):
        raise HTTPException(status_code=403, detail="Access denied")
    item = (
        db.query(ProjectSpecItem)
        .filter(ProjectSpecItem.id == item_id, ProjectSpecItem.project_id == project_id)
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Tétel nem található")

    updates = body.model_dump(exclude_unset=True)
    if "sort_order" in updates:
        requested_position = updates.pop("sort_order")
        siblings = (
            db.query(ProjectSpecItem)
            .filter(ProjectSpecItem.project_id == project_id)
            .order_by(ProjectSpecItem.sort_order)
            .all()
        )
        siblings.remove(item)
        insert_at = max(0, min(requested_position, len(siblings)))
        siblings.insert(insert_at, item)
        for idx, sib in enumerate(siblings):
            if sib.sort_order != idx:
                sib.sort_order = idx

    for field, value in updates.items():
        setattr(item, field, value)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/{project_id}/specs/{item_id}")
def delete_spec_item(
    project_id: int,
    item_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    project = _get_project_or_404(db, project_id)
    if not can_edit_project(user, project):
        raise HTTPException(status_code=403, detail="Access denied")
    item = (
        db.query(ProjectSpecItem)
        .filter(ProjectSpecItem.id == item_id, ProjectSpecItem.project_id == project_id)
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Tétel nem található")
    db.delete(item)
    db.commit()
    return {"ok": True}


@router.post("/{project_id}/specs/import/parse", response_model=ProjectSpecImportParseResponse)
async def parse_spec_items_import(
    project_id: int,
    file: UploadFile = File(...),
    sheet: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    project = _get_project_or_404(db, project_id)
    if not can_edit_project(user, project):
        raise HTTPException(status_code=403, detail="Access denied")
    content = await file.read()
    try:
        result = parse_spec_items(file.filename or "", content, sheet)
    except Exception as exc:
        raise HTTPException(status_code=422, detail="Nem olvasható Excel-fájl.") from exc
    return ProjectSpecImportParseResponse(**result)


@router.post("/{project_id}/specs/import/commit", response_model=list[ProjectSpecItemResponse])
def commit_spec_items_import(
    project_id: int,
    body: ProjectSpecImportCommitRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    project = _get_project_or_404(db, project_id)
    if not can_edit_project(user, project):
        raise HTTPException(status_code=403, detail="Access denied")
    max_sort = db.query(ProjectSpecItem).filter(ProjectSpecItem.project_id == project_id).count()
    created: list[ProjectSpecItem] = []
    for offset, row in enumerate(body.rows):
        item = ProjectSpecItem(project_id=project_id, sort_order=max_sort + offset, **row.model_dump())
        db.add(item)
        created.append(item)
    db.flush()
    log_change(db, user, "project_spec_item", "imported", None, f"{len(created)} tétel", project.id, None)
    db.commit()
    for item in created:
        db.refresh(item)
    return created
