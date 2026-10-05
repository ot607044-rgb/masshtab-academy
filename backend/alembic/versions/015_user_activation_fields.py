"""Keep the published revision without repeating columns owned by 011.

Revision ID: 015
Revises: 014
"""
revision = "015"
down_revision = "014"
branch_labels = None
depends_on = None


def upgrade():
    # Every path to 014 already includes 011 through the merge at 013.
    pass


def downgrade():
    # Revision 014 still needs these columns; only 011 may remove them.
    pass
