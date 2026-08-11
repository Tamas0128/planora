"""add document_templates.input_schema

Revision ID: e91a3c7f5b28
Revises: d4f6a8c1b3e7
Create Date: 2026-08-07 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'e91a3c7f5b28'
down_revision: Union[str, None] = 'd4f6a8c1b3e7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('document_templates', sa.Column('input_schema', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('document_templates', 'input_schema')
