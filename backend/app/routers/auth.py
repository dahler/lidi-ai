from fastapi import APIRouter, Depends, HTTPException, status
from fastapi import Request, Response
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.services.auth import AuthService
from app.middleware.auth import get_current_user, get_session_id
from app.schemas.auth import (
    RegisterRequest,
    LoginRequest,
    GoogleAuthRequest,
    RefreshRequest,
    VerifyEmailRequest,
    ResendOtpRequest,
    ForgotPasswordRequest,
    ResetPasswordRequest,
)
from app.schemas.user import UserResponse
from app.models.user import User
from app.config import settings


def _login_response(user, token):
    return {
        "user": UserResponse.model_validate(user),
        "access_token": token.access_token,
        "refresh_token": token.refresh_token,
        "token_type": "bearer",
    }


router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", status_code=status.HTTP_202_ACCEPTED)
async def register(
    body: RegisterRequest,
    db: AsyncSession = Depends(get_db),
):
    try:
        svc = AuthService(db)
        await svc.register(
            email=body.email,
            password=body.password,
            name=body.name,
        )
        return {"message": "OTP sent to your email. Please verify to continue."}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/verify-email")
async def verify_email(
    body: VerifyEmailRequest,
    db: AsyncSession = Depends(get_db),
):
    try:
        svc = AuthService(db)
        user, token = await svc.verify_email_otp(body.email, body.otp)
        return _login_response(user, token)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/resend-otp", status_code=status.HTTP_202_ACCEPTED)
async def resend_otp(
    body: ResendOtpRequest,
    db: AsyncSession = Depends(get_db),
):
    try:
        svc = AuthService(db)
        await svc.resend_otp(body.email)
        return {"message": "OTP resent."}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/forgot-password", status_code=status.HTTP_202_ACCEPTED)
async def forgot_password(
    body: ForgotPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    svc = AuthService(db)
    await svc.forgot_password(body.email)
    # Always return success to avoid email enumeration
    return {"message": "If that email is registered, a reset link has been sent."}


@router.post("/reset-password")
async def reset_password(
    body: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    try:
        svc = AuthService(db)
        await svc.reset_password(body.token, body.password)
        return {"message": "Password updated successfully."}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/login")
async def login(
    body: LoginRequest,
    db: AsyncSession = Depends(get_db),
):
    try:
        svc = AuthService(db)
        user, token = await svc.login(
            email=body.email, password=body.password
        )
        return _login_response(user, token)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
        )


@router.post("/google")
async def google_login(
    body: GoogleAuthRequest,
    db: AsyncSession = Depends(get_db),
):
    try:
        svc = AuthService(db)
        user, token = await svc.authenticate_google(body.id_token)
        return _login_response(user, token)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
        )


@router.post("/refresh")
async def refresh_token(
    body: RefreshRequest,
    db: AsyncSession = Depends(get_db),
):
    try:
        svc = AuthService(db)
        token = await svc.refresh(body.refresh_token)
        user_id = svc.verify_token(token.access_token)
        user = await svc.get_user_by_id(user_id)
        return _login_response(user, token)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
        )


# ── Microsoft OAuth (kept for internal / legacy use) ──────────────────

@router.get("/login/microsoft")
async def microsoft_login(request: Request, response: Response):
    session_id = get_session_id(request, response)
    svc = AuthService(None)
    return {"auth_url": svc.get_microsoft_auth_url(state=session_id)}


@router.get("/callback")
async def microsoft_callback(
    request: Request,
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    error_description: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    frontend_url = (
        settings.CORS_ORIGINS[0]
        if settings.CORS_ORIGINS
        else "http://localhost:3000"
    )

    if error:
        desc = error_description or ""
        return RedirectResponse(
            url=(
                f"{frontend_url}/auth/callback"
                f"?error={error}&error_description={desc}"
            )
        )

    if not code:
        return RedirectResponse(
            url=f"{frontend_url}/auth/callback?error=missing_code"
        )

    try:
        svc = AuthService(db)
        user, token = await svc.authenticate_microsoft(
            code=code, state=state
        )
        return RedirectResponse(
            url=(
                f"{frontend_url}/auth/callback"
                f"?token={token.access_token}"
                f"&refresh={token.refresh_token}"
            )
        )
    except Exception as e:
        return RedirectResponse(
            url=(
                f"{frontend_url}/auth/callback"
                f"?error=auth_failed&error_description={e}"
            )
        )


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie(settings.ANONYMOUS_SESSION_COOKIE)
    return {"message": "Logged out successfully"}
