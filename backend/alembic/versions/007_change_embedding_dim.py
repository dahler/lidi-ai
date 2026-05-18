"""Change embedding vector dimension (e.g. Ollama 768 → OpenAI 1536)

Revision ID: 007
Revises: 006
Create Date: 2026-05-17 00:00:00.000000

RUN THIS MIGRATION only when switching EMBEDDING_PROVIDER from ollama to
openai (or changing RAG_EMBEDDING_DIM for any other reason).

WARNING: dropping and recreating the embedding column deletes all stored
vectors.  After running this migration you must re-upload / re-embed all
documents.

Usage:
    # Set new dimension in .env first, then:
    alembic upgrade 007
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '007'
down_revision: Union[str, None] = '006'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# ── Edit these two values before running ──────────────────────────────
OLD_DIM = 768   # e.g. nomic-embed-text (Ollama)
NEW_DIM = 1536  # e.g. text-embedding-3-small (OpenAI)
# ─────────────────────────────────────────────────────────────────────


def upgrade() -> None:
    # Drop the IVFFlat index first (can't alter a vector column in-place)
    op.execute("DROP INDEX IF EXISTS ix_document_chunks_embedding")

    # Replace the column with the new dimension
    op.execute(
        f"ALTER TABLE document_chunks "
        f"DROP COLUMN IF EXISTS embedding"
    )
    op.execute(
        f"ALTER TABLE document_chunks "
        f"ADD COLUMN embedding vector({NEW_DIM})"
    )

    # Recreate the IVFFlat index for the new dimension
    op.execute(
        "CREATE INDEX ix_document_chunks_embedding "
        "ON document_chunks "
        "USING ivfflat (embedding vector_cosine_ops) "
        "WITH (lists = 100)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_document_chunks_embedding")
    op.execute(
        "ALTER TABLE document_chunks DROP COLUMN IF EXISTS embedding"
    )
    op.execute(
        f"ALTER TABLE document_chunks "
        f"ADD COLUMN embedding vector({OLD_DIM})"
    )
    op.execute(
        "CREATE INDEX ix_document_chunks_embedding "
        "ON document_chunks "
        "USING ivfflat (embedding vector_cosine_ops) "
        "WITH (lists = 100)"
    )
