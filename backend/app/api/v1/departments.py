from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from uuid import UUID
import uuid
from app.database import get_db
from app.schemas.department import DepartmentCreate, DepartmentUpdate, DepartmentResponse
from app.models.department import Department
from app.models.employee import Employee
from app.models.user import UserRole
from app.api.deps import get_hr_or_above, get_any_company_user

router = APIRouter()


async def validate_head(db, head_id, company_id):
    if head_id is not None:
        head = await db.scalar(select(Employee.id).where(Employee.id == head_id, Employee.company_id == company_id))
        if head is None:
            raise HTTPException(status_code=404, detail="Руководитель не найден")


def _company_filter(current_user, query):
    if current_user.role != UserRole.SUPER_ADMIN:
        query = query.where(Department.company_id == current_user.company_id)
    return query


@router.get("/", response_model=List[DepartmentResponse])
async def list_departments(
    current_user=Depends(get_any_company_user),
    db: AsyncSession = Depends(get_db),
):
    q = _company_filter(current_user, select(Department).order_by(Department.name))
    result = await db.execute(q)
    return result.scalars().all()


@router.post("/", response_model=DepartmentResponse, status_code=status.HTTP_201_CREATED)
async def create_department(
    data: DepartmentCreate,
    current_user=Depends(get_hr_or_above),
    db: AsyncSession = Depends(get_db),
):
    await validate_head(db, data.head_id, current_user.company_id)
    dept = Department(
        id=uuid.uuid4(),
        name=data.name,
        description=data.description,
        head_id=data.head_id,
        company_id=current_user.company_id,
    )
    db.add(dept)
    await db.commit()
    await db.refresh(dept)
    return dept


@router.get("/{dept_id}", response_model=DepartmentResponse)
async def get_department(
    dept_id: UUID,
    current_user=Depends(get_any_company_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Department).where(Department.id == dept_id))
    dept = result.scalar_one_or_none()
    if not dept:
        raise HTTPException(status_code=404, detail="Отдел не найден")
    if current_user.role != UserRole.SUPER_ADMIN and dept.company_id != current_user.company_id:
        raise HTTPException(status_code=403, detail="Доступ запрещён")
    return dept


@router.patch("/{dept_id}", response_model=DepartmentResponse)
async def update_department(
    dept_id: UUID,
    data: DepartmentUpdate,
    current_user=Depends(get_hr_or_above),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Department).where(Department.id == dept_id))
    dept = result.scalar_one_or_none()
    if not dept:
        raise HTTPException(status_code=404, detail="Отдел не найден")
    if current_user.role != UserRole.SUPER_ADMIN and dept.company_id != current_user.company_id:
        raise HTTPException(status_code=403, detail="Доступ запрещён")
    changes = data.model_dump(exclude_unset=True)
    if "head_id" in changes:
        await validate_head(db, data.head_id, dept.company_id)
    for field, value in changes.items():
        setattr(dept, field, value)
    await db.commit()
    await db.refresh(dept)
    return dept


@router.delete("/{dept_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_department(
    dept_id: UUID,
    current_user=Depends(get_hr_or_above),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Department).where(Department.id == dept_id))
    dept = result.scalar_one_or_none()
    if not dept:
        raise HTTPException(status_code=404, detail="Отдел не найден")
    if current_user.role != UserRole.SUPER_ADMIN and dept.company_id != current_user.company_id:
        raise HTTPException(status_code=403, detail="Доступ запрещён")
    await db.delete(dept)
    await db.commit()
