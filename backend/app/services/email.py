import resend
from app.config import settings


def _client() -> None:
    resend.api_key = settings.RESEND_API_KEY


async def send_otp(to_email: str, name: str | None, otp: str) -> None:
    _client()
    display_name = name or to_email
    resend.Emails.send({
        "from": settings.RESEND_FROM_EMAIL,
        "to": [to_email],
        "subject": "Your Lidi AI verification code",
        "html": f"""
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px">
          <h2 style="color:#6366f1;margin-bottom:8px">Lidi AI</h2>
          <p style="color:#374151">Hi {display_name},</p>
          <p style="color:#374151">Use the code below to verify your email address.
          It expires in <strong>15 minutes</strong>.</p>
          <div style="margin:32px 0;text-align:center">
            <span style="font-size:40px;font-weight:700;letter-spacing:12px;color:#6366f1">
              {otp}
            </span>
          </div>
          <p style="color:#9ca3af;font-size:13px">
            If you didn't create a Lidi AI account, you can safely ignore this email.
          </p>
        </div>
        """,
    })


async def send_reset_link(to_email: str, name: str | None, reset_url: str) -> None:
    _client()
    display_name = name or to_email
    resend.Emails.send({
        "from": settings.RESEND_FROM_EMAIL,
        "to": [to_email],
        "subject": "Reset your Lidi AI password",
        "html": f"""
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px">
          <h2 style="color:#6366f1;margin-bottom:8px">Lidi AI</h2>
          <p style="color:#374151">Hi {display_name},</p>
          <p style="color:#374151">Click the button below to reset your password.
          The link expires in <strong>1 hour</strong>.</p>
          <div style="margin:32px 0;text-align:center">
            <a href="{reset_url}"
               style="background:#6366f1;color:#fff;text-decoration:none;
                      padding:14px 32px;border-radius:8px;font-weight:600;
                      display:inline-block">
              Reset Password
            </a>
          </div>
          <p style="color:#9ca3af;font-size:13px">
            Or copy this link: <a href="{reset_url}" style="color:#6366f1">{reset_url}</a>
          </p>
          <p style="color:#9ca3af;font-size:13px">
            If you didn't request a password reset, you can safely ignore this email.
          </p>
        </div>
        """,
    })
