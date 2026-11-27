from datetime import date
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Project, User, UserRole
from app.models_crm import Quote, QuoteStatus, QuoteVersion
from app.models_estimate import (
    CostEstimateDetailed,
    CostEstimateDetailedItem,
    CostEstimateRough,
    PriceCatalogItem,
    PriceCatalogSource,
    RoughEstimateRate,
)
from app.schemas_estimate import (
    ChapterSubtotal,
    CostEstimateDetailedCreate,
    CostEstimateDetailedItemCreate,
    CostEstimateDetailedItemResponse,
    CostEstimateDetailedItemUpdate,
    CostEstimateDetailedResponse,
    CostEstimateDetailedSummaryResponse,
    CostEstimateDetailedUpdate,
    CostEstimateRoughCreate,
    CostEstimateRoughResponse,
    PriceCatalogImportCommitRequest,
    PriceCatalogImportCommitResponse,
    PriceCatalogImportParseResponse,
    PriceCatalogItemCreate,
    PriceCatalogItemResponse,
    PriceCatalogItemUpdate,
    RoughEstimateRateResponse,
    RoughEstimateRateUpdate,
    RoughEstimateSettingsResponse,
    RoughEstimateSettingsUpdate,
    TransferToQuoteResponse,
)
from app.services.cost_estimate import (
    MissingRateError,
    build_detailed_estimate_workbook,
    calculate_rough_estimate,
    get_or_create_settings,
)
from app.services.numbering import next_sequence_number
from app.services.price_catalog_import import build_parse_response, commit_import
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


@router.get("/cost-estimate-settings", response_model=RoughEstimateSettingsResponse)
def get_rough_estimate_settings(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return get_or_create_settings(db)


@router.patch("/cost-estimate-settings", response_model=RoughEstimateSettingsResponse)
def update_rough_estimate_settings(
    body: RoughEstimateSettingsUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _require_finance_role(user)
    settings = get_or_create_settings(db)
    for field_name, value in body.model_dump(exclude_unset=True).items():
        setattr(settings, field_name, value)
    db.commit()
    db.refresh(settings)
    return settings


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
    limit: int = Query(50, le=1000),
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


# --- TERC price-list import (Phase 3) ---------------------------------------


@router.post("/price-catalog/import/parse", response_model=PriceCatalogImportParseResponse)
async def parse_price_catalog_import(
    file: UploadFile = File(...),
    sheet: Optional[str] = Form(None),
    user: User = Depends(get_current_user),
):
    _require_finance_role(user)
    content = await file.read()
    return build_parse_response(file.filename or "", content, sheet)


@router.post("/price-catalog/import/commit", response_model=PriceCatalogImportCommitResponse)
def commit_price_catalog_import(
    body: PriceCatalogImportCommitRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _require_finance_role(user)
    if "code" not in body.mapping or "description" not in body.mapping:
        raise HTTPException(status_code=422, detail="A kód és a megnevezés oszlop hozzárendelése kötelező")
    result = commit_import(db, body.rows, body.mapping, body.source_reference)
    return PriceCatalogImportCommitResponse(**result)


# --- Detailed (tételes) budget, Phase 4 -------------------------------------


def _get_detailed_estimate_or_404(db: Session, project_id: int, estimate_id: int) -> CostEstimateDetailed:
    estimate = (
        db.query(CostEstimateDetailed)
        .options(joinedload(CostEstimateDetailed.items))
        .filter(CostEstimateDetailed.id == estimate_id, CostEstimateDetailed.project_id == project_id)
        .first()
    )
    if not estimate:
        raise HTTPException(status_code=404, detail="Költségvetés nem található")
    return estimate


def _detailed_response(estimate: CostEstimateDetailed) -> CostEstimateDetailedResponse:
    order: list[str] = []
    totals: dict[str, Decimal] = {}
    for item in estimate.items:
        if item.chapter not in totals:
            totals[item.chapter] = Decimal("0")
            order.append(item.chapter)
        totals[item.chapter] += item.line_total
    grand_total = sum(totals.values(), Decimal("0"))
    return CostEstimateDetailedResponse(
        id=estimate.id,
        project_id=estimate.project_id,
        name=estimate.name,
        notes=estimate.notes,
        items=[CostEstimateDetailedItemResponse.model_validate(i) for i in estimate.items],
        chapter_subtotals=[ChapterSubtotal(chapter=c, total=totals[c]) for c in order],
        grand_total=grand_total,
        created_by_id=estimate.created_by_id,
        created_by_name=estimate.created_by.full_name if estimate.created_by else None,
        created_at=estimate.created_at,
        updated_at=estimate.updated_at,
    )


def _detailed_summary(estimate: CostEstimateDetailed) -> CostEstimateDetailedSummaryResponse:
    grand_total = sum((i.line_total for i in estimate.items), Decimal("0"))
    return CostEstimateDetailedSummaryResponse(
        id=estimate.id,
        project_id=estimate.project_id,
        name=estimate.name,
        grand_total=grand_total,
        created_by_name=estimate.created_by.full_name if estimate.created_by else None,
        created_at=estimate.created_at,
        updated_at=estimate.updated_at,
    )


@router.get(
    "/projects/{project_id}/cost-estimates/detailed",
    response_model=list[CostEstimateDetailedSummaryResponse],
)
def list_detailed_estimates(
    project_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    project = _get_project_or_404(db, project_id, user)
    estimates = (
        db.query(CostEstimateDetailed)
        .options(joinedload(CostEstimateDetailed.items))
        .filter(CostEstimateDetailed.project_id == project.id)
        .order_by(CostEstimateDetailed.created_at.desc())
        .all()
    )
    return [_detailed_summary(e) for e in estimates]


@router.post(
    "/projects/{project_id}/cost-estimates/detailed",
    response_model=CostEstimateDetailedResponse,
)
def create_detailed_estimate(
    project_id: int,
    body: CostEstimateDetailedCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    project = _get_project_or_404(db, project_id, user)
    if not can_edit_project(user, project):
        raise HTTPException(status_code=403, detail="Access denied")
    estimate = CostEstimateDetailed(
        project_id=project.id, name=body.name, notes=body.notes, created_by_id=user.id
    )
    db.add(estimate)
    db.commit()
    db.refresh(estimate)
    return _detailed_response(estimate)


@router.get(
    "/projects/{project_id}/cost-estimates/detailed/{estimate_id}",
    response_model=CostEstimateDetailedResponse,
)
def get_detailed_estimate(
    project_id: int,
    estimate_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    project = _get_project_or_404(db, project_id, user)
    estimate = _get_detailed_estimate_or_404(db, project.id, estimate_id)
    return _detailed_response(estimate)


@router.patch(
    "/projects/{project_id}/cost-estimates/detailed/{estimate_id}",
    response_model=CostEstimateDetailedResponse,
)
def update_detailed_estimate(
    project_id: int,
    estimate_id: int,
    body: CostEstimateDetailedUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    project = _get_project_or_404(db, project_id, user)
    if not can_edit_project(user, project):
        raise HTTPException(status_code=403, detail="Access denied")
    estimate = _get_detailed_estimate_or_404(db, project.id, estimate_id)
    for field_name, value in body.model_dump(exclude_unset=True).items():
        setattr(estimate, field_name, value)
    db.commit()
    db.refresh(estimate)
    return _detailed_response(estimate)


@router.delete("/projects/{project_id}/cost-estimates/detailed/{estimate_id}")
def delete_detailed_estimate(
    project_id: int,
    estimate_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    project = _get_project_or_404(db, project_id, user)
    if not can_edit_project(user, project):
        raise HTTPException(status_code=403, detail="Access denied")
    estimate = _get_detailed_estimate_or_404(db, project.id, estimate_id)
    db.delete(estimate)
    db.commit()
    return {"ok": True}


@router.post(
    "/projects/{project_id}/cost-estimates/detailed/{estimate_id}/items",
    response_model=CostEstimateDetailedResponse,
)
def add_detailed_estimate_item(
    project_id: int,
    estimate_id: int,
    body: CostEstimateDetailedItemCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    project = _get_project_or_404(db, project_id, user)
    if not can_edit_project(user, project):
        raise HTTPException(status_code=403, detail="Access denied")
    estimate = _get_detailed_estimate_or_404(db, project.id, estimate_id)

    if body.catalog_item_id is not None:
        catalog_item = db.query(PriceCatalogItem).get(body.catalog_item_id)
        if not catalog_item:
            raise HTTPException(status_code=422, detail="A hivatkozott katalógustétel nem található")
        code = catalog_item.code
        description = catalog_item.description
        unit = catalog_item.unit
        chapter = catalog_item.chapter
        unit_price_material = catalog_item.unit_price_material
        unit_price_labor = catalog_item.unit_price_labor
    else:
        if not body.description or not body.unit or not body.chapter:
            raise HTTPException(
                status_code=422, detail="Egyedi tételhez a megnevezés, egység és munkanem kötelező"
            )
        code = body.code
        description = body.description
        unit = body.unit
        chapter = body.chapter
        unit_price_material = body.unit_price_material or Decimal("0")
        unit_price_labor = body.unit_price_labor or Decimal("0")

    max_sort = (
        db.query(func.max(CostEstimateDetailedItem.sort_order))
        .filter(CostEstimateDetailedItem.estimate_id == estimate.id)
        .scalar()
        or 0
    )
    item = CostEstimateDetailedItem(
        estimate_id=estimate.id,
        catalog_item_id=body.catalog_item_id,
        code=code,
        description=description,
        unit=unit,
        chapter=chapter,
        quantity=body.quantity,
        unit_price_material=unit_price_material,
        unit_price_labor=unit_price_labor,
        sort_order=max_sort + 1,
    )
    db.add(item)
    db.commit()
    db.refresh(estimate)
    return _detailed_response(estimate)


@router.patch(
    "/projects/{project_id}/cost-estimates/detailed/{estimate_id}/items/{item_id}",
    response_model=CostEstimateDetailedResponse,
)
def update_detailed_estimate_item(
    project_id: int,
    estimate_id: int,
    item_id: int,
    body: CostEstimateDetailedItemUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    project = _get_project_or_404(db, project_id, user)
    if not can_edit_project(user, project):
        raise HTTPException(status_code=403, detail="Access denied")
    estimate = _get_detailed_estimate_or_404(db, project.id, estimate_id)
    item = next((i for i in estimate.items if i.id == item_id), None)
    if not item:
        raise HTTPException(status_code=404, detail="Tétel nem található")
    for field_name, value in body.model_dump(exclude_unset=True).items():
        setattr(item, field_name, value)
    db.commit()
    db.refresh(estimate)
    return _detailed_response(estimate)


@router.delete(
    "/projects/{project_id}/cost-estimates/detailed/{estimate_id}/items/{item_id}",
    response_model=CostEstimateDetailedResponse,
)
def delete_detailed_estimate_item(
    project_id: int,
    estimate_id: int,
    item_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    project = _get_project_or_404(db, project_id, user)
    if not can_edit_project(user, project):
        raise HTTPException(status_code=403, detail="Access denied")
    estimate = _get_detailed_estimate_or_404(db, project.id, estimate_id)
    item = next((i for i in estimate.items if i.id == item_id), None)
    if not item:
        raise HTTPException(status_code=404, detail="Tétel nem található")
    db.delete(item)
    db.commit()
    db.refresh(estimate)
    return _detailed_response(estimate)


# --- Transfer to CRM Quote + XLSX export, Phase 5 ---------------------------


@router.post(
    "/projects/{project_id}/cost-estimates/detailed/{estimate_id}/transfer-to-quote",
    response_model=TransferToQuoteResponse,
)
def transfer_detailed_estimate_to_quote(
    project_id: int,
    estimate_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    project = _get_project_or_404(db, project_id, user)
    if not can_edit_project(user, project):
        raise HTTPException(status_code=403, detail="Access denied")
    if not project.customer_id:
        raise HTTPException(
            status_code=422,
            detail="A projekthez nincs ügyfél rendelve — ajánlatba viteléhez előbb rendelj hozzá ügyfelet",
        )
    estimate = _get_detailed_estimate_or_404(db, project.id, estimate_id)
    if not estimate.items:
        raise HTTPException(status_code=422, detail="A költségvetésnek nincs tétele")

    content_json = {
        "items": [
            {
                "description": item.description,
                "quantity": float(item.quantity),
                "unit": item.unit,
                "unit_price": float(item.unit_price_material + item.unit_price_labor),
            }
            for item in estimate.items
        ]
    }
    grand_total = sum((i.line_total for i in estimate.items), Decimal("0"))

    quote = Quote(
        customer_id=project.customer_id,
        quote_number=next_sequence_number(db, Quote, "quote_number", "AJ"),
        date=date.today(),
        status=QuoteStatus.DRAFT,
        current_version=1,
        value=grand_total,
    )
    db.add(quote)
    db.flush()
    version = QuoteVersion(quote_id=quote.id, version=1, content_json=content_json, created_by_id=user.id)
    db.add(version)
    db.commit()
    db.refresh(quote)
    return TransferToQuoteResponse(
        quote_id=quote.id, quote_number=quote.quote_number, customer_id=quote.customer_id
    )


@router.get("/projects/{project_id}/cost-estimates/detailed/{estimate_id}/export.xlsx")
def export_detailed_estimate_xlsx(
    project_id: int,
    estimate_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    project = _get_project_or_404(db, project_id, user)
    estimate = _get_detailed_estimate_or_404(db, project.id, estimate_id)
    content = build_detailed_estimate_workbook(estimate)
    return StreamingResponse(
        iter([content]),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=koltsegvetes_{estimate.id}.xlsx"},
    )
