"""Cost estimation module models — Phase 1: rough (paraméteres, m²/fm-based)
construction cost estimates. Kept in a separate file from app/models.py,
same pattern as models_finance.py/models_crm.py — same Base/metadata/
registry, so relationships resolve across files as long as this module is
imported before mappers configure (main.py and migrations/env.py both
import it explicitly).

The itemized/TERC-based budget (Phase 2+) will live here too once built.
"""

import enum
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    JSON,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class FinishLevel(str, enum.Enum):
    ECONOMY = "economy"  # Gazdaságos
    STANDARD = "standard"  # Standard
    PREMIUM = "premium"  # Prémium


class WallType(str, enum.Enum):
    LIGHT_STEEL = "light_steel"  # Könnyűszerkezet
    CLT = "clt"  # CLT
    TIMBER_FRAME = "timber_frame"  # Faváz
    BRICK = "brick"  # Tégla


class RoofCoveringType(str, enum.Enum):
    TILE = "tile"  # Cserép
    METAL_SHEET = "metal_sheet"  # Trapézlemez
    SHINGLE = "shingle"  # Zsindely
    FLAT_ROOF = "flat_roof"  # Lapostető szigetelés


class FoundationType(str, enum.Enum):
    STRIP = "strip"  # Sávalap
    SLAB = "slab"  # Lemezalap
    POINT = "point"  # Pontalap


class RoughEstimateCategory(str, enum.Enum):
    EARTHWORK_FOUNDATION = "earthwork_foundation"  # Földmunka + alapozás
    BASEMENT_WALL = "basement_wall"  # Pinceszint (fal + szigetelés)
    EXTERIOR_WALL = "exterior_wall"  # Külső teherhordó fal
    INTERIOR_WALL = "interior_wall"  # Belső válaszfal
    WALKABLE_SLAB = "walkable_slab"  # Járható födém
    LIGHT_SLAB = "light_slab"  # Könnyű födém
    ROOF_STRUCTURE = "roof_structure"  # Tetőszerkezet
    ROOF_COVERING = "roof_covering"  # Tetőhéjazat
    OPENINGS = "openings"  # Nyílászárók
    MECHANICAL = "mechanical"  # Gépészet
    ELECTRICAL = "electrical"  # Villamosság
    FINISHES = "finishes"  # Belső burkolat + festés


# Categories that carry an extra pricing dimension — used by both the rate
# admin UI and services/cost_estimate.py to know which RoughEstimateRate row
# to look up. A category not listed here has exactly one active rate row
# (wall_type/roof_covering_type/foundation_type all NULL).
WALL_TYPE_CATEGORIES = (RoughEstimateCategory.EXTERIOR_WALL, RoughEstimateCategory.INTERIOR_WALL)
ROOF_COVERING_CATEGORIES = (RoughEstimateCategory.ROOF_COVERING,)
FOUNDATION_TYPE_CATEGORIES = (RoughEstimateCategory.EARTHWORK_FOUNDATION,)


class RoughEstimateRate(Base):
    """Admin-managed Ft/m² or Ft/fm rate for one cost category — and, for
    categories in WALL_TYPE_CATEGORIES/ROOF_COVERING_CATEGORIES/
    FOUNDATION_TYPE_CATEGORIES, one variant of the relevant type — across
    the three finish levels. Seeded with illustrative defaults by
    services.cost_estimate.seed_rough_estimate_rates; an admin is expected
    to tune these to real market prices.
    """

    __tablename__ = "rough_estimate_rates"
    __table_args__ = (
        UniqueConstraint(
            "category",
            "wall_type",
            "roof_covering_type",
            "foundation_type",
            name="uq_rough_estimate_rate_variant",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    category: Mapped[RoughEstimateCategory] = mapped_column(
        Enum(RoughEstimateCategory), index=True
    )
    wall_type: Mapped[WallType | None] = mapped_column(Enum(WallType), nullable=True)
    roof_covering_type: Mapped[RoofCoveringType | None] = mapped_column(
        Enum(RoofCoveringType), nullable=True
    )
    foundation_type: Mapped[FoundationType | None] = mapped_column(
        Enum(FoundationType), nullable=True
    )
    price_economy: Mapped[float] = mapped_column(Float)
    price_standard: Mapped[float] = mapped_column(Float)
    price_premium: Mapped[float] = mapped_column(Float)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    def price_for(self, level: FinishLevel) -> float:
        return {
            FinishLevel.ECONOMY: self.price_economy,
            FinishLevel.STANDARD: self.price_standard,
            FinishLevel.PREMIUM: self.price_premium,
        }[level]


class CostEstimateRough(Base):
    """One saved parametric (m²/fm-based) cost estimate for a project —
    order-of-magnitude only, not a substitute for the future itemized
    (TERC-based) budget. A project can accumulate several, e.g. re-run
    after the client changes finish level; the list is the estimate's
    history.
    """

    __tablename__ = "cost_estimate_rough"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), index=True
    )
    finish_level: Mapped[FinishLevel] = mapped_column(Enum(FinishLevel))
    floor_area_sqm: Mapped[float] = mapped_column(Float)
    exterior_wall_fm: Mapped[float] = mapped_column(Float)
    exterior_wall_type: Mapped[WallType] = mapped_column(Enum(WallType))
    interior_wall_fm: Mapped[float] = mapped_column(Float, default=0)
    interior_wall_type: Mapped[WallType] = mapped_column(Enum(WallType))
    has_basement: Mapped[bool] = mapped_column(Boolean, default=False)
    basement_wall_fm: Mapped[float] = mapped_column(Float, default=0)
    walkable_slab_sqm: Mapped[float] = mapped_column(Float, default=0)
    light_slab_sqm: Mapped[float] = mapped_column(Float, default=0)
    roof_area_sqm: Mapped[float] = mapped_column(Float)
    roof_covering_type: Mapped[RoofCoveringType] = mapped_column(Enum(RoofCoveringType))
    foundation_type: Mapped[FoundationType] = mapped_column(
        Enum(FoundationType), default=FoundationType.STRIP
    )
    # Snapshot of each computed line ({category, wall_type,
    # roof_covering_type, quantity, unit_price, line_total}) taken at save
    # time by services/cost_estimate.py, so a saved estimate's figures never
    # silently drift if an admin edits RoughEstimateRate afterwards.
    breakdown: Mapped[list] = mapped_column(JSON)
    total_net_min: Mapped[float] = mapped_column(Float)
    total_net_max: Mapped[float] = mapped_column(Float)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    project: Mapped["Project"] = relationship(back_populates="cost_estimates_rough")
    created_by: Mapped["User | None"] = relationship()


class PriceCatalogSource(str, enum.Enum):
    OWN = "own"  # Manuálisan felvitt, saját ártétel
    TERC_IMPORT = "terc_import"  # TERC exportból importált


class PriceCatalogItem(Base):
    """One row of the tételes (TERC-style) price catalog — code, unit,
    material/labor unit price, grouped by munkanem/fejezet (a free-text
    chapter, not an enum: TERC's chapter list is large and changes across
    editions, so admins type/import it rather than picking from a fixed
    set). Phase 2 only supports manual entry (source=OWN); Phase 3 adds a
    TERC Excel/CSV import that also writes into this table
    (source=TERC_IMPORT).

    This catalog itself has no cost-estimate consumer yet — the itemized
    (tételes) budget that will pick line items from it is a later phase.
    """

    __tablename__ = "price_catalog_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String(50), index=True)
    description: Mapped[str] = mapped_column(String(500))
    unit: Mapped[str] = mapped_column(String(20))
    chapter: Mapped[str] = mapped_column(String(255), index=True)
    unit_price_material: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    unit_price_labor: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    source: Mapped[PriceCatalogSource] = mapped_column(
        Enum(PriceCatalogSource), default=PriceCatalogSource.OWN
    )
    source_reference: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    @property
    def unit_price_total(self) -> Decimal:
        return self.unit_price_material + self.unit_price_labor


class CostEstimateDetailed(Base):
    """One itemized (tételes) budget "document" for a project — a named,
    editable collection of line items drawn from PriceCatalogItem (or typed
    in manually). A project can hold several, e.g. a first pass and a
    revised version after client negotiation; each is independently
    transferable to a CRM Quote (see the transfer-to-quote endpoint).
    """

    __tablename__ = "cost_estimate_detailed"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(255))
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    project: Mapped["Project"] = relationship(back_populates="cost_estimates_detailed")
    created_by: Mapped["User | None"] = relationship()
    items: Mapped[list["CostEstimateDetailedItem"]] = relationship(
        back_populates="estimate",
        cascade="all, delete-orphan",
        order_by="CostEstimateDetailedItem.sort_order",
    )


class CostEstimateDetailedItem(Base):
    """One line of a CostEstimateDetailed. code/description/unit/chapter/
    prices are snapshotted from the PriceCatalogItem at the moment the line
    is added (catalog_item_id kept only as a soft back-reference, SET NULL
    if the catalog row is later deleted) — a saved budget must not silently
    change if the catalog is edited afterwards, and the user must be able to
    override any field on a line (e.g. a negotiated price) without that
    edit leaking back into the shared catalog.
    """

    __tablename__ = "cost_estimate_detailed_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    estimate_id: Mapped[int] = mapped_column(
        ForeignKey("cost_estimate_detailed.id", ondelete="CASCADE"), index=True
    )
    catalog_item_id: Mapped[int | None] = mapped_column(
        ForeignKey("price_catalog_items.id", ondelete="SET NULL"), nullable=True
    )
    code: Mapped[str | None] = mapped_column(String(50), nullable=True)
    description: Mapped[str] = mapped_column(String(500))
    unit: Mapped[str] = mapped_column(String(20))
    chapter: Mapped[str] = mapped_column(String(255))
    quantity: Mapped[Decimal] = mapped_column(Numeric(12, 3), default=1)
    unit_price_material: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    unit_price_labor: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    estimate: Mapped["CostEstimateDetailed"] = relationship(back_populates="items")
    catalog_item: Mapped["PriceCatalogItem | None"] = relationship()

    @property
    def line_total(self) -> Decimal:
        return self.quantity * (self.unit_price_material + self.unit_price_labor)
