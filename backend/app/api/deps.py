import uuid
from datetime import datetime, timezone

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID
from app.database import get_db
from app.core.security import decode_access_token
from app.models.user import User, UserRole

security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    token = credentials.credentials
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Недействительный токен")
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Недействительный токен")
    result = await db.execute(
        select(User).where(User.id == UUID(user_id), User.is_active == True)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Пользователь не найден")
    return user


async def get_super_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != UserRole.SUPER_ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Требуются права Super Admin")
    return current_user


async def get_company_admin_or_above(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role not in (UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Требуются права администратора")
    return current_user


async def get_hr_or_above(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role not in (UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.HR):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Требуются права HR или выше")
    return current_user


async def get_content_creator(current_user: User = Depends(get_current_user)) -> User:
    """Company Admin, HR, Methodologist — can create and edit lessons/topics."""
    if current_user.role not in (
        UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.HR, UserRole.METHODOLOGIST
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Требуются права методолога, HR или администратора",
        )
    return current_user


async def get_any_company_user(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role == UserRole.SUPER_ADMIN:
        return current_user
    if not current_user.company_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Пользователь не привязан к компании")
    return current_user


def check_company_access(current_user: User, company_id: UUID) -> None:
    if current_user.role == UserRole.SUPER_ADMIN:
        return
    if current_user.company_id != company_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Доступ запрещён")


# ── Support-mode aware company resolution ─────────────────────────────────────

async def _validate_support_session(
    db: AsyncSession,
    session_id_str: str,
    super_admin_id: UUID,
    request: Request,
) -> UUID:
    """Validates the X-Support-Session header and returns the company_id.
    Also records an audit log entry (committed with the request transaction)."""
    from app.models.support import SupportAccessRequest, SupportAccessLog

    try:
        session_id = UUID(session_id_str)
    except (ValueError, AttributeError):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Некорректный идентификатор сессии техподдержки")

    result = await db.execute(
        select(SupportAccessRequest).where(
            SupportAccessRequest.id == session_id,
            SupportAccessRequest.super_admin_id == super_admin_id,
            SupportAccessRequest.status == "approved",
        )
    )
    session = result.scalar_one_or_none()

    if not session:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Сессия техподдержки не найдена или не активна. Запросите доступ у администратора компании.",
        )

    now = datetime.now(timezone.utc)
    exp = session.expires_at
    if exp:
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        if exp < now:
            session.status = "revoked"
            session.revoked_at = now
            await db.commit()
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                "Срок действия сессии техподдержки истёк",
            )

    # Record access in audit log
    log = SupportAccessLog(
        id=uuid.uuid4(),
        session_id=session.id,
        super_admin_id=super_admin_id,
        company_id=session.company_id,
        endpoint=str(request.url.path),
        method=request.method,
    )
    db.add(log)
    # The log is committed when get_db commits at end of request

    return session.company_id


async def get_effective_company_id(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UUID:
    """Returns the effective company_id for data-scoped queries.

    Regular users → their own company_id.
    Super admin → company_id from a validated support session (X-Support-Session header).
    Super admin without session → 403.
    """
    if current_user.role != UserRole.SUPER_ADMIN:
        if not current_user.company_id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Пользователь не привязан к компании")
        return current_user.company_id

    session_id_str = request.headers.get("X-Support-Session")
    if not session_id_str:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Для доступа к данным компании необходима активная сессия техподдержки",
        )

    return await _validate_support_session(db, session_id_str, current_user.id, request)
