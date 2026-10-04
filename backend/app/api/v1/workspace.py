from collections import defaultdict
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import HR_ROLES, get_any_company_user, get_effective_company_id, get_hr_or_above, visible_employee
from app.api.v1.recruitment import company_record, record_data
from app.database import get_db
from app.models.department import Department
from app.models.employee import Employee, EmployeeStatus
from app.models.knowledge import KnowledgeTopic
from app.models.lesson import AssignmentStatus, Lesson, LessonAssignment
from app.models.position import Position
from app.models.recruitment import Candidate, Interview, Vacancy
from app.models.test import Test, TestAttempt

router = APIRouter()


async def learning_data(db, company_id, employee_ids):
    assignments = (await db.execute(select(LessonAssignment).options(selectinload(LessonAssignment.lesson)).where(LessonAssignment.company_id == company_id, LessonAssignment.employee_id.in_(employee_ids)).order_by(LessonAssignment.created_at, LessonAssignment.id))).scalars().all()
    attempts = (await db.execute(select(TestAttempt, Test, KnowledgeTopic.name).join(Test, (TestAttempt.test_id == Test.id) & (Test.company_id == company_id)).outerjoin(KnowledgeTopic, (Test.topic_id == KnowledgeTopic.id) & (KnowledgeTopic.company_id == company_id)).where(TestAttempt.company_id == company_id, TestAttempt.employee_id.in_(employee_ids), TestAttempt.status == "completed", TestAttempt.score.is_not(None)).order_by(TestAttempt.completed_at.desc(), TestAttempt.started_at.desc(), TestAttempt.id))).all()
    by_employee = defaultdict(list)
    for assignment in assignments:
        if assignment.lesson.company_id == company_id:
            by_employee[assignment.employee_id].append(assignment)
    diagnostics = defaultdict(dict)
    for attempt, test, topic in attempts:
        entry = diagnostics[attempt.employee_id].get(test.id)
        if entry:
            entry["attempts"] += 1
        else:
            diagnostics[attempt.employee_id][test.id] = {"test_id": test.id, "title": test.title, "topic": topic or test.title, "score": attempt.score, "passed": bool(attempt.passed), "passing_score": test.passing_score, "completed_at": attempt.completed_at, "attempts": 1, "auto_assigned_lesson_id": attempt.auto_assigned_lesson_id}
    return by_employee, diagnostics


def progress(employee, assignments, diagnostics):
    completed = sum(a.status == AssignmentStatus.COMPLETED for a in assignments)
    scores = list(diagnostics.values())
    return {"employee_id": employee.id, "full_name": employee.full_name, "status": employee.status, "lessons_completed": completed, "lessons_total": len(assignments), "completion_percent": round(completed / len(assignments) * 100) if assignments else 0, "knowledge_percent": round(sum(s["score"] for s in scores) / len(scores), 1) if scores else None, "weak_areas": sorted(set(s["topic"] for s in scores if not s["passed"]) | set(employee.weak_areas or []))}


@router.get("/employees/{employee_id}")
async def employee_detail(employee_id: UUID, user=Depends(get_any_company_user), company_id: UUID = Depends(get_effective_company_id), db: AsyncSession = Depends(get_db)):
    await company_record(db, Employee, employee_id, company_id)
    employee = await visible_employee(db, user, company_id, employee_id)
    is_hr = user.role in HR_ROLES
    assignments, diagnostic_map = await learning_data(db, company_id, [employee.id])
    employee_assignments = assignments[employee.id]
    diagnostic = diagnostic_map[employee.id]
    department = (await db.execute(select(Department.name).where(Department.company_id == company_id, Department.id == employee.department_id))).scalar_one_or_none()
    position = (await db.execute(select(Position.name).where(Position.company_id == company_id, Position.id == employee.position_id))).scalar_one_or_none()
    candidate = (await db.execute(select(Candidate).where(Candidate.company_id == company_id, Candidate.employee_id == employee.id))).scalar_one_or_none() if is_hr else None
    today = datetime.now(timezone.utc).date().isoformat()
    remediation = {s["auto_assigned_lesson_id"] for s in diagnostic.values() if not s["passed"]}
    roadmap = [{"id": a.id, "lesson_id": a.lesson_id, "title": a.lesson.title, "description": a.lesson.description, "duration_minutes": a.lesson.duration_minutes, "status": a.status, "due_date": a.due_date, "completed_at": a.completed_at, "created_at": a.created_at, "is_remediation": a.lesson_id in remediation, "overdue": bool(a.due_date and a.due_date < today and a.status != AssignmentStatus.COMPLETED)} for a in employee_assignments]
    summary = progress(employee, employee_assignments, diagnostic)
    return {"employee": {**{key: value for key, value in record_data(employee).items() if key != "photo_filename"}, "photo_url": employee.photo_url, "department_name": department, "position_name": position}, **summary, "overdue_count": sum(s["overdue"] for s in roadmap), "roadmap": roadmap, "diagnostics": list(diagnostic.values()), "recruitment_history": candidate.history if candidate else []}


@router.get("/dashboard")
async def dashboard(user=Depends(get_hr_or_above), company_id: UUID = Depends(get_effective_company_id), db: AsyncSession = Depends(get_db)):
    employees = (await db.execute(select(Employee).where(Employee.company_id == company_id, Employee.status != EmployeeStatus.FIRED).order_by(Employee.full_name))).scalars().all()
    departments = dict((await db.execute(select(Department.id, Department.name).where(Department.company_id == company_id))).all())
    positions = dict((await db.execute(select(Position.id, Position.name).where(Position.company_id == company_id))).all())
    assignments, diagnostics = await learning_data(db, company_id, [e.id for e in employees])
    today = datetime.now(timezone.utc).date().isoformat()
    attention = []
    rows = []
    for employee in employees:
        summary = progress(employee, assignments[employee.id], diagnostics[employee.id])
        rows.append({**summary, "department_name": departments.get(employee.department_id), "position_name": positions.get(employee.position_id)})
        overdue = [a for a in assignments[employee.id] if a.due_date and a.due_date < today and a.status != AssignmentStatus.COMPLETED]
        if overdue:
            attention.append({"employee_id": employee.id, "full_name": employee.full_name, "kind": "overdue", "title": "Просрочено обучение", "detail": f"Уроков: {len(overdue)} · срок {min(a.due_date for a in overdue)}"})
        if summary["weak_areas"]:
            attention.append({"employee_id": employee.id, "full_name": employee.full_name, "kind": "knowledge", "title": "Требуется закрепить знания", "detail": ", ".join(summary["weak_areas"])})
    vacancy_count = (await db.execute(select(func.count()).select_from(Vacancy).where(Vacancy.company_id == company_id, Vacancy.status == "open"))).scalar_one()
    candidate_count = (await db.execute(select(func.count()).select_from(Candidate).where(Candidate.company_id == company_id, Candidate.stage.notin_(["hired", "rejected"])))).scalar_one()
    now = datetime.now(timezone.utc)
    meetings = (await db.execute(select(Interview, Candidate.full_name).join(Candidate, (Interview.candidate_id == Candidate.id) & (Candidate.company_id == company_id)).where(Interview.company_id == company_id, Interview.starts_at >= now - timedelta(hours=8), Interview.starts_at < now + timedelta(days=7)).order_by(Interview.starts_at).limit(8))).all()
    return {"stats": {"vacancies": vacancy_count, "candidates": candidate_count, "onboarding": sum(e.status == EmployeeStatus.PROBATION for e in employees), "needs_attention": len({a["employee_id"] for a in attention})}, "attention": attention, "meetings": [{**record_data(meeting), "starts_at": meeting.starts_at.replace(tzinfo=timezone.utc) if meeting.starts_at.tzinfo is None else meeting.starts_at, "candidate_name": name} for meeting, name in meetings], "employees": rows}
