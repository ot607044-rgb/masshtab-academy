import uuid
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_any_company_user, get_effective_company_id, get_hr_or_above
from app.database import get_db
from app.models.base import utc_now
from app.models.employee import Employee
from app.models.notification import Notification
from app.models.position import Position
from app.models.regulation import PositionRegulation, RegulationAssignment
from app.schemas.regulation import (
    AssignmentCreate, AssignmentResponse, MyRegulationResponse,
    RegulationCreate, RegulationResponse, RegulationUpdate,
)

router = APIRouter()


async def company_regulation(db: AsyncSession, regulation_id: UUID, company_id: UUID) -> PositionRegulation:
    regulation = await db.scalar(select(PositionRegulation).where(
        PositionRegulation.id == regulation_id, PositionRegulation.company_id == company_id))
    if regulation is None:
        raise HTTPException(status_code=404, detail="Регламент не найден")
    return regulation


def touch(regulation: PositionRegulation, user) -> None:
    regulation.updated_by_id = user.id
    regulation.updated_by_name = user.full_name
    regulation.updated_at = utc_now()


# ── Библиотека регламентов ───────────────────────────────────────────────────

@router.get("/", response_model=List[RegulationResponse])
async def list_regulations(
    position_id: UUID | None = None,
    current_user=Depends(get_hr_or_above),
    company_id: UUID = Depends(get_effective_company_id),
    db: AsyncSession = Depends(get_db),
):
    q = select(PositionRegulation).where(PositionRegulation.company_id == company_id)
    if position_id:
        q = q.where(PositionRegulation.position_id == position_id)
    return (await db.execute(q.order_by(PositionRegulation.created_at))).scalars().all()


@router.post("/", response_model=RegulationResponse, status_code=status.HTTP_201_CREATED)
async def create_regulation(
    data: RegulationCreate,
    current_user=Depends(get_hr_or_above),
    company_id: UUID = Depends(get_effective_company_id),
    db: AsyncSession = Depends(get_db),
):
    position = await db.scalar(select(Position.id).where(Position.id == data.position_id, Position.company_id == company_id))
    if position is None:
        raise HTTPException(status_code=404, detail="Должность не найдена")
    regulation = PositionRegulation(id=uuid.uuid4(), company_id=company_id, **data.model_dump())
    touch(regulation, current_user)
    db.add(regulation)
    await db.commit()
    await db.refresh(regulation)
    return regulation


@router.patch("/{regulation_id}", response_model=RegulationResponse)
async def update_regulation(
    regulation_id: UUID,
    data: RegulationUpdate,
    current_user=Depends(get_hr_or_above),
    company_id: UUID = Depends(get_effective_company_id),
    db: AsyncSession = Depends(get_db),
):
    regulation = await company_regulation(db, regulation_id, company_id)
    changes = data.model_dump(exclude_unset=True)
    for field in ("name", "status", "duties"):
        if field in changes and changes[field] is None:
            raise HTTPException(status_code=422, detail="Поле не может быть пустым")
    for field, value in changes.items():
        setattr(regulation, field, value)
    touch(regulation, current_user)
    await db.commit()
    await db.refresh(regulation)
    return regulation


@router.delete("/{regulation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_regulation(
    regulation_id: UUID,
    current_user=Depends(get_hr_or_above),
    company_id: UUID = Depends(get_effective_company_id),
    db: AsyncSession = Depends(get_db),
):
    regulation = await company_regulation(db, regulation_id, company_id)
    for assignment in (await db.execute(select(RegulationAssignment).where(RegulationAssignment.regulation_id == regulation.id))).scalars():
        await db.delete(assignment)
    await db.delete(regulation)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ── Назначения сотрудникам ───────────────────────────────────────────────────

@router.get("/assignments", response_model=List[AssignmentResponse])
async def list_assignments(
    current_user=Depends(get_hr_or_above),
    company_id: UUID = Depends(get_effective_company_id),
    db: AsyncSession = Depends(get_db),
):
    q = select(RegulationAssignment).where(RegulationAssignment.company_id == company_id).order_by(RegulationAssignment.assigned_at.desc())
    return (await db.execute(q)).scalars().all()


@router.post("/assignments", response_model=AssignmentResponse)
async def assign_regulation(
    data: AssignmentCreate,
    current_user=Depends(get_hr_or_above),
    company_id: UUID = Depends(get_effective_company_id),
    db: AsyncSession = Depends(get_db),
):
    employee = await db.scalar(select(Employee).where(Employee.id == data.employee_id, Employee.company_id == company_id))
    if employee is None:
        raise HTTPException(status_code=404, detail="Сотрудник не найден")
    regulation = await company_regulation(db, data.regulation_id, company_id)
    if employee.position_id and employee.position_id != regulation.position_id:
        raise HTTPException(status_code=400, detail="Регламент относится к другой должности")

    # Один действующий регламент на сотрудника: повторное назначение заменяет прежний
    assignment = await db.scalar(select(RegulationAssignment).where(RegulationAssignment.employee_id == employee.id))
    if assignment is None:
        assignment = RegulationAssignment(id=uuid.uuid4(), company_id=company_id, employee_id=employee.id)
        db.add(assignment)
    assignment.regulation_id = regulation.id
    assignment.require_ack = data.require_ack
    assignment.acknowledged_at = None
    assignment.assigned_at = utc_now()
    assignment.assigned_by_id = current_user.id

    notified = bool(data.require_ack and employee.user_id)
    if notified:
        db.add(Notification(
            id=uuid.uuid4(), user_id=employee.user_id, company_id=company_id, type="regulation_assigned",
            title="Новый регламент должности",
            message=f"Вам назначен регламент «{regulation.name}». Ознакомьтесь и подтвердите в разделе «Мой регламент».",
            entity_id=assignment.id,
        ))
    await db.commit()
    await db.refresh(assignment)
    response = AssignmentResponse.model_validate(assignment)
    response.notified = notified
    return response


@router.delete("/assignments/{assignment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_assignment(
    assignment_id: UUID,
    current_user=Depends(get_hr_or_above),
    company_id: UUID = Depends(get_effective_company_id),
    db: AsyncSession = Depends(get_db),
):
    assignment = await db.scalar(select(RegulationAssignment).where(
        RegulationAssignment.id == assignment_id, RegulationAssignment.company_id == company_id))
    if assignment is None:
        raise HTTPException(status_code=404, detail="Назначение не найдено")
    await db.delete(assignment)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ── Сотрудник: мой регламент ─────────────────────────────────────────────────

async def my_assignment(db: AsyncSession, user) -> RegulationAssignment | None:
    employee_ids = select(Employee.id).where(Employee.user_id == user.id, Employee.company_id == user.company_id)
    return await db.scalar(select(RegulationAssignment).where(RegulationAssignment.employee_id.in_(employee_ids)).order_by(RegulationAssignment.assigned_at.desc()).limit(1))


@router.get("/my", response_model=MyRegulationResponse | None)
async def my_regulation(current_user=Depends(get_any_company_user), db: AsyncSession = Depends(get_db)):
    assignment = await my_assignment(db, current_user)
    if assignment is None:
        return None
    regulation = await db.get(PositionRegulation, assignment.regulation_id)
    position = await db.get(Position, regulation.position_id)
    return MyRegulationResponse(
        assignment=AssignmentResponse.model_validate(assignment),
        regulation=RegulationResponse.model_validate(regulation),
        position_name=position.name if position else None,
    )


@router.post("/my/acknowledge", response_model=AssignmentResponse)
async def acknowledge_regulation(current_user=Depends(get_any_company_user), db: AsyncSession = Depends(get_db)):
    assignment = await my_assignment(db, current_user)
    if assignment is None:
        raise HTTPException(status_code=404, detail="Регламент не назначен")
    if assignment.acknowledged_at is None:
        assignment.acknowledged_at = utc_now()
        await db.commit()
        await db.refresh(assignment)
    return assignment
