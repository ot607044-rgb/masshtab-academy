import uuid
from datetime import datetime, timezone
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.schemas.lesson import AssignmentCreate, AssignmentStatusUpdate, AssignmentResponse
from app.models.lesson import LessonAssignment, AssignmentStatus, Lesson, LessonStatus
from app.models.employee import Employee
from app.models.user import UserRole
from app.api.deps import HR_ROLES, get_hr_or_above, get_any_company_user, get_effective_company_id, own_employee

router = APIRouter()


def _load_assignment_q(extra_where=None):
    q = (
        select(LessonAssignment)
        .options(selectinload(LessonAssignment.lesson))
    )
    if extra_where is not None:
        q = q.where(extra_where)
    return q


# ── HR / Admin: list all assignments ─────────────────────────────────────────

@router.get("/", response_model=List[AssignmentResponse])
async def list_assignments(
    employee_id: str = None,
    current_user=Depends(get_hr_or_above),
    effective_company_id: UUID = Depends(get_effective_company_id),
    db: AsyncSession = Depends(get_db),
):
    q = _load_assignment_q().where(LessonAssignment.company_id == effective_company_id)
    if employee_id:
        q = q.where(LessonAssignment.employee_id == employee_id)
    result = await db.execute(q.order_by(LessonAssignment.created_at.desc()))
    return result.scalars().all()


# ── Employee: my assignments ──────────────────────────────────────────────────

@router.get("/my", response_model=List[AssignmentResponse])
async def my_assignments(
    current_user=Depends(get_any_company_user),
    db: AsyncSession = Depends(get_db),
):
    emp_result = await db.execute(
        select(Employee).where(
            Employee.user_id == current_user.id,
            Employee.company_id == current_user.company_id,
        )
    )
    employees = emp_result.scalars().all()
    if not employees:
        return []

    emp_ids = [e.id for e in employees]
    q = (
        _load_assignment_q()
        .where(LessonAssignment.employee_id.in_(emp_ids))
        .order_by(LessonAssignment.created_at.desc())
    )
    result = await db.execute(q)
    return result.scalars().all()


# ── HR / Admin: create assignment ─────────────────────────────────────────────

@router.post("/", response_model=AssignmentResponse, status_code=status.HTTP_201_CREATED)
async def create_assignment(
    data: AssignmentCreate,
    current_user=Depends(get_hr_or_above),
    effective_company_id: UUID = Depends(get_effective_company_id),
    db: AsyncSession = Depends(get_db),
):
    lesson_r = await db.execute(select(Lesson).where(Lesson.id == data.lesson_id))
    lesson = lesson_r.scalar_one_or_none()
    if not lesson:
        raise HTTPException(status_code=404, detail="Урок не найден")
    if lesson.company_id != effective_company_id:
        raise HTTPException(status_code=403, detail="Доступ запрещён")
    if lesson.status != LessonStatus.PUBLISHED:
        raise HTTPException(status_code=400, detail="Можно назначать только опубликованные уроки")

    emp_r = await db.execute(select(Employee).where(Employee.id == data.employee_id))
    emp = emp_r.scalar_one_or_none()
    if not emp:
        raise HTTPException(status_code=404, detail="Сотрудник не найден")
    if emp.company_id != effective_company_id:
        raise HTTPException(status_code=403, detail="Доступ запрещён")

    dup = await db.execute(
        select(LessonAssignment).where(
            LessonAssignment.lesson_id == data.lesson_id,
            LessonAssignment.employee_id == data.employee_id,
        )
    )
    if dup.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Урок уже назначен этому сотруднику")

    assignment = LessonAssignment(
        id=uuid.uuid4(),
        lesson_id=data.lesson_id,
        employee_id=data.employee_id,
        company_id=effective_company_id,
        assigned_by=current_user.id,
        due_date=data.due_date,
    )
    db.add(assignment)
    await db.commit()

    loaded = await db.execute(
        _load_assignment_q(LessonAssignment.id == assignment.id)
    )
    return loaded.scalar_one()


# ── Update assignment status (employee or HR) ─────────────────────────────────

@router.patch("/{assignment_id}/status", response_model=AssignmentResponse)
async def update_assignment_status(
    assignment_id: uuid.UUID,
    data: AssignmentStatusUpdate,
    current_user=Depends(get_any_company_user),
    effective_company_id: UUID = Depends(get_effective_company_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(LessonAssignment).where(LessonAssignment.id == assignment_id))
    assignment = result.scalar_one_or_none()
    if not assignment:
        raise HTTPException(status_code=404, detail="Назначение не найдено")

    if assignment.company_id != effective_company_id:
        raise HTTPException(status_code=403, detail="Доступ запрещён")
    # HR manages any assignment; everyone else only marks progress on their own
    if current_user.role not in HR_ROLES:
        me = await own_employee(db, current_user, effective_company_id)
        if me is None or me.id != assignment.employee_id:
            raise HTTPException(status_code=403, detail="Доступ запрещён")

    assignment.status = data.status
    if data.status == AssignmentStatus.COMPLETED:
        assignment.completed_at = data.completed_at or datetime.now(timezone.utc).isoformat(timespec="seconds")
    await db.commit()

    loaded = await db.execute(_load_assignment_q(LessonAssignment.id == assignment_id))
    return loaded.scalar_one()


# ── Delete assignment ─────────────────────────────────────────────────────────

@router.delete("/{assignment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_assignment(
    assignment_id: uuid.UUID,
    current_user=Depends(get_hr_or_above),
    effective_company_id: UUID = Depends(get_effective_company_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(LessonAssignment).where(LessonAssignment.id == assignment_id))
    assignment = result.scalar_one_or_none()
    if not assignment:
        raise HTTPException(status_code=404, detail="Назначение не найдено")
    if assignment.company_id != effective_company_id:
        raise HTTPException(status_code=403, detail="Доступ запрещён")
    await db.delete(assignment)
    await db.commit()
