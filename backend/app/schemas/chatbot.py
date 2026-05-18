from datetime import datetime
from pydantic import BaseModel


class ChatbotCreate(BaseModel):
    name: str
    welcome_message: str = "Hello! How can I help you today?"
    theme_color: str = "#6366f1"
    system_prompt: str = "You are a helpful assistant."


class ChatbotUpdate(BaseModel):
    name: str | None = None
    welcome_message: str | None = None
    theme_color: str | None = None
    system_prompt: str | None = None
    is_active: bool | None = None
    guardrails_enabled: bool | None = None
    blocked_keywords: str | None = None
    allowed_topics: str | None = None
    off_topic_message: str | None = None


class ChatbotResponse(BaseModel):
    id: int
    organization_id: int
    api_key: str
    name: str
    welcome_message: str
    theme_color: str
    system_prompt: str
    is_active: bool
    guardrails_enabled: bool
    blocked_keywords: str
    allowed_topics: str
    off_topic_message: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PublicChatRequest(BaseModel):
    api_key: str
    message: str
    conversation_uuid: str | None = None
    host_origin: str | None = None


class PublicChatResponse(BaseModel):
    response: str
    api_key: str


class PublicConfigResponse(BaseModel):
    id: int
    name: str
    welcome_message: str
    theme_color: str
