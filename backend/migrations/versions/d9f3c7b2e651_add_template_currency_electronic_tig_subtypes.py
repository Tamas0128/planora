"""add currency/is_electronic template dimensions and TORLESI/UTOLAGOS tig subtypes

Revision ID: a1b2c3d4e5f6
Revises: c2f8b91a4d5e
Create Date: 2026-08-11 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'd9f3c7b2e651'
down_revision: Union[str, None] = 'c2f8b91a4d5e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Two new template-selection dimensions, mirroring building_type/
    # is_delay_variant's existing pattern in select_template(): currency
    # (HUF/EUR — only meaningful for CLIENT_CONTRACT/SUBCONTRACTOR_CONTRACT,
    # NULL = catch-all like building_type) and is_electronic (paper vs.
    # e-signature-ready wording, meaningful for SUBCONTRACTOR_CONTRACT/TIG).
    op.add_column('document_templates', sa.Column('currency', sa.String(length=3), nullable=True))
    op.add_column(
        'document_templates',
        sa.Column('is_electronic', sa.Boolean(), nullable=False, server_default=sa.false()),
    )

    # Real-world TIG template set includes "törlési" (cancellation) and
    # "utólagos" (retroactive) variants alongside the existing NORMAL/
    # HELYESBITO(módosítási)/POTMUNKA — extend rather than repurpose an
    # existing value so nothing already using HELYESBITO/POTMUNKA changes
    # meaning. Must run outside the enclosing transaction on Postgres.
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE tigdocumentsubtype ADD VALUE IF NOT EXISTS 'TORLESI'")
        op.execute("ALTER TYPE tigdocumentsubtype ADD VALUE IF NOT EXISTS 'UTOLAGOS'")


def downgrade() -> None:
    op.drop_column('document_templates', 'is_electronic')
    op.drop_column('document_templates', 'currency')
    # Postgres has no ALTER TYPE ... DROP VALUE — TORLESI/UTOLAGOS stay in
    # the enum type on downgrade (harmless, matches the project's existing
    # pattern of not reversing enum-value additions elsewhere).
