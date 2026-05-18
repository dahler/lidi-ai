import base64
import hashlib
import random
import secrets
from datetime import datetime, timedelta, timezone
from jose import jwt, JWTError
import httpx
from urllib.parse import urlencode
import bcrypt as _bcrypt

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.repositories.user import UserRepository
from app.repositories.conversation import ConversationRepository
from app.models.user import User, UserRole
from app.models.email_token import EmailToken, EmailTokenType
from app.schemas.auth import Token
from app.services import email as email_svc

def _generate_pkce() -> tuple[str, str]:
    verifier_bytes = base64.urlsafe_b64encode(
        secrets.token_bytes(32)
    ).rstrip(b"=")
    code_verifier = verifier_bytes.decode()
    digest = hashlib.sha256(code_verifier.encode()).digest()
    code_challenge = (
        base64.urlsafe_b64encode(digest).rstrip(b"=").decode()
    )
    return code_verifier, code_challenge


class AuthService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.user_repo = UserRepository(db)
        self.conversation_repo = ConversationRepository(db)

    # ------------------------------------------------------------------
    # Password helpers
    # ------------------------------------------------------------------
    def hash_password(self, password: str) -> str:
        return _bcrypt.hashpw(password.encode(), _bcrypt.gensalt()).decode()

    def verify_password(self, plain: str, hashed: str) -> bool:
        return _bcrypt.checkpw(plain.encode(), hashed.encode())

    # ------------------------------------------------------------------
    # JWT helpers
    # ------------------------------------------------------------------
    def create_access_token(self, user_id: int) -> str:
        expire = datetime.utcnow() + timedelta(
            minutes=settings.JWT_EXPIRATION_MINUTES
        )
        payload = {
            "sub": str(user_id),
            "exp": expire,
            "type": "access",
        }
        return jwt.encode(
            payload,
            settings.JWT_SECRET_KEY,
            algorithm=settings.JWT_ALGORITHM,
        )

    def create_refresh_token(self, user_id: int) -> str:
        expire = datetime.utcnow() + timedelta(
            days=settings.JWT_REFRESH_EXPIRATION_DAYS
        )
        payload = {
            "sub": str(user_id),
            "exp": expire,
            "type": "refresh",
        }
        return jwt.encode(
            payload,
            settings.JWT_SECRET_KEY,
            algorithm=settings.JWT_ALGORITHM,
        )

    def create_token_pair(self, user_id: int) -> Token:
        return Token(
            access_token=self.create_access_token(user_id),
            refresh_token=self.create_refresh_token(user_id),
        )

    def verify_token(
        self, token: str, token_type: str = "access"
    ) -> int | None:
        try:
            payload = jwt.decode(
                token,
                settings.JWT_SECRET_KEY,
                algorithms=[settings.JWT_ALGORITHM],
            )
            if payload.get("type") != token_type:
                return None
            return int(payload.get("sub"))
        except (JWTError, ValueError):
            return None

    # ------------------------------------------------------------------
    # OTP helpers
    # ------------------------------------------------------------------
    def _generate_otp(self) -> str:
        return f"{random.SystemRandom().randint(0, 999999):06d}"

    async def _create_token(
        self, user_id: int, token_type: EmailTokenType, ttl_minutes: int
    ) -> str:
        # Invalidate any existing unused tokens of the same type
        existing = await self.db.execute(
            select(EmailToken).where(
                EmailToken.user_id == user_id,
                EmailToken.type == token_type,
                EmailToken.used.is_(False),
            )
        )
        for t in existing.scalars().all():
            t.used = True

        raw = (
            self._generate_otp()
            if token_type == EmailTokenType.OTP
            else secrets.token_urlsafe(32)
        )
        self.db.add(EmailToken(
            user_id=user_id,
            token=raw,
            type=token_type,
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=ttl_minutes),
        ))
        await self.db.commit()
        return raw

    async def _consume_token(
        self, token: str, token_type: EmailTokenType
    ) -> EmailToken:
        result = await self.db.execute(
            select(EmailToken).where(
                EmailToken.token == token,
                EmailToken.type == token_type,
                EmailToken.used.is_(False),
            )
        )
        record = result.scalar_one_or_none()
        if not record:
            raise ValueError("Invalid or already used code.")
        if record.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
            raise ValueError("Code has expired. Please request a new one.")
        record.used = True
        await self.db.commit()
        return record

    # ------------------------------------------------------------------
    # Email / password auth
    # ------------------------------------------------------------------
    async def register(
        self,
        email: str,
        password: str,
        name: str | None = None,
    ) -> None:
        existing = await self.user_repo.get_by_email(email)
        if existing and existing.email_verified:
            raise ValueError("Email already registered")
        if existing and not existing.email_verified:
            # Re-send OTP for unverified account
            otp = await self._create_token(existing.id, EmailTokenType.OTP, ttl_minutes=15)
            await email_svc.send_otp(existing.email, existing.name, otp)
            return

        password_hash = self.hash_password(password)
        user = await self.user_repo.create(
            email=email,
            name=name,
            password_hash=password_hash,
            role=UserRole.CUSTOMER_ADMIN,
            email_verified=False,
        )
        otp = await self._create_token(user.id, EmailTokenType.OTP, ttl_minutes=15)
        await email_svc.send_otp(user.email, user.name, otp)

    async def verify_email_otp(
        self, email: str, otp: str
    ) -> tuple[User, Token]:
        user = await self.user_repo.get_by_email(email)
        if not user:
            raise ValueError("Invalid code.")
        record = await self._consume_token(otp, EmailTokenType.OTP)
        if record.user_id != user.id:
            raise ValueError("Invalid code.")
        user.email_verified = True
        await self.db.commit()
        await self.db.refresh(user)
        return user, self.create_token_pair(user.id)

    async def resend_otp(self, email: str) -> None:
        user = await self.user_repo.get_by_email(email)
        if not user or user.email_verified:
            raise ValueError("No pending verification for this email.")
        otp = await self._create_token(user.id, EmailTokenType.OTP, ttl_minutes=15)
        await email_svc.send_otp(user.email, user.name, otp)

    async def forgot_password(self, email: str) -> None:
        user = await self.user_repo.get_by_email(email)
        if not user or not user.password_hash:
            return  # Silently ignore — no enumeration
        token = await self._create_token(user.id, EmailTokenType.RESET, ttl_minutes=60)
        reset_url = f"{settings.FRONTEND_URL}/reset-password?token={token}"
        await email_svc.send_reset_link(user.email, user.name, reset_url)

    async def reset_password(self, token: str, new_password: str) -> None:
        if len(new_password) < 8:
            raise ValueError("Password must be at least 8 characters.")
        record = await self._consume_token(token, EmailTokenType.RESET)
        user = await self.user_repo.get_by_id(record.user_id)
        if not user:
            raise ValueError("User not found.")
        user.password_hash = self.hash_password(new_password)
        await self.db.commit()

    async def login(
        self, email: str, password: str
    ) -> tuple[User, Token]:
        user = await self.user_repo.get_by_email(email)
        if not user or not user.password_hash:
            raise ValueError("Invalid email or password")
        if not self.verify_password(password, user.password_hash):
            raise ValueError("Invalid email or password")
        if not user.email_verified:
            raise ValueError("Please verify your email before logging in.")
        return user, self.create_token_pair(user.id)

    async def refresh(self, refresh_token: str) -> Token:
        user_id = self.verify_token(
            refresh_token, token_type="refresh"
        )
        if not user_id:
            raise ValueError("Invalid or expired refresh token")
        return self.create_token_pair(user_id)

    # ------------------------------------------------------------------
    # Google OAuth (ID-token verification via tokeninfo endpoint)
    # ------------------------------------------------------------------
    async def authenticate_google(
        self, id_token: str
    ) -> tuple[User, Token]:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                "https://oauth2.googleapis.com/tokeninfo",
                params={"id_token": id_token},
            )
            if not resp.is_success:
                raise ValueError("Invalid Google ID token")
            info = resp.json()

        if info.get("aud") != settings.GOOGLE_CLIENT_ID:
            raise ValueError("Token audience mismatch")

        email = info.get("email")
        if not email:
            raise ValueError("No email in Google token")

        google_id = info.get("sub")
        name = info.get("name")
        avatar_url = info.get("picture")

        user = await self.user_repo.get_by_google_id(google_id)
        if not user:
            user = await self.user_repo.get_by_email(email)

        if user:
            if not user.google_id:
                await self.user_repo.update(
                    user.id,
                    google_id=google_id,
                    avatar_url=avatar_url,
                )
        else:
            user = await self.user_repo.create(
                email=email,
                name=name,
                avatar_url=avatar_url,
                google_id=google_id,
                role=UserRole.CUSTOMER_ADMIN,
            )

        return user, self.create_token_pair(user.id)

    # ------------------------------------------------------------------
    # Microsoft OAuth (preserved for internal/legacy use)
    # ------------------------------------------------------------------
    def get_microsoft_auth_url(
        self, state: str | None = None
    ) -> str:
        code_verifier, code_challenge = _generate_pkce()
        combined_state = f"{state or ''}|{code_verifier}"
        params = {
            "client_id": settings.MICROSOFT_CLIENT_ID,
            "response_type": "code",
            "redirect_uri": settings.MICROSOFT_REDIRECT_URI,
            "scope": "openid profile email User.Read",
            "response_mode": "query",
            "state": combined_state,
            "code_challenge": code_challenge,
            "code_challenge_method": "S256",
        }
        base = (
            "https://login.microsoftonline.com/"
            f"{settings.MICROSOFT_TENANT_ID}/oauth2/v2.0/authorize"
        )
        return f"{base}?{urlencode(params)}"

    async def exchange_code_for_token(
        self, code: str, code_verifier: str
    ) -> dict:
        token_url = (
            "https://login.microsoftonline.com/"
            f"{settings.MICROSOFT_TENANT_ID}/oauth2/v2.0/token"
        )
        data = {
            "client_id": settings.MICROSOFT_CLIENT_ID,
            "client_secret": settings.MICROSOFT_CLIENT_SECRET,
            "code": code,
            "redirect_uri": settings.MICROSOFT_REDIRECT_URI,
            "grant_type": "authorization_code",
            "code_verifier": code_verifier,
        }
        async with httpx.AsyncClient() as client:
            response = await client.post(token_url, data=data)
            response.raise_for_status()
            return response.json()

    async def get_microsoft_user_info(
        self, access_token: str
    ) -> dict:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://graph.microsoft.com/v1.0/me",
                headers={"Authorization": f"Bearer {access_token}"},
            )
            response.raise_for_status()
            return response.json()

    async def authenticate_microsoft(
        self, code: str, state: str | None = None
    ) -> tuple[User, Token]:
        anonymous_session_id = None
        code_verifier = ""
        if state and "|" in state:
            parts = state.split("|", 1)
            anonymous_session_id = parts[0] or None
            code_verifier = parts[1]
        elif state:
            anonymous_session_id = state

        token_data = await self.exchange_code_for_token(
            code, code_verifier
        )
        ms_access_token = token_data.get("access_token")
        info = await self.get_microsoft_user_info(ms_access_token)

        email = info.get("mail") or info.get("userPrincipalName")
        if not email:
            raise ValueError(
                "Could not get email from Microsoft account"
            )

        user, _ = await self.user_repo.get_or_create_by_email(
            email=email, name=info.get("displayName")
        )

        if anonymous_session_id:
            await self.conversation_repo.migrate_anonymous_to_user(
                anonymous_session_id, user.id
            )

        return user, self.create_token_pair(user.id)

    async def get_user_by_id(self, user_id: int) -> User | None:
        return await self.user_repo.get_by_id(user_id)
