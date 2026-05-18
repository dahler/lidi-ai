"""Add multi-tenant: organizations, chatbots, chatbot_id FKs, user roles

Revision ID: 006
Revises: 005
Create Date: 2026-05-17 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '006'
down_revision: Union[str, None] = '005'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── organizations ─────────────────────────────────────────────────
    op.create_table(
        'organizations',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('slug', sa.String(100), nullable=False, unique=True),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
    )
    op.create_index(
        'ix_organizations_slug', 'organizations', ['slug'], unique=True
    )

    # ── chatbots ──────────────────────────────────────────────────────
    op.create_table(
        'chatbots',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            'organization_id',
            sa.Integer(),
            sa.ForeignKey('organizations.id', ondelete='CASCADE'),
            nullable=False,
            index=True,
        ),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('welcome_message', sa.Text(), nullable=False,
                  server_default='Hello! How can I help you today?'),
        sa.Column('theme_color', sa.String(20), nullable=False,
                  server_default='#6366f1'),
        sa.Column('system_prompt', sa.Text(), nullable=False,
                  server_default='You are a helpful assistant.'),
        sa.Column('is_active', sa.Boolean(), nullable=False,
                  server_default=sa.true()),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
        sa.Column(
            'updated_at',
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
    )

    # ── users: new columns ────────────────────────────────────────────
    op.execute(
        "CREATE TYPE userrole AS ENUM "
        "('super_admin', 'customer_admin', 'customer_user')"
    )
    op.add_column(
        'users',
        sa.Column('password_hash', sa.String(255), nullable=True),
    )
    op.add_column(
        'users',
        sa.Column(
            'google_id', sa.String(255), nullable=True, unique=True
        ),
    )
    op.add_column(
        'users',
        sa.Column(
            'role',
            sa.Enum(
                'super_admin', 'customer_admin', 'customer_user',
                name='userrole',
            ),
            nullable=False,
            server_default='customer_admin',
        ),
    )
    op.add_column(
        'users',
        sa.Column(
            'organization_id',
            sa.Integer(),
            sa.ForeignKey('organizations.id', ondelete='SET NULL'),
            nullable=True,
        ),
    )
    op.create_index(
        'ix_users_organization_id', 'users', ['organization_id']
    )

    # ── conversations: chatbot_id ──────────────────────────────────────
    op.add_column(
        'conversations',
        sa.Column(
            'chatbot_id',
            sa.Integer(),
            sa.ForeignKey('chatbots.id', ondelete='SET NULL'),
            nullable=True,
        ),
    )
    op.create_index(
        'ix_conversations_chatbot_id', 'conversations', ['chatbot_id']
    )

    # ── attachments: chatbot_id ────────────────────────────────────────
    op.add_column(
        'attachments',
        sa.Column(
            'chatbot_id',
            sa.Integer(),
            sa.ForeignKey('chatbots.id', ondelete='CASCADE'),
            nullable=True,
        ),
    )
    op.create_index(
        'ix_attachments_chatbot_id', 'attachments', ['chatbot_id']
    )

    # ── document_chunks: chatbot_id ────────────────────────────────────
    op.add_column(
        'document_chunks',
        sa.Column(
            'chatbot_id',
            sa.Integer(),
            sa.ForeignKey('chatbots.id', ondelete='CASCADE'),
            nullable=True,
        ),
    )
    op.create_index(
        'ix_document_chunks_chatbot_id',
        'document_chunks',
        ['chatbot_id'],
    )


def downgrade() -> None:
    op.drop_index('ix_document_chunks_chatbot_id', 'document_chunks')
    op.drop_column('document_chunks', 'chatbot_id')

    op.drop_index('ix_attachments_chatbot_id', 'attachments')
    op.drop_column('attachments', 'chatbot_id')

    op.drop_index('ix_conversations_chatbot_id', 'conversations')
    op.drop_column('conversations', 'chatbot_id')

    op.drop_index('ix_users_organization_id', 'users')
    op.drop_column('users', 'organization_id')
    op.drop_column('users', 'role')
    op.drop_column('users', 'google_id')
    op.drop_column('users', 'password_hash')
    op.execute('DROP TYPE userrole')

    op.drop_table('chatbots')
    op.drop_index('ix_organizations_slug', 'organizations')
    op.drop_table('organizations')
