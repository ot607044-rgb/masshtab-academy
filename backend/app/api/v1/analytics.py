from typing import List, Optional
from uuid import UUID
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel

from app.database import get_db
from app.api.deps import get_hr_or_above, get_any_company_user, get_effective_company_id, own_employee, visible_employees
from app.models.employee import Employee, EmployeeStatus
from app.models.lesson import LessonAssignment, AssignmentStatus
from app.models.test import TestAttempt
from app.models.department import Department
from app.models.user import UserRole

router = APIRouter()


# ── Pydantic response schemas ─────────────────────────────────────────────────

class OverviewStats(BaseModel):
    total_employees: int
    active_employees: int
    lessons_completed: int
    lessons_assigned: int
    lessons_overdue: int
    tests_passed: int
    tests_failed: int
    avg_test_score: Optional[float]
    completion_rate: float


class DeptStat(BaseModel):
    department_id: str
    department_name: str
    employee_count: int
    lessons_completed: int
    lessons_assigned: int
    avg_score: Optional[float]
    completion_rate: float


class WeakTopicStat(BaseModel):
    topic: str
    count: int


class EmployeeProgress(BaseModel):
    employee_id: str
    full_name: str
    department_id: Optional[str]
    department_name: Optional[str]
    lessons_completed: int
    lessons_total: int
    tests_passed: int
    tests_total: int
    best_score: Optional[float]
    weak_areas: List[str]


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _employee_progress(
    emp: Employee,
    dept_map: dict[str, str],
    db: AsyncSession,
) -> EmployeeProgress:
    assign_rows = await db.execute(
        select(LessonAssignment.status).where(LessonAssignment.employee_id == emp.id)
    )
    assignments = assign_rows.scalars().all()
    lessons_total = len(assignments)
    lessons_completed = sum(1 for s in assignments if s == AssignmentStatus.COMPLETED)

    test_rows = await db.execute(
        select(TestAttempt.passed, TestAttempt.score).where(
            TestAttempt.employee_id == emp.id,
            TestAttempt.status == "completed",
        )
    )
    attempts = test_rows.all()
    tests_total = len(attempts)
    tests_passed = sum(1 for a in attempts if a.passed)
    scores = [a.score for a in attempts if a.score is not None]
    best_score = round(max(scores), 1) if scores else None

    return EmployeeProgress(
        employee_id=str(emp.id),
        full_name=emp.full_name,
        department_id=str(emp.department_id) if emp.department_id else None,
        department_name=dept_map.get(str(emp.department_id)) if emp.department_id else None,
        lessons_completed=lessons_completed,
        lessons_total=lessons_total,
        tests_passed=tests_passed,
        tests_total=tests_total,
        best_score=best_score,
        weak_areas=emp.weak_areas or [],
    )


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/overview", response_model=OverviewStats)
async def get_overview(
    current_user=Depends(get_hr_or_above),
    effective_company_id: UUID = Depends(get_effective_company_id),
    db: AsyncSession = Depends(get_db),
):
    """Сводная статистика компании (HR / Admin)."""
    today = datetime.now(timezone.utc).date().isoformat()

    # Employee counts
    emp_rows = await db.execute(
        select(Employee.status).where(Employee.company_id == effective_company_id)
    )
    statuses = emp_rows.scalars().all()
    total_employees = len(statuses)
    active_employees = sum(1 for s in statuses if s == EmployeeStatus.ACTIVE)

    # Assignments
    assign_rows = await db.execute(
        select(LessonAssignment.status, LessonAssignment.due_date)
        .join(Employee, LessonAssignment.employee_id == Employee.id)
        .where(Employee.company_id == effective_company_id)
    )
    assignments = assign_rows.all()
    lessons_assigned = len(assignments)
    lessons_completed = sum(1 for a in assignments if a.status == AssignmentStatus.COMPLETED)
    lessons_overdue = sum(
        1 for a in assignments
        if a.status != AssignmentStatus.COMPLETED
        and a.due_date is not None
        and a.due_date < today
    )

    # Tests
    test_rows = await db.execute(
        select(TestAttempt.passed, TestAttempt.score)
        .join(Employee, TestAttempt.employee_id == Employee.id)
        .where(
            Employee.company_id == effective_company_id,
            TestAttempt.status == "completed",
        )
    )
    attempts = test_rows.all()
    tests_passed = sum(1 for a in attempts if a.passed)
    tests_failed = sum(1 for a in attempts if a.passed is False)
    scores = [a.score for a in attempts if a.score is not None]
    avg_test_score = round(sum(scores) / len(scores), 1) if scores else None
    completion_rate = round(lessons_completed / lessons_assigned * 100, 1) if lessons_assigned else 0.0

    return OverviewStats(
        total_employees=total_employees,
        active_employees=active_employees,
        lessons_completed=lessons_completed,
        lessons_assigned=lessons_assigned,
        lessons_overdue=lessons_overdue,
        tests_passed=tests_passed,
        tests_failed=tests_failed,
        avg_test_score=avg_test_score,
        completion_rate=completion_rate,
    )


@router.get("/by-department", response_model=List[DeptStat])
async def get_by_department(
    current_user=Depends(get_hr_or_above),
    effective_company_id: UUID = Depends(get_effective_company_id),
    db: AsyncSession = Depends(get_db),
):
    """Статистика по отделам (HR / Admin)."""
    dept_rows = await db.execute(
        select(Department).where(Department.company_id == effective_company_id)
    )
    departments = dept_rows.scalars().all()

    result = []
    for dept in departments:
        emp_rows = await db.execute(
            select(Employee.id).where(
                Employee.company_id == effective_company_id,
                Employee.department_id == dept.id,
            )
        )
        emp_ids = [r[0] for r in emp_rows.all()]

        if not emp_ids:
            result.append(DeptStat(
                department_id=str(dept.id),
                department_name=dept.name,
                employee_count=0,
                lessons_completed=0,
                lessons_assigned=0,
                avg_score=None,
                completion_rate=0.0,
            ))
            continue

        assign_rows = await db.execute(
            select(LessonAssignment.status).where(
                LessonAssignment.employee_id.in_(emp_ids)
            )
        )
        assignments = assign_rows.scalars().all()
        lessons_assigned = len(assignments)
        lessons_completed = sum(1 for s in assignments if s == AssignmentStatus.COMPLETED)

        score_rows = await db.execute(
            select(TestAttempt.score).where(
                TestAttempt.employee_id.in_(emp_ids),
                TestAttempt.status == "completed",
                TestAttempt.score.isnot(None),
            )
        )
        scores = [r[0] for r in score_rows.all()]
        avg_score = round(sum(scores) / len(scores), 1) if scores else None
        completion_rate = round(lessons_completed / lessons_assigned * 100, 1) if lessons_assigned else 0.0

        result.append(DeptStat(
            department_id=str(dept.id),
            department_name=dept.name,
            employee_count=len(emp_ids),
            lessons_completed=lessons_completed,
            lessons_assigned=lessons_assigned,
            avg_score=avg_score,
            completion_rate=completion_rate,
        ))

    return result


@router.get("/weak-topics", response_model=List[WeakTopicStat])
async def get_weak_topics(
    current_user=Depends(get_hr_or_above),
    effective_company_id: UUID = Depends(get_effective_company_id),
    db: AsyncSession = Depends(get_db),
):
    """Топ слабых тем по всей компании (HR / Admin)."""
    rows = await db.execute(
        select(Employee.weak_areas).where(
            Employee.company_id == effective_company_id,
            Employee.weak_areas.isnot(None),
        )
    )
    topic_counts: dict[str, int] = {}
    for weak_list in rows.scalars().all():
        if isinstance(weak_list, list):
            for topic in weak_list:
                if isinstance(topic, str):
                    topic_counts[topic] = topic_counts.get(topic, 0) + 1

    sorted_topics = sorted(topic_counts.items(), key=lambda x: x[1], reverse=True)[:20]
    return [WeakTopicStat(topic=t, count=c) for t, c in sorted_topics]


@router.get("/employees", response_model=List[EmployeeProgress])
async def get_employee_progress(
    department_id: Optional[str] = None,
    current_user=Depends(get_hr_or_above),
    effective_company_id: UUID = Depends(get_effective_company_id),
    db: AsyncSession = Depends(get_db),
):
    """Прогресс каждого сотрудника (HR / Admin)."""
    q = select(Employee).where(Employee.company_id == effective_company_id)
    if department_id:
        q = q.where(Employee.department_id == UUID(department_id))

    emp_rows = await db.execute(q)
    employees = emp_rows.scalars().all()

    dept_rows = await db.execute(
        select(Department).where(Department.company_id == effective_company_id)
    )
    dept_map = {str(d.id): d.name for d in dept_rows.scalars().all()}

    return [await _employee_progress(emp, dept_map, db) for emp in employees]


@router.get("/my-department", response_model=List[EmployeeProgress])
async def get_my_department(
    current_user=Depends(get_any_company_user),
    effective_company_id: UUID = Depends(get_effective_company_id),
    db: AsyncSession = Depends(get_db),
):
    """Прогресс подчинённых (для руководителя отдела)."""
    allowed = (
        UserRole.SUPER_ADMIN,
        UserRole.COMPANY_ADMIN,
        UserRole.HR,
        UserRole.DEPARTMENT_HEAD,
    )
    if current_user.role not in allowed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Требуются права руководителя или HR",
        )

    manager_emp = await own_employee(db, current_user, effective_company_id)
    if not manager_emp:
        return []
    if current_user.role == UserRole.DEPARTMENT_HEAD:
        scope = await visible_employees(db, current_user, effective_company_id)
    elif manager_emp.department_id:
        scope = (Employee.company_id == effective_company_id) & (Employee.department_id == manager_emp.department_id)
    else:
        return []
    team_rows = await db.execute(select(Employee).where(scope).order_by(Employee.full_name))
    employees = team_rows.scalars().all()

    dept_rows = await db.execute(
        select(Department).where(Department.company_id == effective_company_id)
    )
    dept_map = {str(d.id): d.name for d in dept_rows.scalars().all()}

    return [await _employee_progress(emp, dept_map, db) for emp in employees]
