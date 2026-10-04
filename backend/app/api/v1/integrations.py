from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from uuid import UUID
import uuid
from app.database import get_db
from app.schemas.integration import IntegrationCreate, IntegrationUpdate, IntegrationResponse
from app.models.integration import Integration
from app.api.deps import get_company_admin_or_above, get_any_company_user, get_effective_company_id

router = APIRouter()
from app.api.v1.hh_connection import router as hh_router
router.include_router(hh_router)


@router.get("/", response_model=List[IntegrationResponse])
async def list_integrations(
    current_user=Depends(get_company_admin_or_above),
    effective_company_id: UUID = Depends(get_effective_company_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Integration)
        .where(Integration.company_id == effective_company_id)
        .order_by(Integration.provider)
    )
    return result.scalars().all()


@router.post("/", response_model=IntegrationResponse, status_code=status.HTTP_201_CREATED)
async def create_integration(
    data: IntegrationCreate,
    current_user=Depends(get_company_admin_or_above),
    effective_company_id: UUID = Depends(get_effective_company_id),
    db: AsyncSession = Depends(get_db),
):
    integration = Integration(
        id=uuid.uuid4(),
        company_id=effective_company_id,
        provider=data.provider,
        access_token=data.access_token,
        refresh_token=data.refresh_token,
        expires_at=data.expires_at,
        status=data.status,
        settings_data=data.settings_data,
    )
    db.add(integration)
    await db.commit()
    await db.refresh(integration)
    return integration


@router.patch("/{integration_id}", response_model=IntegrationResponse)
async def update_integration(
    integration_id: UUID,
    data: IntegrationUpdate,
    current_user=Depends(get_company_admin_or_above),
    effective_company_id: UUID = Depends(get_effective_company_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Integration).where(Integration.id == integration_id))
    integration = result.scalar_one_or_none()
    if not integration:
        raise HTTPException(status_code=404, detail="Интеграция не найдена")
    if integration.company_id != effective_company_id:
        raise HTTPException(status_code=403, detail="Доступ запрещён")
    for key, value in data.model_dump(exclude_none=True).items():
        setattr(integration, key, value)
    await db.commit()
    await db.refresh(integration)
    return integration


@router.delete("/{integration_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_integration(
    integration_id: UUID,
    current_user=Depends(get_company_admin_or_above),
    effective_company_id: UUID = Depends(get_effective_company_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Integration).where(Integration.id == integration_id))
    integration = result.scalar_one_or_none()
    if not integration:
        raise HTTPException(status_code=404, detail="Интеграция не найдена")
    if integration.company_id != effective_company_id:
        raise HTTPException(status_code=403, detail="Доступ запрещён")
    await db.delete(integration)
    await db.commit()
