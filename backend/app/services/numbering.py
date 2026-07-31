from datetime import date

from sqlalchemy import func
from sqlalchemy.orm import Session


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
