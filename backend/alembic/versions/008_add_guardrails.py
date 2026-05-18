"""add guardrails to chatbots

Revision ID: 008
Revises: 007
Create Date: 2024-01-01
"""
from alembic import op
import sqlalchemy as sa

revision = "008"
down_revision = "007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "chatbots",
        sa.Column("guardrails_enabled", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.add_column(
        "chatbots",
        sa.Column("blocked_keywords", sa.Text(), nullable=False, server_default=""),
    )
    op.add_column(
        "chatbots",
        sa.Column("allowed_topics", sa.Text(), nullable=False, server_default=""),
    )
    op.add_column(
        "chatbots",
        sa.Column(
            "off_topic_message",
            sa.Text(),
            nullable=False,
            server_default=(
                "I'm sorry, I can only help with topics related to this service."
            ),
        ),
    )


def downgrade() -> None:
    op.drop_column("chatbots", "off_topic_message")
    op.drop_column("chatbots", "allowed_topics")
    op.drop_column("chatbots", "blocked_keywords")
    op.drop_column("chatbots", "guardrails_enabled")
