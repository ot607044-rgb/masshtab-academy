"""Disposable UI fixtures. Refuses to run against any non-preview database."""
import asyncio
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select
from app.config import settings
from app.database import AsyncSessionLocal, engine
from app.core.security import get_password_hash
from app.models.base import utc_now
from app.models import Company, User, Department, Position, Employee, KnowledgeTopic, PositionTopic, Lesson, LessonAssignment, Test, TestAttempt
from app.models.employee import EmployeeStatus
from app.models.lesson import LessonStatus, AssignmentStatus
from app.models.recruitment import Vacancy, Candidate, Interview


async def main():
    if not settings.DATABASE_URL.endswith("/academy_ui_preview"):
        raise RuntimeError("Fixtures are allowed only in academy_ui_preview")
    async with AsyncSessionLocal() as db:
        if (await db.execute(select(Company).where(Company.slug == "ui-preview"))).scalar_one_or_none():
            print("Preview fixtures already exist")
            return
        company = Company(name="Тестовая компания", slug="ui-preview", description="Изолированная проверка интерфейса")
        db.add(company); await db.flush()
        user = User(company_id=company.id, full_name="Ольга · тестовый HR", email="hr@preview.example.org", hashed_password=get_password_hash(settings.FIRST_SUPERADMIN_PASSWORD), role="hr", activated_at=utc_now())
        department = Department(company_id=company.id, name="Финансы и клиентский сервис")
        db.add_all([user, department]); await db.flush()
        position = Position(company_id=company.id, department_id=department.id, name="Бухгалтер")
        db.add(position); await db.flush()
        now = datetime.now(timezone.utc).replace(microsecond=0)
        employees = []
        for name in ("Анна Смирнова", "Алексей Козлов", "Елена Морозова"):
            employee = Employee(company_id=company.id, department_id=department.id, position_id=position.id, full_name=name, hire_date=(now-timedelta(days=14)).date(), status=EmployeeStatus.PROBATION, weak_areas=[])
            db.add(employee); employees.append(employee)
        topic = KnowledgeTopic(company_id=company.id, name="Налоговые платежи")
        db.add(topic); await db.flush()
        db.add(PositionTopic(company_id=company.id, position_id=position.id, topic_id=topic.id))
        lessons = []
        for i, title in enumerate(("Знакомство с компанией", "Рабочие процессы и регламенты", "Налоговые платежи", "Практика учета")):
            lesson = Lesson(company_id=company.id, position_id=position.id, topic_id=topic.id if i == 2 else None, title=title, description="Материал тестовой учебной программы", text_content="Этот материал используется только в изолированной предварительной версии.", status=LessonStatus.PUBLISHED, duration_minutes=20 + i*5)
            db.add(lesson); lessons.append(lesson)
        await db.flush()
        for employee_index, employee in enumerate(employees):
            for i, lesson in enumerate(lessons):
                completed = i < 2 + employee_index % 2
                db.add(LessonAssignment(company_id=company.id, employee_id=employee.id, lesson_id=lesson.id, assigned_by=user.id, status=AssignmentStatus.COMPLETED if completed else AssignmentStatus.IN_PROGRESS if i == 2 else AssignmentStatus.ASSIGNED, due_date=(now+timedelta(days=i-3)).date().isoformat(), completed_at=(now-timedelta(days=4-i)).isoformat() if completed else None))
        test = Test(company_id=company.id, position_id=position.id, topic_id=topic.id, lesson_id=lessons[2].id, title="Налоговые платежи", status="published", passing_score=70)
        db.add(test); await db.flush()
        for employee, score in zip(employees, (58, 82, 91)):
            db.add(TestAttempt(company_id=company.id, employee_id=employee.id, test_id=test.id, status="completed", score=score, passed=score >= 70, started_at=now-timedelta(days=1), completed_at=now-timedelta(days=1), auto_assigned_lesson_id=lessons[2].id if score < 70 else None))
        vacancies = []
        for title, status in (("Бухгалтер по банку", "open"), ("Клиентский менеджер", "open"), ("Технический специалист", "request")):
            vacancy = Vacancy(company_id=company.id, department_id=department.id, position_id=position.id, title=title, status=status, created_by=user.id)
            db.add(vacancy); vacancies.append(vacancy)
        await db.flush()
        people = []
        for i, (name, stage) in enumerate((("Мария Иванова", "new"), ("Павел Орлов", "review"), ("Екатерина Волкова", "interview"), ("Иван Петров", "testing"), ("Дарья Соколова", "offer"))):
            candidate = Candidate(company_id=company.id, vacancy_id=vacancies[i % 2].id, full_name=name, source="manual", stage=stage, history=[{"stage": stage, "at": now.isoformat(), "user_id": str(user.id)}])
            db.add(candidate); people.append(candidate)
        await db.flush()
        for i, candidate in enumerate(people[2:4]):
            db.add(Interview(company_id=company.id, candidate_id=candidate.id, title="Первичное собеседование" if i == 0 else "Финальное собеседование", starts_at=now+timedelta(hours=i+1), duration_minutes=30, created_by=user.id))
        await db.commit()
        print("Isolated preview fixtures created")
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
