"""Employee duties with font settings.

Revision ID: 021
Revises: 020
"""
from alembic import op
import sqlalchemy as sa

revision = "021"
down_revision = "020"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("employees", sa.Column("duties", sa.Text(), nullable=True))
    op.add_column("employees", sa.Column("duties_font", sa.String(16), nullable=True))
    op.add_column("employees", sa.Column("duties_size", sa.SmallInteger(), nullable=True))


def downgrade():
    op.drop_column("employees", "duties_size")
    op.drop_column("employees", "duties_font")
    op.drop_column("employees", "duties")
