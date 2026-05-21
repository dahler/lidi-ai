"""
Seed script — creates one super-admin and one customer-admin user.
Safe to re-run: skips emails that already exist.

Usage (from the backend/ directory):
    python seed_users.py

Override credentials via env vars:
    ADMIN_EMAIL=me@example.com ADMIN_PASSWORD=secret python seed_users.py
"""
import asyncio
import os
import sys

# Must come before any app imports so Python finds the app package
sys.path.insert(0, os.path.dirname(__file__))

import bcrypt as _bcrypt  # noqa: E402
from sqlalchemy import select, text  # noqa: E402
from sqlalchemy.ext.asyncio import (  # noqa: E402
    create_async_engine,
    async_sessionmaker,
)

from app.config import settings  # noqa: E402
from app.database import Base  # noqa: E402
from app.models import Organization, User, UserRole  # noqa: E402, F401

def _hash(password: str) -> str:
    return _bcrypt.hashpw(password.encode(), _bcrypt.gensalt()).decode()


ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin@lidi.ai")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "Admin@1234")

USER_EMAIL = os.getenv("USER_EMAIL", "user@lidi.ai")
USER_PASSWORD = os.getenv("USER_PASSWORD", "User@1234")

SEED_USERS = [
    {
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD,
        "name": "Super Admin",
        "role": UserRole.SUPER_ADMIN,
        "is_admin": True,
    },
    {
        "email": USER_EMAIL,
        "password": USER_PASSWORD,
        "name": "Demo User",
        "role": UserRole.CUSTOMER_ADMIN,
        "is_admin": False,
    },
]


async def seed() -> None:
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    session_maker = async_sessionmaker(engine, expire_on_commit=False)

    # Ensure pgvector extension and all tables exist
    async with engine.begin() as conn:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        await conn.run_sync(Base.metadata.create_all)

    async with session_maker() as session:
        print("\n== Lidi AI -- User Seeder ==\n")

        for spec in SEED_USERS:
            email = spec["email"]

            result = await session.execute(
                select(User).where(User.email == email)
            )
            existing = result.scalar_one_or_none()

            if existing:
                print(f"  [SKIP] Already exists: {email}")
                continue

            user = User(
                email=email,
                name=spec["name"],
                password_hash=_hash(spec["password"]),
                role=spec["role"],
                is_admin=spec["is_admin"],
                email_verified=True,
            )
            session.add(user)
            await session.flush()
            await session.commit()
            await session.refresh(user)

            is_super = spec["role"] == UserRole.SUPER_ADMIN
            tag = "SUPER ADMIN" if is_super else "CUSTOMER ADMIN"
            print(f"  [OK] Created [{tag}]")
            print(f"       Email    : {email}")
            print(f"       Password : {spec['password']}")
            print(f"       ID       : {user.id}")
            print()

        print("============================================\n")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed())
