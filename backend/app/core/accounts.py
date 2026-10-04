"""Personal accounts: invitations, activation and revoking access."""
import hashlib
import logging
import secrets
import smtplib
from datetime import timedelta
from email.message import EmailMessage

from sqlalchemy import select, update
from starlette.concurrency import run_in_threadpool

from app.config import settings
from app.core.security import get_password_hash
from app.models.base import utc_now
from app.models.user import User, UserInvitation

logger = logging.getLogger(__name__)
MIN_PASSWORD_LENGTH = 8


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def unusable_password() -> str:
    # Invited accounts cannot log in until the invitation sets a real password.
    return get_password_hash(secrets.token_urlsafe(32))


def invitation_path(token: str) -> str:
    return f"/invite/{token}"


async def revoke_invitations(db, user_id) -> None:
    await db.execute(
        update(UserInvitation)
        .where(UserInvitation.user_id == user_id, UserInvitation.used_at.is_(None), UserInvitation.revoked_at.is_(None))
        .values(revoked_at=utc_now())
    )


async def issue_invitation(db, user: User, created_by) -> tuple[str, UserInvitation]:
    """Revokes previous links and returns a fresh one-time token."""
    await revoke_invitations(db, user.id)
    token = secrets.token_urlsafe(32)
    invitation = UserInvitation(
        user_id=user.id, company_id=user.company_id, token_hash=hash_token(token),
        expires_at=utc_now() + timedelta(hours=settings.INVITATION_TTL_HOURS), created_by=created_by,
    )
    db.add(invitation)
    return token, invitation


async def active_invitation(db, token: str) -> UserInvitation | None:
    return await db.scalar(
        select(UserInvitation).where(
            UserInvitation.token_hash == hash_token(token),
            UserInvitation.used_at.is_(None),
            UserInvitation.revoked_at.is_(None),
            UserInvitation.expires_at > utc_now(),
        )
    )


async def disable_account(db, user_id) -> None:
    """Blocks sign-in but keeps the account so learning history stays attributed."""
    if user_id is None:
        return
    user = await db.get(User, user_id)
    if user is not None:
        user.is_active = False
    await revoke_invitations(db, user_id)


def email_enabled() -> bool:
    return bool(settings.SMTP_HOST and settings.PUBLIC_APP_URL and (settings.SMTP_FROM or settings.SMTP_USER))


def _send(message: EmailMessage) -> None:
    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as smtp:
        if settings.SMTP_STARTTLS:
            smtp.starttls()
        if settings.SMTP_USER:
            smtp.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        smtp.send_message(message)


async def send_invitation_email(user: User, company_name: str, token: str) -> bool:
    if not email_enabled():
        return False
    link = settings.PUBLIC_APP_URL.rstrip("/") + invitation_path(token)
    message = EmailMessage()
    message["Subject"] = f"Приглашение в Академию Масштаба — {company_name}"
    message["From"] = settings.SMTP_FROM or settings.SMTP_USER
    message["To"] = user.email
    message.set_content(
        f"Здравствуйте, {user.full_name}!\n\n"
        f"Вам открыт доступ к корпоративной академии компании «{company_name}».\n"
        f"Чтобы войти, задайте пароль по ссылке (действует {settings.INVITATION_TTL_HOURS} ч.):\n{link}\n\n"
        "Если вы не ждали это письмо, просто проигнорируйте его."
    )
    try:
        await run_in_threadpool(_send, message)
        return True
    except (OSError, smtplib.SMTPException):
        logger.exception("Could not send invitation email")
        return False
