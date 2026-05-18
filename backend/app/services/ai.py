from typing import AsyncGenerator, List, Dict, Union

from app.config import settings
from app.models.message import Message

SYSTEM_PROMPT = """You are ALAI, a helpful AI assistant. You are friendly, knowledgeable, and concise.
You can help with a variety of tasks including answering questions, writing code, explaining concepts, and more.
When writing code, use markdown code blocks with appropriate language tags.
If images are provided, analyze and describe them as part of your response.
Be direct and helpful in your responses.

IMPORTANT: Always respond in the same language as the user. If the user writes in Indonesian, respond in Indonesian. If the user writes in English, respond in English. Match the user's language exactly."""


def _make_client():
    """Return the appropriate LLM client based on AI_PROVIDER setting."""
    if settings.AI_PROVIDER.lower() == "deepseek":
        from app.ai.deepseek import DeepSeekClient
        return DeepSeekClient()
    # Default: local Ollama
    from app.ai.ollama import OllamaClient
    return OllamaClient()


class AIService:
    def __init__(self):
        self.client = _make_client()

    def _messages_to_dict(
        self, messages: list[Message]
    ) -> list[dict]:
        return [
            {"role": msg.role, "content": msg.content}
            for msg in messages
        ]

    async def generate_response(
        self,
        messages: Union[List[Message], List[Dict[str, str]]],
        user_message: str = None,
        image_paths: list[str] | None = None,
        use_agent_model: bool = False,
    ) -> str:
        if messages and isinstance(messages[0], dict):
            history = messages
            system_prompt = None
        else:
            history = self._messages_to_dict(messages)
            if user_message:
                history.append({"role": "user", "content": user_message})
            system_prompt = SYSTEM_PROMPT

        model_override = (
            settings.OLLAMA_AGENT_MODEL
            if use_agent_model and settings.AI_PROVIDER == "ollama"
            else None
        )

        return await self.client.chat(
            history,
            system_prompt=system_prompt,
            images=image_paths,
            model_override=model_override,
        )

    async def generate_response_stream(
        self,
        messages: Union[List[Message], List[Dict[str, str]]],
        user_message: str = None,
        image_paths: list[str] | None = None,
    ) -> AsyncGenerator[str, None]:
        if messages and isinstance(messages[0], dict):
            history = messages
            system_prompt = None
        else:
            history = self._messages_to_dict(messages)
            if user_message:
                history.append({"role": "user", "content": user_message})
            system_prompt = SYSTEM_PROMPT

        async for chunk in self.client.chat_stream(
            history,
            system_prompt=system_prompt,
            images=image_paths,
        ):
            yield chunk

    async def generate_title(self, first_message: str) -> str:
        prompt = (
            f'Generate a very short title (max 5 words) for a conversation '
            f'that starts with this message:\n"{first_message}"\n\n'
            f'Return only the title, nothing else. No quotes, no punctuation at the end.\n'
            f'IMPORTANT: Generate the title in the same language as the message.'
        )
        messages = [{"role": "user", "content": prompt}]
        title = await self.client.chat(messages)
        return title.strip().strip('"').strip("'")[:50]

    async def check_health(self) -> bool:
        return await self.client.check_health()
