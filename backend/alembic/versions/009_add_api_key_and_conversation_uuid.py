"""Add api_key to chatbots and uuid to conversations

Revision ID: 009
Revises: 008
Create Date: 2026-05-17
"""
from alembic import op
import sqlalchemy as sa

revision = "009"
down_revision = "008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # api_key on chatbots — fill existing rows first, then enforce NOT NULL
    op.add_column(
        "chatbots",
        sa.Column("api_key", sa.String(64), nullable=True),
    )
    op.execute(
        "UPDATE chatbots "
        "SET api_key = 'bot_' || md5(random()::text || id::text) "
        "WHERE api_key IS NULL"
    )
    op.alter_column("chatbots", "api_key", nullable=False)
    op.create_unique_constraint("uq_chatbots_api_key", "chatbots", ["api_key"])
    op.create_index("ix_chatbots_api_key", "chatbots", ["api_key"])

    # uuid on conversations — fill existing rows, then enforce NOT NULL
    op.add_column(
        "conversations",
        sa.Column("uuid", sa.UUID(), nullable=True),
    )
    op.execute(
        "UPDATE conversations SET uuid = gen_random_uuid() WHERE uuid IS NULL"
    )
    op.alter_column("conversations", "uuid", nullable=False)
    op.create_unique_constraint(
        "uq_conversations_uuid", "conversations", ["uuid"]
    )
    op.create_index("ix_conversations_uuid", "conversations", ["uuid"])


def downgrade() -> None:
    op.drop_index("ix_conversations_uuid", table_name="conversations")
    op.drop_constraint("uq_conversations_uuid", "conversations")
    op.drop_column("conversations", "uuid")

    op.drop_index("ix_chatbots_api_key", table_name="chatbots")
    op.drop_constraint("uq_chatbots_api_key", "chatbots")
    op.drop_column("chatbots", "api_key")
