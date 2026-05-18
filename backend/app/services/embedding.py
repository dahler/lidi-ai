"""
Embedding service — supports Ollama (local) and OpenAI embeddings.
Controlled by the EMBEDDING_PROVIDER setting ("ollama" or "openai").
"""
import time
import httpx
from typing import Optional

from app.config import settings


def log(message: str) -> None:
    timestamp = time.strftime("%H:%M:%S")
    print(f"[{timestamp}] [EMBEDDING] {message}", flush=True)


# ── Provider backends ─────────────────────────────────────────────────

class _OllamaEmbedder:
    def __init__(self) -> None:
        self.base_url = settings.OLLAMA_BASE_URL
        self.model = settings.OLLAMA_EMBEDDING_MODEL

    async def embed(self, text: str) -> Optional[list[float]]:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                f"{self.base_url}/api/embeddings",
                json={"model": self.model, "prompt": text},
            )
            resp.raise_for_status()
            return resp.json().get("embedding")

    async def health_check(self) -> bool:
        vec = await self.embed("test")
        if not vec:
            return False
        if len(vec) != settings.RAG_EMBEDDING_DIM:
            log(
                f"⚠ Dimension mismatch: model={len(vec)}, "
                f"RAG_EMBEDDING_DIM={settings.RAG_EMBEDDING_DIM}"
            )
            return False
        return True

    @property
    def label(self) -> str:
        return f"Ollama/{self.model}"


class _OpenAIEmbedder:
    def __init__(self) -> None:
        self.base_url = settings.OPENAI_BASE_URL.rstrip("/")
        self.model = settings.OPENAI_EMBEDDING_MODEL
        self.api_key = settings.OPENAI_API_KEY

    def _headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    async def embed(self, text: str) -> Optional[list[float]]:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{self.base_url}/embeddings",
                headers=self._headers(),
                json={"model": self.model, "input": text},
            )
            resp.raise_for_status()
            data = resp.json()
            return data["data"][0]["embedding"]

    async def health_check(self) -> bool:
        if not self.api_key:
            log("✗ OPENAI_API_KEY is not set")
            return False
        vec = await self.embed("test")
        if not vec:
            return False
        if len(vec) != settings.RAG_EMBEDDING_DIM:
            log(
                f"⚠ Dimension mismatch: model={len(vec)}, "
                f"RAG_EMBEDDING_DIM={settings.RAG_EMBEDDING_DIM}. "
                f"Set RAG_EMBEDDING_DIM=1536 for text-embedding-3-small."
            )
            return False
        return True

    @property
    def label(self) -> str:
        return f"OpenAI/{self.model}"


def _make_embedder():
    if settings.EMBEDDING_PROVIDER.lower() == "openai":
        return _OpenAIEmbedder()
    return _OllamaEmbedder()


# ── Public service ────────────────────────────────────────────────────

class EmbeddingService:
    def __init__(self) -> None:
        self._embedder = _make_embedder()

    async def embed_text(self, text: str) -> Optional[list[float]]:
        try:
            return await self._embedder.embed(text)
        except Exception as e:
            log(f"✗ Embedding error: {e}")
            return None

    async def embed_texts(
        self, texts: list[str]
    ) -> list[Optional[list[float]]]:
        total = len(texts)
        log(
            f"Generating {total} embeddings "
            f"via {self._embedder.label}…"
        )
        start = time.time()
        results: list[Optional[list[float]]] = []

        for i, text in enumerate(texts):
            results.append(await self.embed_text(text))
            if (i + 1) % 10 == 0 or i == total - 1:
                elapsed = time.time() - start
                rate = (i + 1) / elapsed if elapsed else 0
                log(f"  Progress: {i+1}/{total} ({rate:.1f}/s)")

        success = sum(1 for r in results if r is not None)
        log(
            f"✓ {success}/{total} embeddings in "
            f"{time.time()-start:.2f}s"
        )
        return results

    async def health_check(self) -> bool:
        try:
            return await self._embedder.health_check()
        except Exception as e:
            log(f"✗ Health check failed: {e}")
            return False
