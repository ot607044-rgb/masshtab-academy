"""Add interview participants.

Revision ID: 016
Revises: 015_user_activation_fields
Create Date: 2026-10-06 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "016"
down_revision = "015"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("recruitment_interviews", sa.Column("participant_ids", sa.JSON(), nullable=False, server_default="[]"))
    op.alter_column("recruitment_interviews", "participant_ids", server_default=None)


def downgrade():
    op.drop_column("recruitment_interviews", "participant_ids")
