from app.routers.auth import router as auth_router
from app.routers.conversations import router as conversations_router
from app.routers.messages import router as messages_router
from app.routers.uploads import router as uploads_router
from app.routers.documents import router as documents_router
from app.routers.graph import router as graph_router
from app.routers.agent import router as agent_router
from app.routers.chatbots import router as chatbots_router
from app.routers.public import router as public_router
from app.routers.admin import router as admin_router
from app.router.endpoint import router as ai_router

__all__ = [
    "auth_router",
    "conversations_router",
    "messages_router",
    "uploads_router",
    "documents_router",
    "graph_router",
    "agent_router",
    "chatbots_router",
    "public_router",
    "admin_router",
    "ai_router",
]
