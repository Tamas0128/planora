from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from app.models_estimate import (
    FinishLevel,
    FoundationType,
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
    price_economy: float
    price_standard: float
    price_premium: float
    is_active: bool
    updated_at: datetime

    model_config = {"from_attributes": True}


class RoughEstimateRateUpdate(BaseModel):
    price_economy: Optional[float] = None
    price_standard: Optional[float] = None
    price_premium: Optional[float] = None
    is_active: Optional[bool] = None


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
