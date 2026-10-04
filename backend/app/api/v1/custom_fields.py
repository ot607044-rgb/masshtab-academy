from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
from uuid import UUID
import uuid
from app.database import get_db
from app.schemas.settings import CustomFieldCreate, CustomFieldUpdate, CustomFieldResponse
from app.models.settings import CustomField
from app.api.deps import get_company_admin_or_above, get_any_company_user, get_effective_company_id

router = APIRouter()


@router.get("/", response_model=List[CustomFieldResponse])
async def list_custom_fields(
    entity_type: Optional[str] = None,
    section_id: Optional[UUID] = None,
    current_user=Depends(get_any_company_user),
    effective_company_id: UUID = Depends(get_effective_company_id),
    db: AsyncSession = Depends(get_db),
):
    q = select(CustomField).where(CustomField.company_id == effective_company_id)
    if entity_type:
        q = q.where(CustomField.entity_type == entity_type)
    if section_id:
        q = q.where(CustomField.section_id == section_id)
    result = await db.execute(q.order_by(CustomField.order_index, CustomField.name))
    return result.scalars().all()


@router.post("/", response_model=CustomFieldResponse, status_code=status.HTTP_201_CREATED)
async def create_custom_field(
    data: CustomFieldCreate,
    current_user=Depends(get_company_admin_or_above),
    effective_company_id: UUID = Depends(get_effective_company_id),
    db: AsyncSession = Depends(get_db),
):
    field = CustomField(
        id=uuid.uuid4(),
        company_id=effective_company_id,
        name=data.name,
        field_type=data.field_type,
        entity_type=data.entity_type,
        section_id=data.section_id,
        options=data.options,
        is_required=data.is_required,
        order_index=data.order_index,
    )
    db.add(field)
    await db.commit()
    await db.refresh(field)
    return field


@router.get("/{field_id}", response_model=CustomFieldResponse)
async def get_custom_field(
    field_id: UUID,
    current_user=Depends(get_any_company_user),
    effective_company_id: UUID = Depends(get_effective_company_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(CustomField).where(CustomField.id == field_id))
    field = result.scalar_one_or_none()
    if not field:
        raise HTTPException(status_code=404, detail="Поле не найдено")
    if field.company_id != effective_company_id:
        raise HTTPException(status_code=403, detail="Доступ запрещён")
    return field


@router.patch("/{field_id}", response_model=CustomFieldResponse)
async def update_custom_field(
    field_id: UUID,
    data: CustomFieldUpdate,
    current_user=Depends(get_company_admin_or_above),
    effective_company_id: UUID = Depends(get_effective_company_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(CustomField).where(CustomField.id == field_id))
    field = result.scalar_one_or_none()
    if not field:
        raise HTTPException(status_code=404, detail="Поле не найдено")
    if field.company_id != effective_company_id:
        raise HTTPException(status_code=403, detail="Доступ запрещён")
    for key, value in data.model_dump(exclude_none=True).items():
        setattr(field, key, value)
    await db.commit()
    await db.refresh(field)
    return field


@router.delete("/{field_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_custom_field(
    field_id: UUID,
    current_user=Depends(get_company_admin_or_above),
    effective_company_id: UUID = Depends(get_effective_company_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(CustomField).where(CustomField.id == field_id))
    field = result.scalar_one_or_none()
    if not field:
        raise HTTPException(status_code=404, detail="Поле не найдено")
    if field.company_id != effective_company_id:
        raise HTTPException(status_code=403, detail="Доступ запрещён")
    await db.delete(field)
    await db.commit()
