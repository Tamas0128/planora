"""activity category + documentation subtype

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-07-30 15:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Enum labels are the Python enum members' NAMES (uppercase), matching the
# convention already used for userrole/projectstatus/activitystatus in this
# codebase's SQLAlchemy Enum() columns — not their lowercase string values.
activity_category = sa.Enum(
    'FOUNDATION', 'TIMBER_FRAME', 'ROOFING', 'EXTERIOR_OPENINGS', 'ELECTRICAL',
    'MECHANICAL', 'INSULATION', 'FLOORING', 'INTERIOR', 'FINISHING', 'FACADE',
    'LANDSCAPING', 'PROCUREMENT', 'PLANNING', 'DOCUMENTATION', 'OTHER',
    name='activitycategory',
)
documentation_subtype = sa.Enum(
    'CONTRACT', 'PURCHASE_ORDER', 'COMPLETION_CERTIFICATE', 'INVOICE', 'PLAN',
    'LETTER_OF_INTENT',
    name='documentationsubtype',
)


def upgrade() -> None:
    activity_category.create(op.get_bind(), checkfirst=True)
    documentation_subtype.create(op.get_bind(), checkfirst=True)

    op.add_column(
        'activity_templates',
        sa.Column('category', activity_category, nullable=False, server_default='OTHER'),
    )
    op.add_column(
        'activity_templates',
        sa.Column('documentation_subtype', documentation_subtype, nullable=True),
    )
    op.add_column(
        'activities',
        sa.Column('category', activity_category, nullable=False, server_default='OTHER'),
    )
    op.add_column(
        'activities',
        sa.Column('documentation_subtype', documentation_subtype, nullable=True),
    )


def downgrade() -> None:
    op.drop_column('activities', 'documentation_subtype')
    op.drop_column('activities', 'category')
    op.drop_column('activity_templates', 'documentation_subtype')
    op.drop_column('activity_templates', 'category')

    documentation_subtype.drop(op.get_bind(), checkfirst=True)
    activity_category.drop(op.get_bind(), checkfirst=True)
