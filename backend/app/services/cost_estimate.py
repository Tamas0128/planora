"""Rough (paraméteres) cost estimate calculation — Phase 1 of the
Költségbecslés module. Looks up admin-managed RoughEstimateRate rows and
multiplies by the estimate's input quantities; the ±ESTIMATE_BAND spread on
the total is what makes this an order-of-magnitude estimate rather than a
budget (the itemized/TERC-based budget is a separate, later phase).
"""

from sqlalchemy.orm import Session

from app.models_estimate import (
    FinishLevel,
    FoundationType,
    RoofCoveringType,
    RoughEstimateCategory,
    RoughEstimateRate,
    WallType,
)

ESTIMATE_BAND = 0.15  # ±15%

# (category, input quantity field, dimension it needs — at most one, since
# no category in this model mixes two of wall/roof-covering/foundation type)
_CATEGORY_SPECS: list[tuple[RoughEstimateCategory, str, str | None]] = [
    (RoughEstimateCategory.EARTHWORK_FOUNDATION, "floor_area_sqm", "foundation_type"),
    (RoughEstimateCategory.BASEMENT_WALL, "basement_wall_fm", None),
    (RoughEstimateCategory.EXTERIOR_WALL, "exterior_wall_fm", "exterior_wall_type"),
    (RoughEstimateCategory.INTERIOR_WALL, "interior_wall_fm", "interior_wall_type"),
    (RoughEstimateCategory.WALKABLE_SLAB, "walkable_slab_sqm", None),
    (RoughEstimateCategory.LIGHT_SLAB, "light_slab_sqm", None),
    (RoughEstimateCategory.ROOF_STRUCTURE, "roof_area_sqm", None),
    (RoughEstimateCategory.ROOF_COVERING, "roof_area_sqm", "roof_covering_type"),
    (RoughEstimateCategory.OPENINGS, "floor_area_sqm", None),
    (RoughEstimateCategory.MECHANICAL, "floor_area_sqm", None),
    (RoughEstimateCategory.ELECTRICAL, "floor_area_sqm", None),
    (RoughEstimateCategory.FINISHES, "floor_area_sqm", None),
]


class MissingRateError(Exception):
    """Raised when the admin-managed rate table has no active row for a
    category/variant combination the calculation needs — e.g. nobody has
    set up a BRICK exterior-wall rate yet. Caught by api/estimates.py and
    turned into a 422 naming the missing variant.
    """

    def __init__(self, category: RoughEstimateCategory, variant: str | None):
        self.category = category
        self.variant = variant
        super().__init__(
            f"Nincs beállítva ártábla ehhez: {category.value}"
            + (f" / {variant}" if variant else "")
        )


def calculate_rough_estimate(db: Session, inputs: dict, finish_level: FinishLevel) -> dict:
    """`inputs` carries the CostEstimateRoughCreate fields as a dict (keyed
    by the same field names, enum values already normalized to their .value
    strings or enum members — either works since we only pass them through
    to filters/dict keys). Returns {"breakdown": [...], "total_net_min":
    float, "total_net_max": float}.
    """
    breakdown = []
    total = 0.0
    for category, qty_field, dimension_field in _CATEGORY_SPECS:
        quantity = inputs.get(qty_field) or 0.0
        if quantity <= 0:
            continue

        variant = inputs.get(dimension_field) if dimension_field else None

        query = db.query(RoughEstimateRate).filter(
            RoughEstimateRate.category == category,
            RoughEstimateRate.is_active.is_(True),
        )
        query = query.filter(
            RoughEstimateRate.wall_type
            == (variant if dimension_field in ("exterior_wall_type", "interior_wall_type") else None)
        )
        query = query.filter(
            RoughEstimateRate.roof_covering_type
            == (variant if dimension_field == "roof_covering_type" else None)
        )
        query = query.filter(
            RoughEstimateRate.foundation_type
            == (variant if dimension_field == "foundation_type" else None)
        )
        rate = query.first()
        if rate is None:
            raise MissingRateError(category, variant.value if hasattr(variant, "value") else variant)

        unit_price = rate.price_for(finish_level)
        line_total = quantity * unit_price
        total += line_total
        breakdown.append(
            {
                "category": category.value,
                "wall_type": variant.value
                if dimension_field in ("exterior_wall_type", "interior_wall_type")
                else None,
                "roof_covering_type": variant.value if dimension_field == "roof_covering_type" else None,
                "quantity": quantity,
                "unit_price": unit_price,
                "line_total": round(line_total),
            }
        )

    return {
        "breakdown": breakdown,
        "total_net_min": round(total * (1 - ESTIMATE_BAND)),
        "total_net_max": round(total * (1 + ESTIMATE_BAND)),
    }


# --- Default rate seeding ---------------------------------------------------

# Illustrative Ft/m² or Ft/fm defaults (economy, standard, premium) — placeholders
# meant to make the feature usable out of the box, NOT calibrated market prices.
# An admin must review/adjust these on the rate management page before the
# rough estimate is used for anything customer-facing.
_NO_VARIANT_DEFAULTS: dict[RoughEstimateCategory, tuple[float, float, float]] = {
    RoughEstimateCategory.BASEMENT_WALL: (180_000, 230_000, 300_000),
    RoughEstimateCategory.WALKABLE_SLAB: (85_000, 105_000, 135_000),
    RoughEstimateCategory.LIGHT_SLAB: (45_000, 58_000, 75_000),
    RoughEstimateCategory.ROOF_STRUCTURE: (35_000, 45_000, 60_000),
    RoughEstimateCategory.OPENINGS: (35_000, 48_000, 65_000),
    RoughEstimateCategory.MECHANICAL: (40_000, 55_000, 75_000),
    RoughEstimateCategory.ELECTRICAL: (15_000, 20_000, 28_000),
    RoughEstimateCategory.FINISHES: (25_000, 35_000, 48_000),
}

_FOUNDATION_DEFAULTS: dict[FoundationType, tuple[float, float, float]] = {
    FoundationType.STRIP: (40_000, 55_000, 75_000),
    FoundationType.SLAB: (55_000, 70_000, 95_000),
    FoundationType.POINT: (30_000, 42_000, 58_000),
}

_EXTERIOR_WALL_DEFAULTS: dict[WallType, tuple[float, float, float]] = {
    WallType.LIGHT_STEEL: (220_000, 280_000, 360_000),
    WallType.CLT: (260_000, 330_000, 420_000),
    WallType.TIMBER_FRAME: (200_000, 260_000, 330_000),
    WallType.BRICK: (240_000, 300_000, 390_000),
}

_INTERIOR_WALL_DEFAULTS: dict[WallType, tuple[float, float, float]] = {
    WallType.LIGHT_STEEL: (45_000, 58_000, 75_000),
    WallType.CLT: (60_000, 75_000, 95_000),
    WallType.TIMBER_FRAME: (42_000, 55_000, 70_000),
    WallType.BRICK: (55_000, 70_000, 90_000),
}

_ROOF_COVERING_DEFAULTS: dict[RoofCoveringType, tuple[float, float, float]] = {
    RoofCoveringType.TILE: (18_000, 24_000, 32_000),
    RoofCoveringType.METAL_SHEET: (12_000, 16_000, 22_000),
    RoofCoveringType.SHINGLE: (10_000, 14_000, 19_000),
    RoofCoveringType.FLAT_ROOF: (15_000, 20_000, 27_000),
}


def seed_rough_estimate_rates(db: Session) -> None:
    """Populate rough_estimate_rates with illustrative defaults if the table
    is empty — mirrors seed_activity_templates' "only seed once, admin owns
    it from then on" pattern. Safe to call on every startup.
    """
    if db.query(RoughEstimateRate).first() is not None:
        return

    def _add(category, prices, **variant):
        economy, standard, premium = prices
        db.add(
            RoughEstimateRate(
                category=category,
                price_economy=economy,
                price_standard=standard,
                price_premium=premium,
                **variant,
            )
        )

    for category, prices in _NO_VARIANT_DEFAULTS.items():
        _add(category, prices)
    for foundation_type, prices in _FOUNDATION_DEFAULTS.items():
        _add(RoughEstimateCategory.EARTHWORK_FOUNDATION, prices, foundation_type=foundation_type)
    for wall_type, prices in _EXTERIOR_WALL_DEFAULTS.items():
        _add(RoughEstimateCategory.EXTERIOR_WALL, prices, wall_type=wall_type)
    for wall_type, prices in _INTERIOR_WALL_DEFAULTS.items():
        _add(RoughEstimateCategory.INTERIOR_WALL, prices, wall_type=wall_type)
    for roof_covering_type, prices in _ROOF_COVERING_DEFAULTS.items():
        _add(RoughEstimateCategory.ROOF_COVERING, prices, roof_covering_type=roof_covering_type)

    db.commit()
