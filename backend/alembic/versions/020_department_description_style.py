"""Department description font settings.

Revision ID: 020
Revises: 019
"""
from alembic import op
import sqlalchemy as sa

revision = "020"
down_revision = "019"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("departments", sa.Column("description_font", sa.String(16), nullable=True))
    op.add_column("departments", sa.Column("description_size", sa.SmallInteger(), nullable=True))


def downgrade():
    op.drop_column("departments", "description_size")
    op.drop_column("departments", "description_font")
