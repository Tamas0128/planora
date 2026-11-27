"""Per-project free-form tracking tables that don't fit the structured
schedule/CRM/finance models: the munkanem-by-munkanem subcontractor status
table ("ki miben tart") and the technical/gyártástervezési adatlap (grouped
label→value spec sheet). Kept in a separate file from app/models.py, same
pattern as models_finance.py/models_estimate.py — same Base/metadata/
registry, so relationships resolve across files as long as this module is
imported before mappers configure (main.py and migrations/env.py both
import it explicitly).
"""

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class TradeItem(Base):
    """One row of the per-project "ütem+info" style tracker: a single
    munkanem (trade) with who's doing it and where its offer/contract/
    material status stands. Every status field is free text on purpose —
    real site trackers use phrases like "ajánlatot az ügyfél aláírta" or
    "megrendelve - UBR", not a fixed small enum.
    """

    __tablename__ = "project_trade_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), index=True
    )
    sort_order: Mapped[int] = mapped_column(Integer)

    name: Mapped[str] = mapped_column(String(255))  # Megnevezés
    contractor: Mapped[str | None] = mapped_column(String(255), nullable=True)  # Ubr./Alváll.
    info: Mapped[str | None] = mapped_column(Text, nullable=True)  # infó
    offer_status: Mapped[str | None] = mapped_column(String(255), nullable=True)  # Ajánlatkérés
    contract_status: Mapped[str | None] = mapped_column(String(255), nullable=True)  # Alvállalkozói szerződés
    material_status: Mapped[str | None] = mapped_column(String(255), nullable=True)  # Alapanyag
    expected_timing: Mapped[str | None] = mapped_column(String(255), nullable=True)  # Kivitelezés várható ideje
    tig: Mapped[str | None] = mapped_column(String(255), nullable=True)  # TIG
    cross_trade_note: Mapped[str | None] = mapped_column(Text, nullable=True)  # Extra, ami más szakágat is befolyásol
    extra_work_note: Mapped[str | None] = mapped_column(Text, nullable=True)  # Pótmunka

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    project: Mapped["Project"] = relationship(back_populates="trade_items")  # noqa: F821


class ProjectSpecItem(Base):
    """One label→value row of the per-project technical/gyártástervezési
    adatlap, grouped into sections (ALAPSZERKEZET, KÉMÉNY, TETŐFEDÉS...).
    A pure key-value sheet rather than a fixed schema, same reasoning as
    TradeItem: these sheets vary project to project and the point is to get
    the site's own adatlap into the app editable, not to model every
    possible construction detail as its own column.
    """

    __tablename__ = "project_spec_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), index=True
    )
    sort_order: Mapped[int] = mapped_column(Integer)

    group_name: Mapped[str] = mapped_column(String(255))  # pl. "Alapszerkezet", "Kémény"
    label: Mapped[str] = mapped_column(String(500))  # kulcs, pl. "Külső fal rétegrend"
    value: Mapped[str | None] = mapped_column(Text, nullable=True)  # érték
    note: Mapped[str | None] = mapped_column(Text, nullable=True)  # kiegészítő megjegyzés

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    project: Mapped["Project"] = relationship(back_populates="spec_items")  # noqa: F821
