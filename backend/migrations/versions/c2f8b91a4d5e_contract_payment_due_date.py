"""client contract: payment_terms_days -> payment_due_date

Revision ID: c2f8b91a4d5e
Revises: b3e5a7c19f4d
Create Date: 2026-08-07 16:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c2f8b91a4d5e'
down_revision: Union[str, None] = 'b3e5a7c19f4d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Client contracts (contracts table) now store an absolute payment due
    # date instead of a day count — the "Új szerződés" dialog switched to a
    # date picker (user, 2026-08-07). SubcontractorContract keeps its own
    # payment_terms_days (finance module), untouched here.
    op.add_column('contracts', sa.Column('payment_due_date', sa.Date(), nullable=True))
    op.drop_column('contracts', 'payment_terms_days')


def downgrade() -> None:
    op.add_column('contracts', sa.Column('payment_terms_days', sa.Integer(), nullable=True))
    op.drop_column('contracts', 'payment_due_date')
