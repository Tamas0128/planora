from datetime import date

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import BuildingType, Project

# BRS-requested per-building-type prefixes (CLT/LTF/BEAM) — "other" has no
# building-specific naming convention, so it falls back to a generic prefix.
PROJECT_CODE_PREFIXES: dict[BuildingType, str] = {
    BuildingType.CLT: "CLT",
    BuildingType.LIGHT_STEEL: "LTF",
    BuildingType.TIMBER_FRAME: "BEAM",
    BuildingType.OTHER: "PRJ",
}


def generate_project_code(db: Session, building_type: BuildingType) -> str:
    """Auto project identifier, e.g. "CLT-001" — not year-scoped like the
    CRM sequence numbers (next_sequence_number), just an incrementing count
    per building-type prefix. Only used when the caller doesn't supply
    their own project_code (still fully overridable at creation).
    """
    prefix = PROJECT_CODE_PREFIXES[building_type]
    like_pattern = f"{prefix}-%"
    count = (
        db.query(func.count())
        .select_from(Project)
        .filter(Project.project_code.like(like_pattern))
        .scalar()
    )
    candidate = f"{prefix}-{count + 1:03d}"
    # Guard against a gap-filled collision (e.g. a manually-typed "CLT-002"
    # from an earlier delete) rather than assuming count+1 is always free.
    while db.query(Project).filter(Project.project_code == candidate).first():
        count += 1
        candidate = f"{prefix}-{count + 1:03d}"
    return candidate


def next_sequence_number(db: Session, model, column_name: str, prefix: str) -> str:
    """Generate the next `PREFIX-YYYY-NNNN` number for a model column.

    Used for customer/quote/contract numbers (all "Automatikus" per the CRM
    BRS). Counts existing rows for the current year rather than tracking a
    separate counter table — simple and good enough at this app's scale;
    not safe against two concurrent requests racing for the same number,
    same tradeoff the rest of this codebase makes elsewhere.
    """
    year = date.today().year
    year_prefix = f"{prefix}-{year}-"
    column = getattr(model, column_name)
    count = (
        db.query(func.count())
        .select_from(model)
        .filter(column.like(f"{year_prefix}%"))
        .scalar()
    )
    return f"{year_prefix}{count + 1:04d}"
