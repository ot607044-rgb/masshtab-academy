"""Settings → «Пользователи и доступ»: personal accounts for employee cards."""
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_company_admin_or_above, get_effective_company_id
from app.core.accounts import invitation_path, issue_invitation, revoke_invitations, send_invitation_email, unusable_password
from app.database import get_db
from app.models.base import utc_now
from app.models.company import Company
from app.models.employee import Employee, EmployeeStatus
from app.models.user import User, UserInvitation
from app.schemas.access import AccessUpdate, AccessUser, GrantAccess, InvitationIssued

router = APIRouter()


async def pending_invitations(db, user_ids):
    rows = await db.execute(
        select(UserInvitation.user_id, func.max(UserInvitation.expires_at))
        .where(UserInvitation.user_id.in_(user_ids), UserInvitation.used_at.is_(None), UserInvitation.revoked_at.is_(None))
        .group_by(UserInvitation.user_id)
    )
    return dict(rows.all())


def access_row(user, employee, invite_expires):
    if not user.is_active:
        status = "blocked"
    elif user.activated_at is None:
        status = "invited" if invite_expires and invite_expires > utc_now() else "invite_expired"
    else:
        status = "active"
    return AccessUser(
        id=user.id, email=user.email, full_name=user.full_name, role=user.role, status=status,
        employee_id=employee.id if employee else None,
        employee_name=employee.full_name if employee else None,
        employee_status=employee.status if employee else None,
        invitation_expires_at=invite_expires if status in ("invited", "invite_expired") else None,
        last_login_at=user.last_login_at, created_at=user.created_at,
    )


async def build_rows(db, company_id, users):
    ids = [u.id for u in users]
    if not ids:
        return []
    employees = {e.user_id: e for e in (await db.execute(select(Employee).where(Employee.company_id == company_id, Employee.user_id.in_(ids)))).scalars()}
    invites = await pending_invitations(db, ids)
    return [access_row(u, employees.get(u.id), invites.get(u.id)) for u in users]


async def company_user(db, user_id, company_id):
    user = await db.scalar(select(User).where(User.id == user_id, User.company_id == company_id))
    if user is None:
        raise HTTPException(404, "Пользователь не найден")
    return user


async def send_invitation(db, user, company_id, admin):
    token, invitation = await issue_invitation(db, user, admin.id)
    await db.commit()
    company_name = await db.scalar(select(Company.name).where(Company.id == company_id))
    email_sent = await send_invitation_email(user, company_name or "", token)
    rows = await build_rows(db, company_id, [user])
    return InvitationIssued(user=rows[0], invite_path=invitation_path(token), invite_expires_at=invitation.expires_at, email_sent=email_sent)


@router.get("/users", response_model=list[AccessUser])
async def list_access(admin=Depends(get_company_admin_or_above), company_id: UUID = Depends(get_effective_company_id), db: AsyncSession = Depends(get_db)):
    users = (await db.execute(select(User).where(User.company_id == company_id).order_by(User.full_name))).scalars().all()
    return await build_rows(db, company_id, users)


@router.get("/employees/{employee_id}", response_model=AccessUser | None)
async def employee_access(employee_id: UUID, admin=Depends(get_company_admin_or_above), company_id: UUID = Depends(get_effective_company_id), db: AsyncSession = Depends(get_db)):
    employee = await db.scalar(select(Employee).where(Employee.id == employee_id, Employee.company_id == company_id))
    if employee is None:
        raise HTTPException(404, "Сотрудник не найден")
    user = await db.scalar(select(User).where(User.id == employee.user_id, User.company_id == company_id)) if employee.user_id else None
    if user is None:
        return None
    return (await build_rows(db, company_id, [user]))[0]


@router.post("/employees/{employee_id}", response_model=InvitationIssued, status_code=201)
async def grant_access(employee_id: UUID, data: GrantAccess, admin=Depends(get_company_admin_or_above), company_id: UUID = Depends(get_effective_company_id), db: AsyncSession = Depends(get_db)):
    employee = await db.scalar(select(Employee).where(Employee.id == employee_id, Employee.company_id == company_id).with_for_update())
    if employee is None:
        raise HTTPException(404, "Сотрудник не найден")
    if employee.status == EmployeeStatus.FIRED:
        raise HTTPException(409, "Сотрудник уволен — доступ предоставить нельзя")
    if employee.user_id and await db.get(User, employee.user_id):
        raise HTTPException(409, "У сотрудника уже есть учётная запись")
    email = data.email.strip().lower()
    if await db.scalar(select(User.id).where(func.lower(User.email) == email)):
        raise HTTPException(409, "Этот email уже используется другой учётной записью")
    user = User(email=email, full_name=employee.full_name, role=data.role.value, company_id=company_id,
                hashed_password=unusable_password(), is_active=True, activated_at=None)
    db.add(user)
    await db.flush()
    employee.user_id = user.id
    if not employee.email:
        employee.email = email
    return await send_invitation(db, user, company_id, admin)


@router.post("/users/{user_id}/invitation", response_model=InvitationIssued)
async def resend_invitation(user_id: UUID, admin=Depends(get_company_admin_or_above), company_id: UUID = Depends(get_effective_company_id), db: AsyncSession = Depends(get_db)):
    user = await company_user(db, user_id, company_id)
    if user.activated_at is not None:
        raise HTTPException(409, "Пользователь уже подключён")
    if not user.is_active:
        raise HTTPException(409, "Доступ заблокирован — сначала разблокируйте пользователя")
    return await send_invitation(db, user, company_id, admin)


@router.patch("/users/{user_id}", response_model=AccessUser)
async def update_access(user_id: UUID, data: AccessUpdate, admin=Depends(get_company_admin_or_above), company_id: UUID = Depends(get_effective_company_id), db: AsyncSession = Depends(get_db)):
    user = await company_user(db, user_id, company_id)
    if user.id == admin.id:
        raise HTTPException(409, "Нельзя изменить роль или заблокировать собственную учётную запись")
    employee = await db.scalar(select(Employee).where(Employee.user_id == user.id, Employee.company_id == company_id))
    if data.is_active is True and employee is not None and employee.status == EmployeeStatus.FIRED:
        raise HTTPException(409, "Сотрудник уволен — сначала измените его статус")
    if data.role is not None:
        user.role = data.role.value
    if data.is_active is not None:
        user.is_active = data.is_active
        if not data.is_active:
            await revoke_invitations(db, user.id)
    await db.commit()
    await db.refresh(user)
    return (await build_rows(db, company_id, [user]))[0]
