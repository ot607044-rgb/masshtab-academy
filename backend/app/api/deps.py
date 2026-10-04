import uuid
from datetime import datetime, timezone

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, and_, false
from uuid import UUID
from app.database import get_db
from app.core.security import decode_access_token
from app.models.user import User, UserRole
from app.models.employee import Employee
from app.models.department import Department

security = HTTPBearer()

ADMIN_ROLES = (UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN)
HR_ROLES = (*ADMIN_ROLES, UserRole.HR)
CONTENT_ROLES = (*HR_ROLES, UserRole.METHODOLOGIST)


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
    if current_user.role not in ADMIN_ROLES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Требуются права администратора")
    return current_user


async def get_hr_or_above(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role not in HR_ROLES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Требуются права HR или выше")
    return current_user


async def get_content_creator(current_user: User = Depends(get_current_user)) -> User:
    """Company Admin, HR, Methodologist — can create and edit lessons/topics."""
    if current_user.role not in CONTENT_ROLES:
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


# ── Row-level access to employee data ─────────────────────────────────────────

async def own_employee(db: AsyncSession, user: User, company_id: UUID) -> Employee | None:
    """The employee card linked to the user's account, if any."""
    return await db.scalar(
        select(Employee).where(Employee.user_id == user.id, Employee.company_id == company_id)
    )


async def visible_employees(db: AsyncSession, user: User, company_id: UUID):
    """SQL condition limiting Employee rows to those the user may see.

    HR and admins see the whole company, a department head sees own card,
    direct reports and departments they lead, everyone else sees only own card.
    """
    if user.role in HR_ROLES:
        return Employee.company_id == company_id
    me = await own_employee(db, user, company_id)
    if me is None:
        return false()
    scope = [Employee.id == me.id]
    if user.role == UserRole.DEPARTMENT_HEAD:
        led = select(Department.id).where(Department.company_id == company_id, Department.head_id == me.id)
        scope += [Employee.manager_id == me.id, Employee.department_id.in_(led)]
        if me.department_id:
            scope.append(Employee.department_id == me.department_id)
    return and_(Employee.company_id == company_id, or_(*scope))


async def visible_employee(db: AsyncSession, user: User, company_id: UUID, employee_id: UUID) -> Employee:
    employee = await db.scalar(select(Employee).where(Employee.id == employee_id))
    if employee is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Сотрудник не найден")
    if employee.company_id != company_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Доступ запрещён")
    allowed = await db.scalar(
        select(Employee.id).where(Employee.id == employee_id, await visible_employees(db, user, company_id))
    )
    if allowed is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Доступ запрещён")
    return employee
