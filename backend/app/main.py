from contextlib import asynccontextmanager
import traceback
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.database import create_tables
# Import all models so SQLAlchemy registers them before create_tables()
from app.models import (  # noqa: F401
    Organization, Chatbot,
    User, Conversation, Message, OAuthAccount,
    Attachment, DocumentChunk,
    Entity, EntityRelationship, DocumentEntity,
)
from app.routers import (
    auth_router,
    conversations_router,
    messages_router,
    uploads_router,
    documents_router,
    graph_router,
    agent_router,
    chatbots_router,
    public_router,
    admin_router,
    ai_router,
)
from app.services.ai import AIService
from app.services.embedding import EmbeddingService
from app.router.service import RouterService


@asynccontextmanager
async def lifespan(app: FastAPI):
    await create_tables()

    ai_service = AIService()
    provider = settings.AI_PROVIDER.upper()
    if await ai_service.check_health():
        if settings.AI_PROVIDER == "deepseek":
            print(
                f"[AI] Provider: DeepSeek | "
                f"Model: {settings.DEEPSEEK_MODEL}"
            )
        else:
            print(
                f"[AI] Provider: Ollama | "
                f"URL: {settings.OLLAMA_BASE_URL}"
            )
    else:
        print(
            f"Warning: {provider} AI provider is not reachable. "
            f"Check your settings."
        )

    router_service = RouterService()
    if await router_service.health_check():
        print(f"Router model ({router_service.model}) available")
    else:
        print(
            f"Warning: Router model ({router_service.model}) "
            f"not available - using fallback"
        )

    embedding_service = EmbeddingService()
    if await embedding_service.health_check():
        if settings.EMBEDDING_PROVIDER == "openai":
            print(
                f"[Embedding] Provider: OpenAI | "
                f"Model: {settings.OPENAI_EMBEDDING_MODEL} | "
                f"Dim: {settings.RAG_EMBEDDING_DIM}"
            )
        else:
            print(
                f"[Embedding] Provider: Ollama | "
                f"Model: {settings.OLLAMA_EMBEDDING_MODEL} | "
                f"Dim: {settings.RAG_EMBEDDING_DIM}"
            )
    else:
        provider = settings.EMBEDDING_PROVIDER.upper()
        print(
            f"Warning: {provider} embedding provider is not reachable. "
            f"Check your settings."
        )

    yield


app = FastAPI(
    title=settings.APP_NAME,
    description="AI Chatbot API powered by Ollama",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    error_trace = traceback.format_exc()
    print(f"\n{'='*50}")
    print(f"ERROR in {request.method} {request.url}")
    print(f"{'='*50}")
    print(error_trace)
    print(f"{'='*50}\n")
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc), "traceback": error_trace},
    )


# Routers
app.include_router(auth_router, prefix="/api")
app.include_router(conversations_router, prefix="/api")
app.include_router(messages_router, prefix="/api")
app.include_router(uploads_router, prefix="/api")
app.include_router(documents_router, prefix="/api")
app.include_router(graph_router, prefix="/api")
app.include_router(agent_router, prefix="/api")
app.include_router(chatbots_router, prefix="/api")
app.include_router(public_router, prefix="/api")
app.include_router(admin_router, prefix="/api")
app.include_router(ai_router, prefix="/api")


@app.get("/")
async def root():
    return {
        "name": settings.APP_NAME,
        "version": "2.0.0",
        "status": "running",
    }


@app.get("/health")
async def health_check():
    ai_service = AIService()
    ollama_healthy = await ai_service.check_health()
    return {
        "status": "healthy",
        "ollama": "connected" if ollama_healthy else "disconnected",
    }


@app.get("/debug/db")
async def debug_db():
    from app.database import async_session_maker
    from sqlalchemy import text

    try:
        async with async_session_maker() as session:
            result = await session.execute(text("SELECT 1"))
            result.scalar()
            tables_result = await session.execute(
                text(
                    "SELECT tablename FROM pg_tables "
                    "WHERE schemaname = 'public'"
                )
            )
            tables = [row[0] for row in tables_result.fetchall()]
            return {"database": "connected", "tables": tables}
    except Exception as e:
        return {
            "database": "error",
            "detail": str(e),
            "traceback": traceback.format_exc(),
        }
