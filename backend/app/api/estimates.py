from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Project, User, UserRole
from app.models_estimate import (
    CostEstimateRough,
    PriceCatalogItem,
    PriceCatalogSource,
    RoughEstimateRate,
)
from app.schemas_estimate import (
    CostEstimateRoughCreate,
    CostEstimateRoughResponse,
    PriceCatalogItemCreate,
    PriceCatalogItemResponse,
    PriceCatalogItemUpdate,
    RoughEstimateRateResponse,
    RoughEstimateRateUpdate,
)
from app.services.cost_estimate import MissingRateError, calculate_rough_estimate
from app.services.scoping import can_edit_project, can_view_project

router = APIRouter(tags=["cost-estimate"])

FINANCE_ROLES = (UserRole.ADMIN, UserRole.MANAGEMENT, UserRole.BILLING)


def _require_finance_role(user: User) -> None:
    if user.role not in FINANCE_ROLES:
        raise HTTPException(status_code=403, detail="Insufficient permissions")


def _get_project_or_404(db: Session, project_id: int, user: User) -> Project:
    project = db.query(Project).get(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if not can_view_project(user, project):
        raise HTTPException(status_code=403, detail="Access denied")
    return project


def _response_from_estimate(estimate: CostEstimateRough) -> CostEstimateRoughResponse:
    resp = CostEstimateRoughResponse.model_validate(estimate)
    resp.created_by_name = estimate.created_by.full_name if estimate.created_by else None
    return resp


# --- Rate catalog (admin-managed) ------------------------------------------


@router.get("/cost-estimate-rates", response_model=list[RoughEstimateRateResponse])
def list_rough_estimate_rates(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return db.query(RoughEstimateRate).order_by(RoughEstimateRate.category).all()


@router.patch("/cost-estimate-rates/{rate_id}", response_model=RoughEstimateRateResponse)
def update_rough_estimate_rate(
    rate_id: int,
    body: RoughEstimateRateUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _require_finance_role(user)
    rate = db.query(RoughEstimateRate).get(rate_id)
    if not rate:
        raise HTTPException(status_code=404, detail="Ártétel nem található")
    for field_name, value in body.model_dump(exclude_unset=True).items():
        setattr(rate, field_name, value)
    db.commit()
    db.refresh(rate)
    return rate


# --- Rough (paraméteres) cost estimates, per project ------------------------


@router.get(
    "/projects/{project_id}/cost-estimates/rough",
    response_model=list[CostEstimateRoughResponse],
)
def list_rough_estimates(
    project_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    project = _get_project_or_404(db, project_id, user)
    estimates = (
        db.query(CostEstimateRough)
        .filter(CostEstimateRough.project_id == project.id)
        .order_by(CostEstimateRough.created_at.desc())
        .all()
    )
    return [_response_from_estimate(e) for e in estimates]


@router.post(
    "/projects/{project_id}/cost-estimates/rough",
    response_model=CostEstimateRoughResponse,
)
def create_rough_estimate(
    project_id: int,
    body: CostEstimateRoughCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    project = _get_project_or_404(db, project_id, user)
    if not can_edit_project(user, project):
        raise HTTPException(status_code=403, detail="Access denied")

    inputs = body.model_dump()
    try:
        result = calculate_rough_estimate(db, inputs, body.finish_level)
    except MissingRateError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    estimate = CostEstimateRough(
        project_id=project.id,
        created_by_id=user.id,
        breakdown=result["breakdown"],
        total_net_min=result["total_net_min"],
        total_net_max=result["total_net_max"],
        **inputs,
    )
    db.add(estimate)
    db.commit()
    db.refresh(estimate)
    return _response_from_estimate(estimate)


@router.get(
    "/projects/{project_id}/cost-estimates/rough/{estimate_id}",
    response_model=CostEstimateRoughResponse,
)
def get_rough_estimate(
    project_id: int,
    estimate_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    project = _get_project_or_404(db, project_id, user)
    estimate = (
        db.query(CostEstimateRough)
        .filter(CostEstimateRough.id == estimate_id, CostEstimateRough.project_id == project.id)
        .first()
    )
    if not estimate:
        raise HTTPException(status_code=404, detail="Becslés nem található")
    return _response_from_estimate(estimate)


@router.delete("/projects/{project_id}/cost-estimates/rough/{estimate_id}")
def delete_rough_estimate(
    project_id: int,
    estimate_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    project = _get_project_or_404(db, project_id, user)
    if not can_edit_project(user, project):
        raise HTTPException(status_code=403, detail="Access denied")
    estimate = (
        db.query(CostEstimateRough)
        .filter(CostEstimateRough.id == estimate_id, CostEstimateRough.project_id == project.id)
        .first()
    )
    if not estimate:
        raise HTTPException(status_code=404, detail="Becslés nem található")
    db.delete(estimate)
    db.commit()
    return {"ok": True}


# --- Price catalog (tételes ártábla, Phase 2) -------------------------------


@router.get("/price-catalog/chapters", response_model=list[str])
def list_price_catalog_chapters(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    rows = db.query(PriceCatalogItem.chapter).distinct().order_by(PriceCatalogItem.chapter).all()
    return [r[0] for r in rows]


@router.get("/price-catalog", response_model=list[PriceCatalogItemResponse])
def list_price_catalog_items(
    search: Optional[str] = None,
    chapter: Optional[str] = None,
    active_only: bool = True,
    limit: int = Query(50, le=200),
    offset: int = 0,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = db.query(PriceCatalogItem)
    if active_only:
        q = q.filter(PriceCatalogItem.is_active.is_(True))
    if chapter:
        q = q.filter(PriceCatalogItem.chapter == chapter)
    if search:
        like = f"%{search}%"
        q = q.filter(or_(PriceCatalogItem.code.ilike(like), PriceCatalogItem.description.ilike(like)))
    return (
        q.order_by(PriceCatalogItem.chapter, PriceCatalogItem.code)
        .offset(offset)
        .limit(limit)
        .all()
    )


@router.post("/price-catalog", response_model=PriceCatalogItemResponse)
def create_price_catalog_item(
    body: PriceCatalogItemCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _require_finance_role(user)
    item = PriceCatalogItem(**body.model_dump(), source=PriceCatalogSource.OWN)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.patch("/price-catalog/{item_id}", response_model=PriceCatalogItemResponse)
def update_price_catalog_item(
    item_id: int,
    body: PriceCatalogItemUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _require_finance_role(user)
    item = db.query(PriceCatalogItem).get(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Tétel nem található")
    for field_name, value in body.model_dump(exclude_unset=True).items():
        setattr(item, field_name, value)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/price-catalog/{item_id}")
def delete_price_catalog_item(
    item_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _require_finance_role(user)
    item = db.query(PriceCatalogItem).get(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Tétel nem található")
    db.delete(item)
    db.commit()
    return {"ok": True}
