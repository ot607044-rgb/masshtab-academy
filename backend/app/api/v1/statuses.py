from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from uuid import UUID
import uuid
from app.database import get_db
from app.schemas.settings import (
    StatusCreate, StatusUpdate, StatusResponse,
    FunnelCreate, FunnelUpdate, FunnelResponse,
    FunnelStageCreate, FunnelStageUpdate, FunnelStageResponse,
)
from app.models.settings import Status, Funnel, FunnelStage
from app.api.deps import get_company_admin_or_above, get_any_company_user, get_effective_company_id

router = APIRouter()


# ── Statuses ──────────────────────────────────────────────────────────────────

@router.get("/", response_model=List[StatusResponse])
async def list_statuses(
    current_user=Depends(get_any_company_user),
    effective_company_id: UUID = Depends(get_effective_company_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Status)
        .where(Status.company_id == effective_company_id)
        .order_by(Status.order_index, Status.name)
    )
    return result.scalars().all()


@router.post("/", response_model=StatusResponse, status_code=status.HTTP_201_CREATED)
async def create_status(
    data: StatusCreate,
    current_user=Depends(get_company_admin_or_above),
    effective_company_id: UUID = Depends(get_effective_company_id),
    db: AsyncSession = Depends(get_db),
):
    st = Status(
        id=uuid.uuid4(),
        company_id=effective_company_id,
        name=data.name,
        funnel_id=data.funnel_id,
        color=data.color,
        order_index=data.order_index,
        is_final=data.is_final,
        is_positive=data.is_positive,
    )
    db.add(st)
    await db.commit()
    await db.refresh(st)
    return st


@router.get("/{status_id}", response_model=StatusResponse)
async def get_status(
    status_id: UUID,
    current_user=Depends(get_any_company_user),
    effective_company_id: UUID = Depends(get_effective_company_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Status).where(Status.id == status_id))
    st = result.scalar_one_or_none()
    if not st:
        raise HTTPException(status_code=404, detail="Статус не найден")
    if st.company_id != effective_company_id:
        raise HTTPException(status_code=403, detail="Доступ запрещён")
    return st


@router.patch("/{status_id}", response_model=StatusResponse)
async def update_status(
    status_id: UUID,
    data: StatusUpdate,
    current_user=Depends(get_company_admin_or_above),
    effective_company_id: UUID = Depends(get_effective_company_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Status).where(Status.id == status_id))
    st = result.scalar_one_or_none()
    if not st:
        raise HTTPException(status_code=404, detail="Статус не найден")
    if st.company_id != effective_company_id:
        raise HTTPException(status_code=403, detail="Доступ запрещён")
    for key, value in data.model_dump(exclude_none=True).items():
        setattr(st, key, value)
    await db.commit()
    await db.refresh(st)
    return st


@router.delete("/{status_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_status(
    status_id: UUID,
    current_user=Depends(get_company_admin_or_above),
    effective_company_id: UUID = Depends(get_effective_company_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Status).where(Status.id == status_id))
    st = result.scalar_one_or_none()
    if not st:
        raise HTTPException(status_code=404, detail="Статус не найден")
    if st.company_id != effective_company_id:
        raise HTTPException(status_code=403, detail="Доступ запрещён")
    await db.delete(st)
    await db.commit()


# ── Funnels ───────────────────────────────────────────────────────────────────

@router.get("/funnels/", response_model=List[FunnelResponse])
async def list_funnels(
    current_user=Depends(get_any_company_user),
    effective_company_id: UUID = Depends(get_effective_company_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Funnel)
        .where(Funnel.company_id == effective_company_id)
        .order_by(Funnel.name)
    )
    return result.scalars().all()


@router.post("/funnels/", response_model=FunnelResponse, status_code=status.HTTP_201_CREATED)
async def create_funnel(
    data: FunnelCreate,
    current_user=Depends(get_company_admin_or_above),
    effective_company_id: UUID = Depends(get_effective_company_id),
    db: AsyncSession = Depends(get_db),
):
    funnel = Funnel(
        id=uuid.uuid4(),
        company_id=effective_company_id,
        name=data.name,
        entity_type=data.entity_type,
    )
    db.add(funnel)
    await db.commit()
    await db.refresh(funnel)
    return funnel


@router.patch("/funnels/{funnel_id}", response_model=FunnelResponse)
async def update_funnel(
    funnel_id: UUID,
    data: FunnelUpdate,
    current_user=Depends(get_company_admin_or_above),
    effective_company_id: UUID = Depends(get_effective_company_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Funnel).where(Funnel.id == funnel_id))
    funnel = result.scalar_one_or_none()
    if not funnel:
        raise HTTPException(status_code=404, detail="Воронка не найдена")
    if funnel.company_id != effective_company_id:
        raise HTTPException(status_code=403, detail="Доступ запрещён")
    for key, value in data.model_dump(exclude_none=True).items():
        setattr(funnel, key, value)
    await db.commit()
    await db.refresh(funnel)
    return funnel


@router.delete("/funnels/{funnel_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_funnel(
    funnel_id: UUID,
    current_user=Depends(get_company_admin_or_above),
    effective_company_id: UUID = Depends(get_effective_company_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Funnel).where(Funnel.id == funnel_id))
    funnel = result.scalar_one_or_none()
    if not funnel:
        raise HTTPException(status_code=404, detail="Воронка не найдена")
    if funnel.company_id != effective_company_id:
        raise HTTPException(status_code=403, detail="Доступ запрещён")
    await db.delete(funnel)
    await db.commit()


# ── Funnel Stages ─────────────────────────────────────────────────────────────

@router.get("/funnels/{funnel_id}/stages", response_model=List[FunnelStageResponse])
async def list_funnel_stages(
    funnel_id: UUID,
    current_user=Depends(get_any_company_user),
    effective_company_id: UUID = Depends(get_effective_company_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Funnel).where(Funnel.id == funnel_id))
    funnel = result.scalar_one_or_none()
    if not funnel or funnel.company_id != effective_company_id:
        raise HTTPException(status_code=404, detail="Воронка не найдена")

    result = await db.execute(
        select(FunnelStage)
        .where(FunnelStage.funnel_id == funnel_id)
        .order_by(FunnelStage.order_index)
    )
    return result.scalars().all()


@router.post("/funnels/{funnel_id}/stages", response_model=FunnelStageResponse, status_code=status.HTTP_201_CREATED)
async def create_funnel_stage(
    funnel_id: UUID,
    data: FunnelStageCreate,
    current_user=Depends(get_company_admin_or_above),
    effective_company_id: UUID = Depends(get_effective_company_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Funnel).where(Funnel.id == funnel_id))
    funnel = result.scalar_one_or_none()
    if not funnel or funnel.company_id != effective_company_id:
        raise HTTPException(status_code=404, detail="Воронка не найдена")

    stage = FunnelStage(
        id=uuid.uuid4(),
        funnel_id=funnel_id,
        name=data.name,
        order_index=data.order_index,
        status_id=data.status_id,
    )
    db.add(stage)
    await db.commit()
    await db.refresh(stage)
    return stage
