"""Add private employee profile photos.

Revision ID: 010
Revises: 009
"""
from alembic import op
import sqlalchemy as sa

revision = "010"
down_revision = "009"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("employees", sa.Column("photo_filename", sa.String(255), nullable=True))


def downgrade():
    op.drop_column("employees", "photo_filename")
