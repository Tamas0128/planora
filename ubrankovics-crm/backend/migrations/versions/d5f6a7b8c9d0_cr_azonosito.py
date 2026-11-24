"""cr_azonosito: pótmunka (CR) csoportosítás tételen és vevői ajánlaton

Revision ID: d5f6a7b8c9d0
Revises: c4e5f6a7b8c9
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "d5f6a7b8c9d0"
down_revision: Union[str, None] = "c4e5f6a7b8c9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("projekt_tetelek", sa.Column("cr_azonosito", sa.String(30), nullable=True))
    op.add_column("vevoi_ajanlatok", sa.Column("cr_azonosito", sa.String(30), nullable=True))


def downgrade() -> None:
    op.drop_column("vevoi_ajanlatok", "cr_azonosito")
    op.drop_column("projekt_tetelek", "cr_azonosito")
