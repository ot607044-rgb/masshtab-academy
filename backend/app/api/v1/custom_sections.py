from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from uuid import UUID
import uuid
from app.database import get_db
from app.schemas.settings import (
    CustomSectionCreate, CustomSectionUpdate, CustomSectionResponse,
    CustomSectionRecordCreate, CustomSectionRecordUpdate, CustomSectionRecordResponse,
)
from app.models.settings import CustomSection, CustomSectionRecord
from app.api.deps import ADMIN_ROLES, get_company_admin_or_above, get_any_company_user, get_effective_company_id

router = APIRouter()


def can_use(section: CustomSection, user) -> bool:
    return user.role in ADMIN_ROLES or not section.allowed_roles or user.role in section.allowed_roles


async def accessible_section(db, section_id, company_id, user) -> CustomSection:
    section = await db.scalar(select(CustomSection).where(CustomSection.id == section_id, CustomSection.company_id == company_id))
    if section is None:
        raise HTTPException(status_code=404, detail="Раздел не найден")
    if not can_use(section, user):
        raise HTTPException(status_code=403, detail="Доступ запрещён")
    return section


# ── Sections ──────────────────────────────────────────────────────────────────

@router.get("/", response_model=List[CustomSectionResponse])
async def list_custom_sections(
    current_user=Depends(get_any_company_user),
    effective_company_id: UUID = Depends(get_effective_company_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CustomSection)
        .where(CustomSection.company_id == effective_company_id)
        .order_by(CustomSection.order_index, CustomSection.name)
    )
    return [section for section in result.scalars().all() if can_use(section, current_user)]


@router.post("/", response_model=CustomSectionResponse, status_code=status.HTTP_201_CREATED)
async def create_custom_section(
    data: CustomSectionCreate,
    current_user=Depends(get_company_admin_or_above),
    effective_company_id: UUID = Depends(get_effective_company_id),
    db: AsyncSession = Depends(get_db),
):
    section = CustomSection(
        id=uuid.uuid4(),
        company_id=effective_company_id,
        name=data.name,
        slug=data.slug,
        icon=data.icon,
        description=data.description,
        is_active=data.is_active,
        order_index=data.order_index,
        allowed_roles=data.allowed_roles,
    )
    db.add(section)
    await db.commit()
    await db.refresh(section)
    return section


@router.get("/{section_id}", response_model=CustomSectionResponse)
async def get_custom_section(
    section_id: UUID,
    current_user=Depends(get_any_company_user),
    effective_company_id: UUID = Depends(get_effective_company_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(CustomSection).where(CustomSection.id == section_id))
    section = result.scalar_one_or_none()
    if not section:
        raise HTTPException(status_code=404, detail="Раздел не найден")
    if section.company_id != effective_company_id or not can_use(section, current_user):
        raise HTTPException(status_code=403, detail="Доступ запрещён")
    return section


@router.patch("/{section_id}", response_model=CustomSectionResponse)
async def update_custom_section(
    section_id: UUID,
    data: CustomSectionUpdate,
    current_user=Depends(get_company_admin_or_above),
    effective_company_id: UUID = Depends(get_effective_company_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(CustomSection).where(CustomSection.id == section_id))
    section = result.scalar_one_or_none()
    if not section:
        raise HTTPException(status_code=404, detail="Раздел не найден")
    if section.company_id != effective_company_id:
        raise HTTPException(status_code=403, detail="Доступ запрещён")
    for key, value in data.model_dump(exclude_none=True).items():
        setattr(section, key, value)
    await db.commit()
    await db.refresh(section)
    return section


@router.delete("/{section_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_custom_section(
    section_id: UUID,
    current_user=Depends(get_company_admin_or_above),
    effective_company_id: UUID = Depends(get_effective_company_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(CustomSection).where(CustomSection.id == section_id))
    section = result.scalar_one_or_none()
    if not section:
        raise HTTPException(status_code=404, detail="Раздел не найден")
    if section.company_id != effective_company_id:
        raise HTTPException(status_code=403, detail="Доступ запрещён")
    await db.delete(section)
    await db.commit()


# ── Records ───────────────────────────────────────────────────────────────────

@router.get("/{section_id}/records", response_model=List[CustomSectionRecordResponse])
async def list_section_records(
    section_id: UUID,
    current_user=Depends(get_any_company_user),
    effective_company_id: UUID = Depends(get_effective_company_id),
    db: AsyncSession = Depends(get_db),
):
    # Verify section belongs to company
    await accessible_section(db, section_id, effective_company_id, current_user)

    result = await db.execute(
        select(CustomSectionRecord)
        .where(
            CustomSectionRecord.section_id == section_id,
            CustomSectionRecord.company_id == effective_company_id,
        )
        .order_by(CustomSectionRecord.created_at.desc())
    )
    return result.scalars().all()


@router.post("/{section_id}/records", response_model=CustomSectionRecordResponse, status_code=status.HTTP_201_CREATED)
async def create_section_record(
    section_id: UUID,
    data: CustomSectionRecordCreate,
    current_user=Depends(get_any_company_user),
    effective_company_id: UUID = Depends(get_effective_company_id),
    db: AsyncSession = Depends(get_db),
):
    await accessible_section(db, section_id, effective_company_id, current_user)

    record = CustomSectionRecord(
        id=uuid.uuid4(),
        section_id=section_id,
        company_id=effective_company_id,
        title=data.title,
        data=data.data,
        status_id=data.status_id,
        created_by=current_user.id,
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)
    return record


@router.patch("/{section_id}/records/{record_id}", response_model=CustomSectionRecordResponse)
async def update_section_record(
    section_id: UUID,
    record_id: UUID,
    data: CustomSectionRecordUpdate,
    current_user=Depends(get_any_company_user),
    effective_company_id: UUID = Depends(get_effective_company_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CustomSectionRecord).where(
            CustomSectionRecord.id == record_id,
            CustomSectionRecord.section_id == section_id,
            CustomSectionRecord.company_id == effective_company_id,
        )
    )
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=404, detail="Запись не найдена")
    await accessible_section(db, section_id, effective_company_id, current_user)
    for key, value in data.model_dump(exclude_none=True).items():
        setattr(record, key, value)
    await db.commit()
    await db.refresh(record)
    return record


@router.delete("/{section_id}/records/{record_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_section_record(
    section_id: UUID,
    record_id: UUID,
    current_user=Depends(get_any_company_user),
    effective_company_id: UUID = Depends(get_effective_company_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CustomSectionRecord).where(
            CustomSectionRecord.id == record_id,
            CustomSectionRecord.section_id == section_id,
            CustomSectionRecord.company_id == effective_company_id,
        )
    )
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=404, detail="Запись не найдена")
    await accessible_section(db, section_id, effective_company_id, current_user)
    await db.delete(record)
    await db.commit()
