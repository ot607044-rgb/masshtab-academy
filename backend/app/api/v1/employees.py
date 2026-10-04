from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from fastapi.responses import FileResponse
from starlette.concurrency import run_in_threadpool
import logging
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
from uuid import UUID
import uuid
from app.database import get_db
from app.schemas.employee import EmployeeCreate, EmployeeUpdate, EmployeeResponse
from app.models.employee import Employee, EmployeeStatus
from app.models.department import Department
from app.models.position import Position
from app.api.deps import get_hr_or_above, get_any_company_user, get_effective_company_id, visible_employee, visible_employees
from app.core.accounts import disable_account
from app.core.employee_photos import MAX_PHOTO_BYTES, normalize_photo, photo_path

router = APIRouter()
logger = logging.getLogger(__name__)


async def photo_employee(db, emp_id, company_id, lock=False):
    query = select(Employee).where(Employee.id == emp_id)
    if lock:
        query = query.with_for_update()
    employee = await db.scalar(query)
    if employee is None:
        raise HTTPException(404, "Сотрудник не найден")
    if employee.company_id != company_id:
        raise HTTPException(403, "Доступ запрещён")
    return employee


def remove_photo_file(path):
    try:
        path.unlink(missing_ok=True)
    except OSError:
        logger.warning("Could not remove obsolete employee photo")


@router.post("/{emp_id}/photo", response_model=EmployeeResponse)
async def upload_employee_photo(emp_id: UUID, file: UploadFile = File(...), current_user=Depends(get_hr_or_above), company_id: UUID = Depends(get_effective_company_id), db: AsyncSession = Depends(get_db)):
    employee = await photo_employee(db, emp_id, company_id, lock=True)
    contents = await file.read(MAX_PHOTO_BYTES + 1)
    if len(contents) > MAX_PHOTO_BYTES:
        raise HTTPException(413, "Фото не должно превышать 5 МБ")
    normalized = await run_in_threadpool(normalize_photo, contents)
    old_path = photo_path(employee, employee.photo_filename) if employee.photo_filename else None
    filename = f"{uuid.uuid4().hex}.jpg"
    path = photo_path(employee, filename)
    await run_in_threadpool(path.parent.mkdir, parents=True, exist_ok=True)
    await run_in_threadpool(path.write_bytes, normalized)
    employee.photo_filename = filename
    try:
        await db.commit()
    except Exception:
        await db.rollback()
        await run_in_threadpool(remove_photo_file, path)
        raise
    if old_path:
        await run_in_threadpool(remove_photo_file, old_path)
    return employee


@router.get("/{emp_id}/photo")
async def get_employee_photo(emp_id: UUID, current_user=Depends(get_any_company_user), company_id: UUID = Depends(get_effective_company_id), db: AsyncSession = Depends(get_db)):
    employee = await visible_employee(db, current_user, company_id, emp_id)
    path = photo_path(employee, employee.photo_filename) if employee.photo_filename else None
    if path is None or not path.is_file():
        raise HTTPException(404, "Фото не добавлено")
    return FileResponse(path, media_type="image/jpeg", headers={"Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff"})


@router.delete("/{emp_id}/photo", response_model=EmployeeResponse)
async def delete_employee_photo(emp_id: UUID, current_user=Depends(get_hr_or_above), company_id: UUID = Depends(get_effective_company_id), db: AsyncSession = Depends(get_db)):
    employee = await photo_employee(db, emp_id, company_id, lock=True)
    old_path = photo_path(employee, employee.photo_filename) if employee.photo_filename else None
    employee.photo_filename = None
    await db.commit()
    if old_path:
        await run_in_threadpool(remove_photo_file, old_path)
    return employee


async def validate_references(db, changes, company_id, employee_id=None):
    references = [("department_id", Department, "Отдел"), ("position_id", Position, "Должность"), ("manager_id", Employee, "Руководитель")]
    for field, model, label in references:
        value = changes.get(field)
        if value is None:
            continue
        if field == "manager_id" and value == employee_id:
            raise HTTPException(400, "Сотрудник не может быть своим руководителем")
        record = await db.scalar(select(model.id).where(model.id == value, model.company_id == company_id))
        if record is None:
            raise HTTPException(404, f"{label}: запись не найдена")


@router.get("/", response_model=List[EmployeeResponse])
async def list_employees(
    department_id: Optional[UUID] = None,
    position_id: Optional[UUID] = None,
    current_user=Depends(get_any_company_user),
    effective_company_id: UUID = Depends(get_effective_company_id),
    db: AsyncSession = Depends(get_db),
):
    q = select(Employee).where(await visible_employees(db, current_user, effective_company_id))
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
    await validate_references(db, data.model_dump(), effective_company_id)
    emp = Employee(
        id=uuid.uuid4(),
        full_name=data.full_name,
        email=data.email,
        phone=data.phone,
        department_id=data.department_id,
        position_id=data.position_id,
        manager_id=data.manager_id,
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
    return await visible_employee(db, current_user, effective_company_id, emp_id)


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
    # Accounts are linked only through «Предоставить доступ»
    changes = data.model_dump(exclude_unset=True, exclude={"user_id"})
    await validate_references(db, changes, effective_company_id, emp.id)
    for field, value in changes.items():
        setattr(emp, field, value)
    if emp.status == EmployeeStatus.FIRED:
        # Dismissal blocks sign-in; the card and learning history stay.
        await disable_account(db, emp.user_id)
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
    await disable_account(db, emp.user_id)
    await db.delete(emp)
    await db.commit()
