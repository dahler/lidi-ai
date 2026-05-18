import json
from pydantic_settings import BaseSettings
from pydantic import field_validator
from functools import lru_cache


class Settings(BaseSettings):
    # Application
    APP_NAME: str = "ALAI"
    DEBUG: bool = False

    # Database
    DATABASE_URL: str = (
        "postgresql+asyncpg://postgres:postgres@localhost:5432/alai"
    )

    # JWT
    JWT_SECRET_KEY: str = "your-secret-key-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_MINUTES: int = 60 * 24  # 24 hours
    JWT_REFRESH_EXPIRATION_DAYS: int = 30

    # Microsoft OAuth
    MICROSOFT_CLIENT_ID: str = ""
    MICROSOFT_CLIENT_SECRET: str = ""
    MICROSOFT_TENANT_ID: str = "common"
    MICROSOFT_REDIRECT_URI: str = (
        "http://localhost:8000/api/auth/callback"
    )

    # Google OAuth
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""

    # ── LLM provider: "ollama" or "deepseek" ─────────────────────────
    AI_PROVIDER: str = "ollama"

    # DeepSeek (used when AI_PROVIDER=deepseek)
    DEEPSEEK_API_KEY: str = ""
    DEEPSEEK_BASE_URL: str = "https://api.deepseek.com/v1"
    DEEPSEEK_MODEL: str = "deepseek-chat"  # or deepseek-reasoner

    # ── Embedding provider: "ollama" or "openai" ──────────────────────
    EMBEDDING_PROVIDER: str = "ollama"

    # OpenAI embeddings (used when EMBEDDING_PROVIDER=openai)
    # text-embedding-3-small → 1536 dims
    # text-embedding-3-large → 3072 dims
    # text-embedding-ada-002 → 1536 dims
    OPENAI_API_KEY: str = ""
    OPENAI_EMBEDDING_MODEL: str = "text-embedding-3-small"
    OPENAI_BASE_URL: str = "https://api.openai.com/v1"

    # Ollama (used when AI_PROVIDER=ollama or EMBEDDING_PROVIDER=ollama)
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_TEXT_MODEL: str = "gemma3:4b"
    OLLAMA_VISION_MODEL: str = "qwen2.5vl"
    OLLAMA_ROUTER_MODEL: str = "gemma3:1b"
    OLLAMA_AGENT_MODEL: str = "qwen2.5:14b"
    OLLAMA_EMBEDDING_MODEL: str = "nomic-embed-text"

    # Tavily (Web Search)
    TAVILY_API_KEY: str = ""

    # RAG Settings
    # IMPORTANT: must match the dimension your embedding model produces.
    #   ollama/nomic-embed-text  → 768
    #   openai/text-embedding-3-small → 1536
    #   openai/text-embedding-3-large → 3072
    # Changing this requires running migration 007 and re-embedding docs.
    RAG_CHUNK_SIZE: int = 500
    RAG_CHUNK_OVERLAP: int = 50
    RAG_TOP_K: int = 5
    RAG_EMBEDDING_DIM: int = 768

    # Email (Resend)
    RESEND_API_KEY: str = ""
    RESEND_FROM_EMAIL: str = "noreply@lidi.ai"
    FRONTEND_URL: str = "http://localhost:3001"

    # CORS
    CORS_ORIGINS: list[str] = ["http://localhost:3000"]

    # Anonymous Session
    ANONYMOUS_SESSION_COOKIE: str = "alai_session"

    # File Upload
    UPLOAD_DIR: str = "./uploads"
    MAX_FILE_SIZE: int = 10 * 1024 * 1024  # 10MB

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v):
        if isinstance(v, str):
            try:
                return json.loads(v)
            except json.JSONDecodeError:
                return [o.strip() for o in v.split(",")]
        return v

    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
