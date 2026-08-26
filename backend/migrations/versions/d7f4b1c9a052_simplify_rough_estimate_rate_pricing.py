"""simplify rough estimate rate pricing (1 base price + global % settings)

Revision ID: d7f4b1c9a052
Revises: c9a1f7e3d284
Create Date: 2026-08-26 09:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'd7f4b1c9a052'
down_revision: Union[str, None] = 'c9a1f7e3d284'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('rough_estimate_rates', sa.Column('base_price', sa.Float(), nullable=True))
    # Carry the old "standard" tier over as the new single base_price so
    # existing admin-tuned values aren't lost — gazdaságos/prémium become
    # derived (global %) from this point on instead of independently stored.
    op.execute('UPDATE rough_estimate_rates SET base_price = price_standard')
    op.alter_column('rough_estimate_rates', 'base_price', nullable=False)
    op.drop_column('rough_estimate_rates', 'price_economy')
    op.drop_column('rough_estimate_rates', 'price_standard')
    op.drop_column('rough_estimate_rates', 'price_premium')

    op.create_table(
        'rough_estimate_settings',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('economy_adjustment_pct', sa.Float(), nullable=False),
        sa.Column('premium_adjustment_pct', sa.Float(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )


def downgrade() -> None:
    op.drop_table('rough_estimate_settings')

    op.add_column('rough_estimate_rates', sa.Column('price_economy', sa.Float(), nullable=True))
    op.add_column('rough_estimate_rates', sa.Column('price_standard', sa.Float(), nullable=True))
    op.add_column('rough_estimate_rates', sa.Column('price_premium', sa.Float(), nullable=True))
    # The original 3 independent values are gone — best-effort backfill sets
    # all three to base_price (admin must re-tune economy/premium manually).
    op.execute(
        'UPDATE rough_estimate_rates SET price_economy = base_price, '
        'price_standard = base_price, price_premium = base_price'
    )
    op.alter_column('rough_estimate_rates', 'price_economy', nullable=False)
    op.alter_column('rough_estimate_rates', 'price_standard', nullable=False)
    op.alter_column('rough_estimate_rates', 'price_premium', nullable=False)
    op.drop_column('rough_estimate_rates', 'base_price')
