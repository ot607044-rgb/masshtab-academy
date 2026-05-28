from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from uuid import UUID
import uuid
from app.database import get_db
from app.schemas.company import CompanyCreate, CompanyResponse, CompanyWithAdminCreate
from app.models.company import Company
from app.models.user import User, UserRole
from app.api.deps import get_current_user, get_super_admin, check_company_access
from app.core.security import get_password_hash

router = APIRouter()


@router.get("/", response_model=List[CompanyResponse])
async def list_companies(
    current_user: User = Depends(get_super_admin),
    db: AsyncSession = Depends(get_db),
):
    """Super Admin only — list all companies."""
    result = await db.execute(select(Company).order_by(Company.created_at.desc()))
    return result.scalars().all()


@router.post("/", response_model=CompanyResponse, status_code=status.HTTP_201_CREATED)
async def create_company_with_admin(
    data: CompanyWithAdminCreate,
    current_user: User = Depends(get_super_admin),
    db: AsyncSession = Depends(get_db),
):
    """Super Admin only — create a company and its first admin atomically."""
    # Check slug uniqueness
    slug_check = await db.execute(select(Company).where(Company.slug == data.company.slug))
    if slug_check.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Компания с таким slug уже существует")

    # Check admin email uniqueness
    email_check = await db.execute(select(User).where(User.email == data.admin_email))
    if email_check.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email уже зарегистрирован")

    company = Company(
        id=uuid.uuid4(),
        name=data.company.name,
        slug=data.company.slug,
        description=data.company.description,
    )
    db.add(company)
    await db.flush()  # get company.id without committing

    admin = User(
        id=uuid.uuid4(),
        email=data.admin_email,
        hashed_password=get_password_hash(data.admin_password),
        full_name=data.admin_full_name,
        role=UserRole.COMPANY_ADMIN,
        company_id=company.id,
    )
    db.add(admin)
    await db.commit()
    await db.refresh(company)
    return company


@router.get("/{company_id}", response_model=CompanyResponse)
async def get_company(
    company_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    check_company_access(current_user, company_id)

    result = await db.execute(select(Company).where(Company.id == company_id))
    company = result.scalar_one_or_none()
    if not company:
        raise HTTPException(status_code=404, detail="Компания не найдена")
    return company


@router.patch("/{company_id}/deactivate", response_model=CompanyResponse)
async def deactivate_company(
    company_id: UUID,
    current_user: User = Depends(get_super_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Company).where(Company.id == company_id))
    company = result.scalar_one_or_none()
    if not company:
        raise HTTPException(status_code=404, detail="Компания не найдена")
    company.is_active = False
    await db.commit()
    await db.refresh(company)
    return company


@router.delete("/{company_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_company(
    company_id: UUID,
    current_user: User = Depends(get_super_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Company).where(Company.id == company_id))
    company = result.scalar_one_or_none()
    if not company:
        raise HTTPException(status_code=404, detail="Компания не найдена")
    await db.delete(company)
    await db.commit()
