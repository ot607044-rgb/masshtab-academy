from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
from uuid import UUID
import uuid
from app.database import get_db
from app.schemas.employee import EmployeeCreate, EmployeeUpdate, EmployeeResponse
from app.models.employee import Employee
from app.api.deps import get_hr_or_above, get_any_company_user, get_effective_company_id

router = APIRouter()


@router.get("/", response_model=List[EmployeeResponse])
async def list_employees(
    department_id: Optional[UUID] = None,
    position_id: Optional[UUID] = None,
    current_user=Depends(get_any_company_user),
    effective_company_id: UUID = Depends(get_effective_company_id),
    db: AsyncSession = Depends(get_db),
):
    q = select(Employee).where(Employee.company_id == effective_company_id)
    if department_id:
        q = q.where(Employee.department_id == department_id)
    if position_id:
        q = q.where(Employee.position_id == position_id)
    result = await db.execute(q.order_by(Employee.full_name))
    return result.scalars().all()


@router.post("/", response_model=EmployeeResponse, status_code=status.HTTP_201_CREATED)
async def create_employee(
    data: EmployeeCreate,
    current_user=Depends(get_hr_or_above),
    effective_company_id: UUID = Depends(get_effective_company_id),
    db: AsyncSession = Depends(get_db),
):
    emp = Employee(
        id=uuid.uuid4(),
        full_name=data.full_name,
        email=data.email,
        phone=data.phone,
        department_id=data.department_id,
        position_id=data.position_id,
        manager_id=data.manager_id,
        user_id=data.user_id,
        status=data.status,
        hire_date=data.hire_date,
        weak_areas=data.weak_areas,
        company_id=effective_company_id,
    )
    db.add(emp)
    await db.commit()
    await db.refresh(emp)
    return emp


@router.get("/{emp_id}", response_model=EmployeeResponse)
async def get_employee(
    emp_id: UUID,
    current_user=Depends(get_any_company_user),
    effective_company_id: UUID = Depends(get_effective_company_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Employee).where(Employee.id == emp_id))
    emp = result.scalar_one_or_none()
    if not emp:
        raise HTTPException(status_code=404, detail="Сотрудник не найден")
    if emp.company_id != effective_company_id:
        raise HTTPException(status_code=403, detail="Доступ запрещён")
    return emp


@router.patch("/{emp_id}", response_model=EmployeeResponse)
async def update_employee(
    emp_id: UUID,
    data: EmployeeUpdate,
    current_user=Depends(get_hr_or_above),
    effective_company_id: UUID = Depends(get_effective_company_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Employee).where(Employee.id == emp_id))
    emp = result.scalar_one_or_none()
    if not emp:
        raise HTTPException(status_code=404, detail="Сотрудник не найден")
    if emp.company_id != effective_company_id:
        raise HTTPException(status_code=403, detail="Доступ запрещён")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(emp, field, value)
    await db.commit()
    await db.refresh(emp)
    return emp


@router.delete("/{emp_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_employee(
    emp_id: UUID,
    current_user=Depends(get_hr_or_above),
    effective_company_id: UUID = Depends(get_effective_company_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Employee).where(Employee.id == emp_id))
    emp = result.scalar_one_or_none()
    if not emp:
        raise HTTPException(status_code=404, detail="Сотрудник не найден")
    if emp.company_id != effective_company_id:
        raise HTTPException(status_code=403, detail="Доступ запрещён")
    await db.delete(emp)
    await db.commit()
