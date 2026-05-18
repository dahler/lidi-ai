from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.chatbot import Chatbot, _gen_api_key
from app.repositories.base import BaseRepository


class ChatbotRepository(BaseRepository[Chatbot]):
    def __init__(self, db: AsyncSession):
        super().__init__(Chatbot, db)

    async def create(self, **kwargs) -> Chatbot:
        kwargs.setdefault("api_key", _gen_api_key())
        return await super().create(**kwargs)

    async def get_by_organization(
        self, organization_id: int
    ) -> list[Chatbot]:
        result = await self.db.execute(
            select(Chatbot).where(
                Chatbot.organization_id == organization_id
            )
        )
        return list(result.scalars().all())

    async def get_by_api_key(self, api_key: str) -> Chatbot | None:
        result = await self.db.execute(
            select(Chatbot).where(
                Chatbot.api_key == api_key,
                Chatbot.is_active.is_(True),
            )
        )
        return result.scalar_one_or_none()

    async def get_active(self, chatbot_id: int) -> Chatbot | None:
        result = await self.db.execute(
            select(Chatbot).where(
                Chatbot.id == chatbot_id,
                Chatbot.is_active.is_(True),
            )
        )
        return result.scalar_one_or_none()

    async def update(
        self, chatbot_id: int, **kwargs
    ) -> Chatbot | None:
        chatbot = await self.get_by_id(chatbot_id)
        if not chatbot:
            return None
        for key, value in kwargs.items():
            if hasattr(chatbot, key) and value is not None:
                setattr(chatbot, key, value)
        await self.db.commit()
        await self.db.refresh(chatbot)
        return chatbot
