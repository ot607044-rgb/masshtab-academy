from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from uuid import UUID
import uuid
from app.database import get_db
from app.schemas.user import UserCreate, UserResponse, UserUpdate
from app.models.user import User, UserRole
from app.api.deps import get_current_user, get_company_admin_or_above, check_company_access
from app.core.security import get_password_hash
from app.models.base import utc_now

router = APIRouter()


@router.get("/", response_model=List[UserResponse])
async def list_users(
    current_user: User = Depends(get_company_admin_or_above),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role == UserRole.SUPER_ADMIN:
        result = await db.execute(select(User))
    else:
        # Company admin sees only users of their company
        result = await db.execute(
            select(User).where(User.company_id == current_user.company_id)
        )
    return result.scalars().all()


@router.post("/", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    data: UserCreate,
    current_user: User = Depends(get_company_admin_or_above),
    db: AsyncSession = Depends(get_db),
):
    # Company admin can only create users within their own company
    if current_user.role == UserRole.COMPANY_ADMIN:
        if data.company_id and data.company_id != current_user.company_id:
            raise HTTPException(status_code=403, detail="Нельзя создавать пользователей чужой компании")
        data.company_id = current_user.company_id
        if data.role == UserRole.SUPER_ADMIN:
            raise HTTPException(status_code=403, detail="Нельзя назначить роль Super Admin")

    email_check = await db.execute(select(User).where(User.email == data.email))
    if email_check.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email уже зарегистрирован")

    user = User(
        id=uuid.uuid4(),
        email=data.email,
        hashed_password=get_password_hash(data.password),
        full_name=data.full_name,
        role=data.role,
        company_id=data.company_id,
        activated_at=utc_now(),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    # Own account, or an administrator of the same company
    if current_user.role != UserRole.SUPER_ADMIN and user.id != current_user.id:
        if current_user.role != UserRole.COMPANY_ADMIN or user.company_id != current_user.company_id:
            raise HTTPException(status_code=403, detail="Доступ запрещён")
    return user


@router.patch("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: UUID,
    data: UserUpdate,
    current_user: User = Depends(get_company_admin_or_above),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    if current_user.role == UserRole.COMPANY_ADMIN:
        if user.company_id != current_user.company_id:
            raise HTTPException(status_code=403, detail="Доступ запрещён")
        if data.role == UserRole.SUPER_ADMIN:
            raise HTTPException(status_code=403, detail="Нельзя назначить роль Super Admin")
        if user.id == current_user.id and (data.role is not None or data.is_active is False):
            raise HTTPException(status_code=409, detail="Нельзя изменить роль или заблокировать собственную учётную запись")

    for field, value in data.model_dump(exclude_none=True).items():
        setattr(user, field, value)
    await db.commit()
    await db.refresh(user)
    return user
