"""Align fresh-install enum labels with SQLAlchemy models and existing production.

Revision ID: 009
Revises: 008
"""
from alembic import op

revision = "009"
down_revision = "008"
branch_labels = None
depends_on = None


def upgrade():
    # Older migrations use lowercase labels; the ORM persists enum member names.
    for name, labels in {
        "employeestatus": ("active", "probation", "vacation", "fired"),
        "difficultylevel": ("basic", "intermediate", "advanced"),
        "criticality": ("low", "medium", "high", "critical"),
    }.items():
        for label in labels:
            op.execute(f"""DO $$ BEGIN
                IF EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
                           WHERE t.typname = '{name}' AND e.enumlabel = '{label}') THEN
                    ALTER TYPE {name} RENAME VALUE '{label}' TO '{label.upper()}';
                END IF;
            END $$""")


def downgrade():
    # Keep compatibility with the older application, which also expects uppercase.
    pass
