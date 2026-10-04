"""Merge personal accounts (011) and library order (012) branches.

012 was released to production directly after 010, before 011.

Revision ID: 013
Revises: 011, 012
"""

revision = "013"
down_revision = ("011", "012")
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
