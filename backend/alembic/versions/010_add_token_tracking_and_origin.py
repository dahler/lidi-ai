"""Add token columns to messages and origin to conversations

Revision ID: 010
Revises: 009
Create Date: 2026-05-17
"""
from alembic import op
import sqlalchemy as sa

revision = "010"
down_revision = "009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "messages",
        sa.Column("input_tokens", sa.Integer(), nullable=True),
    )
    op.add_column(
        "messages",
        sa.Column("output_tokens", sa.Integer(), nullable=True),
    )
    op.add_column(
        "conversations",
        sa.Column("origin", sa.String(255), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("conversations", "origin")
    op.drop_column("messages", "output_tokens")
    op.drop_column("messages", "input_tokens")
