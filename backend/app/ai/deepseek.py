import json
import time
from typing import AsyncGenerator
import httpx

from app.config import settings


def log(message: str) -> None:
    timestamp = time.strftime("%H:%M:%S")
    print(f"[{timestamp}] [DEEPSEEK] {message}", flush=True)


class DeepSeekClient:
    """
    OpenAI-compatible client for DeepSeek (or any OpenAI-compatible API).
    Mirrors the OllamaClient interface so AIService can swap them at runtime.
    """

    def __init__(self) -> None:
        self.base_url = settings.DEEPSEEK_BASE_URL.rstrip("/")
        self.model = settings.DEEPSEEK_MODEL
        self.api_key = settings.DEEPSEEK_API_KEY

    # ── helpers ───────────────────────────────────────────────────────

    def _headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    def _build_messages(
        self,
        messages: list[dict],
        system_prompt: str | None = None,
    ) -> list[dict]:
        """Prepend system message if provided."""
        result: list[dict] = []
        if system_prompt:
            result.append({"role": "system", "content": system_prompt})
        result.extend(
            {"role": m["role"], "content": m["content"]}
            for m in messages
        )
        return result

    # ── non-streaming ─────────────────────────────────────────────────

    async def chat(
        self,
        messages: list[dict],
        system_prompt: str | None = None,
        images: list[str] | None = None,  # ignored – DeepSeek text-only
        model_override: str | None = None,
    ) -> str:
        model = model_override or self.model
        payload = {
            "model": model,
            "messages": self._build_messages(messages, system_prompt),
            "stream": False,
        }
        log(f"Model: {model} | Messages: {len(messages)}")
        start = time.time()

        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(
                f"{self.base_url}/chat/completions",
                headers=self._headers(),
                json=payload,
            )
            resp.raise_for_status()
            data = resp.json()

        content = (
            data.get("choices", [{}])[0]
            .get("message", {})
            .get("content", "")
        )
        log(f"✓ {len(content)} chars in {time.time()-start:.2f}s")
        return content

    # ── streaming ─────────────────────────────────────────────────────

    async def chat_stream(
        self,
        messages: list[dict],
        system_prompt: str | None = None,
        images: list[str] | None = None,  # ignored
    ) -> AsyncGenerator[str, None]:
        model = self.model
        payload = {
            "model": model,
            "messages": self._build_messages(messages, system_prompt),
            "stream": True,
        }
        log(f"{'='*50}")
        log(f"Model: {model} | History: {len(messages)} messages")
        log(f"{'='*50}")

        start = time.time()
        token_count = 0
        first_token_time: float | None = None

        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream(
                "POST",
                f"{self.base_url}/chat/completions",
                headers=self._headers(),
                json=payload,
            ) as resp:
                resp.raise_for_status()
                log("✓ Connected! Streaming response…")

                async for line in resp.aiter_lines():
                    if not line or not line.startswith("data: "):
                        continue
                    raw = line[6:]  # strip "data: "
                    if raw.strip() == "[DONE]":
                        break
                    try:
                        data = json.loads(raw)
                        delta = (
                            data.get("choices", [{}])[0]
                            .get("delta", {})
                            .get("content", "")
                        )
                        if delta:
                            if first_token_time is None:
                                first_token_time = time.time()
                                log(
                                    f"⚡ TTFT: "
                                    f"{first_token_time-start:.2f}s"
                                )
                            token_count += 1
                            yield delta
                    except json.JSONDecodeError:
                        continue

        elapsed = time.time() - start
        log(f"✓ Stream complete: {token_count} tokens in {elapsed:.2f}s")

    # ── health check ──────────────────────────────────────────────────

    async def check_health(self) -> bool:
        if not self.api_key:
            return False
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(
                    f"{self.base_url}/models",
                    headers=self._headers(),
                )
                return resp.status_code == 200
        except Exception:
            return False
