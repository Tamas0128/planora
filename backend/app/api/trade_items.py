from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Project, User
from app.models_project_extras import TradeItem
from app.schemas import (
    TradeItemCreate,
    TradeItemImportCommitRequest,
    TradeItemImportParseResponse,
    TradeItemResponse,
    TradeItemUpdate,
)
from app.services.audit import log_change
from app.services.project_extras_import import parse_trade_items
from app.services.scoping import can_edit_project, can_view_project

router = APIRouter(prefix="/projects", tags=["trade-items"])


def _get_project_or_404(db: Session, project_id: int) -> Project:
    project = db.query(Project).get(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.get("/{project_id}/trade-items", response_model=list[TradeItemResponse])
def list_trade_items(
    project_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    project = _get_project_or_404(db, project_id)
    if not can_view_project(user, project):
        raise HTTPException(status_code=403, detail="Access denied")
    return (
        db.query(TradeItem)
        .filter(TradeItem.project_id == project_id)
        .order_by(TradeItem.sort_order)
        .all()
    )


@router.post("/{project_id}/trade-items", response_model=TradeItemResponse)
def create_trade_item(
    project_id: int,
    body: TradeItemCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    project = _get_project_or_404(db, project_id)
    if not can_edit_project(user, project):
        raise HTTPException(status_code=403, detail="Access denied")
    max_sort = db.query(TradeItem).filter(TradeItem.project_id == project_id).count()
    item = TradeItem(project_id=project_id, sort_order=max_sort, **body.model_dump())
    db.add(item)
    db.flush()
    log_change(db, user, "trade_item", "created", None, item.name, project.id, item.id)
    db.commit()
    db.refresh(item)
    return item


@router.patch("/{project_id}/trade-items/{item_id}", response_model=TradeItemResponse)
def update_trade_item(
    project_id: int,
    item_id: int,
    body: TradeItemUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    project = _get_project_or_404(db, project_id)
    if not can_edit_project(user, project):
        raise HTTPException(status_code=403, detail="Access denied")
    item = (
        db.query(TradeItem)
        .filter(TradeItem.id == item_id, TradeItem.project_id == project_id)
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Tétel nem található")

    updates = body.model_dump(exclude_unset=True)
    if "sort_order" in updates:
        requested_position = updates.pop("sort_order")
        siblings = (
            db.query(TradeItem)
            .filter(TradeItem.project_id == project_id)
            .order_by(TradeItem.sort_order)
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


@router.delete("/{project_id}/trade-items/{item_id}")
def delete_trade_item(
    project_id: int,
    item_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    project = _get_project_or_404(db, project_id)
    if not can_edit_project(user, project):
        raise HTTPException(status_code=403, detail="Access denied")
    item = (
        db.query(TradeItem)
        .filter(TradeItem.id == item_id, TradeItem.project_id == project_id)
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Tétel nem található")
    db.delete(item)
    db.commit()
    return {"ok": True}


@router.post("/{project_id}/trade-items/import/parse", response_model=TradeItemImportParseResponse)
async def parse_trade_items_import(
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
        result = parse_trade_items(file.filename or "", content, sheet)
    except Exception as exc:
        raise HTTPException(status_code=422, detail="Nem olvasható Excel-fájl.") from exc
    return TradeItemImportParseResponse(**result)


@router.post("/{project_id}/trade-items/import/commit", response_model=list[TradeItemResponse])
def commit_trade_items_import(
    project_id: int,
    body: TradeItemImportCommitRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    project = _get_project_or_404(db, project_id)
    if not can_edit_project(user, project):
        raise HTTPException(status_code=403, detail="Access denied")
    max_sort = db.query(TradeItem).filter(TradeItem.project_id == project_id).count()
    created: list[TradeItem] = []
    for offset, row in enumerate(body.rows):
        item = TradeItem(project_id=project_id, sort_order=max_sort + offset, **row.model_dump())
        db.add(item)
        created.append(item)
    db.flush()
    log_change(db, user, "trade_item", "imported", None, f"{len(created)} tétel", project.id, None)
    db.commit()
    for item in created:
        db.refresh(item)
    return created
