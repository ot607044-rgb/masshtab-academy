"""Make calendar meetings universal.

Revision ID: 017
Revises: 016
Create Date: 2026-10-06 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "017"
down_revision = "016"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("recruitment_interviews", sa.Column("meeting_type", sa.String(30), nullable=False, server_default="interview"))
    op.alter_column("recruitment_interviews", "meeting_type", server_default=None)
    op.drop_constraint("recruitment_interviews_candidate_id_fkey", "recruitment_interviews", type_="foreignkey")
    op.alter_column("recruitment_interviews", "candidate_id", existing_type=sa.UUID(), nullable=True)
    op.create_foreign_key("recruitment_interviews_candidate_id_fkey", "recruitment_interviews", "recruitment_candidates", ["candidate_id"], ["id"], ondelete="SET NULL")


def downgrade():
    op.drop_constraint("recruitment_interviews_candidate_id_fkey", "recruitment_interviews", type_="foreignkey")
    op.execute("DELETE FROM recruitment_interviews WHERE candidate_id IS NULL")
    op.alter_column("recruitment_interviews", "candidate_id", existing_type=sa.UUID(), nullable=False)
    op.create_foreign_key("recruitment_interviews_candidate_id_fkey", "recruitment_interviews", "recruitment_candidates", ["candidate_id"], ["id"], ondelete="CASCADE")
    op.drop_column("recruitment_interviews", "meeting_type")
