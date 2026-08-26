from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel

from app.models_estimate import (
    FinishLevel,
    FoundationType,
    PriceCatalogSource,
    RoofCoveringType,
    RoughEstimateCategory,
    WallType,
)


class RoughEstimateRateResponse(BaseModel):
    id: int
    category: RoughEstimateCategory
    wall_type: Optional[WallType] = None
    roof_covering_type: Optional[RoofCoveringType] = None
    foundation_type: Optional[FoundationType] = None
    base_price: float
    unit_label: str
    is_active: bool
    updated_at: datetime

    model_config = {"from_attributes": True}


class RoughEstimateRateUpdate(BaseModel):
    base_price: Optional[float] = None
    is_active: Optional[bool] = None


class RoughEstimateSettingsResponse(BaseModel):
    economy_adjustment_pct: float
    premium_adjustment_pct: float
    updated_at: datetime

    model_config = {"from_attributes": True}


class RoughEstimateSettingsUpdate(BaseModel):
    economy_adjustment_pct: Optional[float] = None
    premium_adjustment_pct: Optional[float] = None


class CostEstimateRoughCreate(BaseModel):
    finish_level: FinishLevel
    floor_area_sqm: float
    exterior_wall_fm: float
    exterior_wall_type: WallType
    interior_wall_fm: float = 0
    interior_wall_type: WallType = WallType.LIGHT_STEEL
    has_basement: bool = False
    basement_wall_fm: float = 0
    walkable_slab_sqm: float = 0
    light_slab_sqm: float = 0
    roof_area_sqm: float
    roof_covering_type: RoofCoveringType
    foundation_type: FoundationType = FoundationType.STRIP
    notes: Optional[str] = None


class CostEstimateBreakdownLine(BaseModel):
    category: str
    wall_type: Optional[str] = None
    roof_covering_type: Optional[str] = None
    quantity: float
    unit_price: float
    line_total: float


class CostEstimateRoughResponse(BaseModel):
    id: int
    project_id: int
    finish_level: FinishLevel
    floor_area_sqm: float
    exterior_wall_fm: float
    exterior_wall_type: WallType
    interior_wall_fm: float
    interior_wall_type: WallType
    has_basement: bool
    basement_wall_fm: float
    walkable_slab_sqm: float
    light_slab_sqm: float
    roof_area_sqm: float
    roof_covering_type: RoofCoveringType
    foundation_type: FoundationType
    breakdown: list[CostEstimateBreakdownLine]
    total_net_min: float
    total_net_max: float
    notes: Optional[str] = None
    created_by_id: Optional[int] = None
    created_by_name: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# --- Price catalog (tételes ártábla, Phase 2) -------------------------------


class PriceCatalogItemCreate(BaseModel):
    code: str
    description: str
    unit: str
    chapter: str
    unit_price_material: Decimal = Decimal("0")
    unit_price_labor: Decimal = Decimal("0")
    source_reference: Optional[str] = None


class PriceCatalogItemUpdate(BaseModel):
    code: Optional[str] = None
    description: Optional[str] = None
    unit: Optional[str] = None
    chapter: Optional[str] = None
    unit_price_material: Optional[Decimal] = None
    unit_price_labor: Optional[Decimal] = None
    source_reference: Optional[str] = None
    is_active: Optional[bool] = None


class PriceCatalogItemResponse(BaseModel):
    id: int
    code: str
    description: str
    unit: str
    chapter: str
    unit_price_material: Decimal
    unit_price_labor: Decimal
    unit_price_total: Decimal
    source: PriceCatalogSource
    source_reference: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# --- Detailed (tételes) budget, Phase 4 -------------------------------------


class CostEstimateDetailedItemCreate(BaseModel):
    # Either reference a catalog row (its code/description/unit/chapter/
    # prices are snapshotted server-side) or supply every field manually —
    # exactly one of the two paths, enforced in the endpoint, not here.
    catalog_item_id: Optional[int] = None
    code: Optional[str] = None
    description: Optional[str] = None
    unit: Optional[str] = None
    chapter: Optional[str] = None
    unit_price_material: Optional[Decimal] = None
    unit_price_labor: Optional[Decimal] = None
    quantity: Decimal = Decimal("1")


class CostEstimateDetailedItemUpdate(BaseModel):
    description: Optional[str] = None
    unit: Optional[str] = None
    chapter: Optional[str] = None
    quantity: Optional[Decimal] = None
    unit_price_material: Optional[Decimal] = None
    unit_price_labor: Optional[Decimal] = None
    sort_order: Optional[int] = None


class CostEstimateDetailedItemResponse(BaseModel):
    id: int
    catalog_item_id: Optional[int] = None
    code: Optional[str] = None
    description: str
    unit: str
    chapter: str
    quantity: Decimal
    unit_price_material: Decimal
    unit_price_labor: Decimal
    line_total: Decimal
    sort_order: int

    model_config = {"from_attributes": True}


class CostEstimateDetailedCreate(BaseModel):
    name: str
    notes: Optional[str] = None


class CostEstimateDetailedUpdate(BaseModel):
    name: Optional[str] = None
    notes: Optional[str] = None


class ChapterSubtotal(BaseModel):
    chapter: str
    total: Decimal


class CostEstimateDetailedResponse(BaseModel):
    id: int
    project_id: int
    name: str
    notes: Optional[str] = None
    items: list[CostEstimateDetailedItemResponse]
    chapter_subtotals: list[ChapterSubtotal]
    grand_total: Decimal
    created_by_id: Optional[int] = None
    created_by_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class CostEstimateDetailedSummaryResponse(BaseModel):
    """Lightweight row for the per-project list view — no items, so listing
    several estimates doesn't pull every line of every one of them."""

    id: int
    project_id: int
    name: str
    grand_total: Decimal
    created_by_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TransferToQuoteResponse(BaseModel):
    quote_id: int
    quote_number: str
    customer_id: int


# --- TERC price-list import, Phase 3 ----------------------------------------


class PriceCatalogImportParseResponse(BaseModel):
    columns: list[str]
    rows: list[list[Optional[str]]]
    suggested_mapping: dict[str, int]
    row_count: int
    sheet_names: list[str] = []
    sheet_name: str = ""


class PriceCatalogImportCommitRequest(BaseModel):
    rows: list[list[Optional[str]]]
    # target field name -> 0-based column index into `rows`. Required keys:
    # code, description, unit, chapter, and either unit_price (a single
    # combined column) or unit_price_material/unit_price_labor.
    mapping: dict[str, int]
    source_reference: str


class PriceCatalogImportCommitResponse(BaseModel):
    created: int
    updated: int
    skipped: int
