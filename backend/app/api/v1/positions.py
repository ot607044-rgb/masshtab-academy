from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from uuid import UUID
import uuid
from app.database import get_db
from app.schemas.position import PositionCreate, PositionUpdate, PositionResponse
from app.models.position import Position
from app.models.user import UserRole
from app.api.deps import get_hr_or_above, get_any_company_user

router = APIRouter()


@router.get("/", response_model=List[PositionResponse])
async def list_positions(
    department_id: UUID = None,
    current_user=Depends(get_any_company_user),
    db: AsyncSession = Depends(get_db),
):
    q = select(Position)
    if current_user.role != UserRole.SUPER_ADMIN:
        q = q.where(Position.company_id == current_user.company_id)
    if department_id:
        q = q.where(Position.department_id == department_id)
    result = await db.execute(q.order_by(Position.name))
    return result.scalars().all()


@router.post("/", response_model=PositionResponse, status_code=status.HTTP_201_CREATED)
async def create_position(
    data: PositionCreate,
    current_user=Depends(get_hr_or_above),
    db: AsyncSession = Depends(get_db),
):
    pos = Position(
        id=uuid.uuid4(),
        name=data.name,
        description=data.description,
        department_id=data.department_id,
        required_skills=data.required_skills,
        company_id=current_user.company_id,
    )
    db.add(pos)
    await db.commit()
    await db.refresh(pos)
    return pos


@router.get("/{pos_id}", response_model=PositionResponse)
async def get_position(
    pos_id: UUID,
    current_user=Depends(get_any_company_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Position).where(Position.id == pos_id))
    pos = result.scalar_one_or_none()
    if not pos:
        raise HTTPException(status_code=404, detail="Должность не найдена")
    if current_user.role != UserRole.SUPER_ADMIN and pos.company_id != current_user.company_id:
        raise HTTPException(status_code=403, detail="Доступ запрещён")
    return pos


@router.patch("/{pos_id}", response_model=PositionResponse)
async def update_position(
    pos_id: UUID,
    data: PositionUpdate,
    current_user=Depends(get_hr_or_above),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Position).where(Position.id == pos_id))
    pos = result.scalar_one_or_none()
    if not pos:
        raise HTTPException(status_code=404, detail="Должность не найдена")
    if current_user.role != UserRole.SUPER_ADMIN and pos.company_id != current_user.company_id:
        raise HTTPException(status_code=403, detail="Доступ запрещён")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(pos, field, value)
    await db.commit()
    await db.refresh(pos)
    return pos


@router.delete("/{pos_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_position(
    pos_id: UUID,
    current_user=Depends(get_hr_or_above),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Position).where(Position.id == pos_id))
    pos = result.scalar_one_or_none()
    if not pos:
        raise HTTPException(status_code=404, detail="Должность не найдена")
    if current_user.role != UserRole.SUPER_ADMIN and pos.company_id != current_user.company_id:
        raise HTTPException(status_code=403, detail="Доступ запрещён")
    await db.delete(pos)
    await db.commit()
