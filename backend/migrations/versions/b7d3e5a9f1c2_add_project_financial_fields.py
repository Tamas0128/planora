"""add project financial fields (contract net/vat/gross)

Revision ID: b7d3e5a9f1c2
Revises: a4f27c9d1e3b
Create Date: 2026-08-05 09:05:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b7d3e5a9f1c2'
down_revision: Union[str, None] = 'a4f27c9d1e3b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 'vattype' was already CREATEd by a4f27c9d1e3b's op.create_table calls,
    # so — unlike be06cdbee2cc's 'sourcetype' — this add_column does NOT
    # need the explicit sa.Enum(...).create(op.get_bind(), checkfirst=True)
    # step; that's only required the *first* time a migration introduces a
    # brand-new enum via add_column on an existing table.
    op.add_column('projects', sa.Column('contract_net_value', sa.Numeric(precision=14, scale=2), nullable=True))
    op.add_column('projects', sa.Column('contract_vat_type', sa.Enum('STANDARD_27', 'REDUCED_5', 'REVERSE_CHARGE', name='vattype'), nullable=True))
    op.add_column('projects', sa.Column('contract_gross_value', sa.Numeric(precision=14, scale=2), nullable=True))


def downgrade() -> None:
    # No enum drop here — 'vattype' is owned by a4f27c9d1e3b's lifecycle,
    # whose downgrade always runs after this one in Alembic's reverse order.
    op.drop_column('projects', 'contract_gross_value')
    op.drop_column('projects', 'contract_vat_type')
    op.drop_column('projects', 'contract_net_value')
