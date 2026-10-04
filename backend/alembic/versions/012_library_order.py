"""Order knowledge topics (library blocks) and lessons inside them.

Revision ID: 012
Revises: 010
"""
from alembic import op
import sqlalchemy as sa

revision = "012"
down_revision = "010"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("knowledge_topics", sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("lessons", sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"))


def downgrade():
    op.drop_column("lessons", "sort_order")
    op.drop_column("knowledge_topics", "sort_order")
