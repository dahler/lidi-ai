"""Add email_verified to users and email_tokens table

Revision ID: 011
Revises: 010
Create Date: 2026-05-18
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ENUM as PgEnum

revision = "011"
down_revision = "010"
branch_labels = None
depends_on = None

_emailtokentype = PgEnum("otp", "reset", name="emailtokentype", create_type=False)


def upgrade() -> None:
    conn = op.get_bind()

    # Add email_verified if not already present
    has_col = conn.execute(sa.text(
        "SELECT 1 FROM information_schema.columns "
        "WHERE table_name='users' AND column_name='email_verified'"
    )).scalar()
    if not has_col:
        op.add_column(
            "users",
            sa.Column("email_verified", sa.Boolean(), nullable=False, server_default="false"),
        )

    # Create enum type if not present
    conn.execute(sa.text(
        """
        DO $$ BEGIN
          CREATE TYPE emailtokentype AS ENUM ('otp', 'reset');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
        """
    ))

    # Create email_tokens table if not present
    has_table = conn.execute(sa.text(
        "SELECT 1 FROM information_schema.tables WHERE table_name='email_tokens'"
    )).scalar()
    if not has_table:
        op.create_table(
            "email_tokens",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("token", sa.String(128), nullable=False),
            sa.Column("type", _emailtokentype, nullable=False),
            sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("used", sa.Boolean(), nullable=False, server_default="false"),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        )
        op.create_index("ix_email_tokens_user_id", "email_tokens", ["user_id"])
        op.create_index("ix_email_tokens_token", "email_tokens", ["token"])


def downgrade() -> None:
    op.drop_index("ix_email_tokens_token", table_name="email_tokens")
    op.drop_index("ix_email_tokens_user_id", table_name="email_tokens")
    op.drop_table("email_tokens")
    op.execute("DROP TYPE emailtokentype")
    op.drop_column("users", "email_verified")
