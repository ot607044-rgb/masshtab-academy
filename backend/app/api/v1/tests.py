import uuid
from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.schemas.test import (
    TestCreate, TestUpdate, TestResponse, TestDetailResponse, TestForTakingResponse,
    QuestionCreate, QuestionUpdate, QuestionFull, QuestionPublic,
    AttemptSubmit, AttemptResultResponse, QuestionResultItem, AttemptSummary,
)
from app.models.test import Test, Question, AnswerOption, TestAttempt, AttemptAnswer
from app.models.employee import Employee
from app.models.lesson import Lesson, LessonAssignment, LessonStatus
from app.models.user import UserRole
from app.api.deps import get_content_creator, get_any_company_user, get_effective_company_id

router = APIRouter()

# ── Helpers ────────────────────────────────────────────────────────────────────

def _sorted_questions(test: Test) -> List[Question]:
    return sorted(test.questions, key=lambda q: (q.order_index, str(q.id)))


def _sorted_options(question: Question) -> List[AnswerOption]:
    return sorted(question.options, key=lambda o: (o.order_index, str(o.id)))


def _build_test_detail(test: Test) -> TestDetailResponse:
    resp = TestDetailResponse.model_validate(test)
    resp.questions = [
        QuestionFull(
            id=q.id, question_type=q.question_type, text=q.text,
            explanation=q.explanation, points=q.points, order_index=q.order_index,
            options=[
                {"id": o.id, "text": o.text, "is_correct": o.is_correct, "order_index": o.order_index}
                for o in _sorted_options(q)
            ],
        )
        for q in _sorted_questions(test)
    ]
    return resp


def _build_test_for_taking(test: Test) -> TestForTakingResponse:
    resp = TestForTakingResponse.model_validate(test)
    resp.questions = [
        QuestionPublic(
            id=q.id, question_type=q.question_type, text=q.text,
            explanation=None,  # hide explanation until after submit
            points=q.points, order_index=q.order_index,
            options=[
                {"id": o.id, "text": o.text, "order_index": o.order_index}
                for o in _sorted_options(q)
            ],
        )
        for q in _sorted_questions(test)
    ]
    return resp


def _load_test_q():
    return (
        select(Test)
        .options(
            selectinload(Test.questions).selectinload(Question.options),
        )
    )


# ── Score a single answer ──────────────────────────────────────────────────────

def _score_answer(question: Question, selected_ids: Optional[List[str]], text: Optional[str]):
    """Returns (is_correct, points_earned)."""
    opt_map = {str(o.id): o for o in question.options}

    if question.question_type in ("single", "yes_no"):
        if not selected_ids or len(selected_ids) != 1:
            return False, 0.0
        opt = opt_map.get(selected_ids[0])
        correct = opt is not None and opt.is_correct
        return correct, float(question.points) if correct else 0.0

    if question.question_type == "multiple":
        selected = set(selected_ids or [])
        correct_set = {str(o.id) for o in question.options if o.is_correct}
        correct = selected == correct_set and len(correct_set) > 0
        return correct, float(question.points) if correct else 0.0

    if question.question_type in ("text", "case"):
        answered = bool(text and text.strip())
        # Auto-pass non-empty answers; HR can review text_answer separately
        return answered, float(question.points) if answered else 0.0

    return False, 0.0


# ── Test CRUD ──────────────────────────────────────────────────────────────────

@router.get("/", response_model=List[TestResponse])
async def list_tests(
    status_filter: Optional[str] = None,
    current_user=Depends(get_any_company_user),
    effective_company_id: UUID = Depends(get_effective_company_id),
    db: AsyncSession = Depends(get_db),
):
    q = select(Test).where(Test.company_id == effective_company_id)
    if current_user.role == UserRole.EMPLOYEE:
        q = q.where(Test.status == "published")
    elif status_filter:
        q = q.where(Test.status == status_filter)
    result = await db.execute(q.order_by(Test.created_at.desc()))
    return result.scalars().all()


@router.post("/", response_model=TestDetailResponse, status_code=status.HTTP_201_CREATED)
async def create_test(
    data: TestCreate,
    current_user=Depends(get_content_creator),
    effective_company_id: UUID = Depends(get_effective_company_id),
    db: AsyncSession = Depends(get_db),
):
    test = Test(
        id=uuid.uuid4(),
        company_id=effective_company_id,
        title=data.title,
        description=data.description,
        position_id=data.position_id,
        topic_id=data.topic_id,
        lesson_id=data.lesson_id,
        author_id=current_user.id,
        passing_score=data.passing_score,
        max_attempts=data.max_attempts,
        time_limit_minutes=data.time_limit_minutes,
        status=data.status,
    )
    db.add(test)
    await db.commit()

    loaded = await db.execute(_load_test_q().where(Test.id == test.id))
    return _build_test_detail(loaded.scalar_one())


@router.get("/{test_id}", response_model=TestDetailResponse)
async def get_test(
    test_id: UUID,
    current_user=Depends(get_any_company_user),
    effective_company_id: UUID = Depends(get_effective_company_id),
    db: AsyncSession = Depends(get_db),
):
    loaded = await db.execute(_load_test_q().where(Test.id == test_id))
    test = loaded.scalar_one_or_none()
    if not test:
        raise HTTPException(404, "Тест не найден")
    if test.company_id != effective_company_id:
        raise HTTPException(403, "Доступ запрещён")
    if current_user.role == UserRole.EMPLOYEE and test.status != "published":
        raise HTTPException(403, "Тест не опубликован")
    return _build_test_detail(test)


@router.patch("/{test_id}", response_model=TestDetailResponse)
async def update_test(
    test_id: UUID,
    data: TestUpdate,
    current_user=Depends(get_content_creator),
    effective_company_id: UUID = Depends(get_effective_company_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Test).where(Test.id == test_id))
    test = result.scalar_one_or_none()
    if not test:
        raise HTTPException(404, "Тест не найден")
    if test.company_id != effective_company_id:
        raise HTTPException(403, "Доступ запрещён")

    for field, value in data.model_dump(exclude_none=True).items():
        setattr(test, field, value)
    test.updated_at = datetime.now(timezone.utc)
    await db.commit()

    loaded = await db.execute(_load_test_q().where(Test.id == test_id))
    return _build_test_detail(loaded.scalar_one())


@router.post("/{test_id}/publish", response_model=TestResponse)
async def publish_test(
    test_id: UUID,
    current_user=Depends(get_content_creator),
    effective_company_id: UUID = Depends(get_effective_company_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Test).where(Test.id == test_id))
    test = result.scalar_one_or_none()
    if not test:
        raise HTTPException(404, "Тест не найден")
    if test.company_id != effective_company_id:
        raise HTTPException(403, "Доступ запрещён")

    q_count = await db.execute(select(Question).where(Question.test_id == test_id))
    if not q_count.scalars().all():
        raise HTTPException(400, "Нельзя опубликовать тест без вопросов")

    test.status = "published"
    test.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(test)
    return test


@router.post("/{test_id}/archive", response_model=TestResponse)
async def archive_test(
    test_id: UUID,
    current_user=Depends(get_content_creator),
    effective_company_id: UUID = Depends(get_effective_company_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Test).where(Test.id == test_id))
    test = result.scalar_one_or_none()
    if not test:
        raise HTTPException(404, "Тест не найден")
    if test.company_id != effective_company_id:
        raise HTTPException(403, "Доступ запрещён")
    test.status = "archived"
    test.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(test)
    return test


@router.delete("/{test_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_test(
    test_id: UUID,
    current_user=Depends(get_content_creator),
    effective_company_id: UUID = Depends(get_effective_company_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Test).where(Test.id == test_id))
    test = result.scalar_one_or_none()
    if not test:
        raise HTTPException(404, "Тест не найден")
    if test.company_id != effective_company_id:
        raise HTTPException(403, "Доступ запрещён")
    await db.delete(test)
    await db.commit()


# ── Questions ──────────────────────────────────────────────────────────────────

@router.post("/{test_id}/questions", response_model=TestDetailResponse, status_code=201)
async def add_question(
    test_id: UUID,
    data: QuestionCreate,
    current_user=Depends(get_content_creator),
    effective_company_id: UUID = Depends(get_effective_company_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Test).where(Test.id == test_id))
    test = result.scalar_one_or_none()
    if not test:
        raise HTTPException(404, "Тест не найден")
    if test.company_id != effective_company_id:
        raise HTTPException(403, "Доступ запрещён")

    question = Question(
        id=uuid.uuid4(),
        test_id=test_id,
        company_id=effective_company_id,
        question_type=data.question_type,
        text=data.text,
        explanation=data.explanation,
        points=data.points,
        order_index=data.order_index,
    )
    db.add(question)
    await db.flush()

    for opt_data in data.options:
        db.add(AnswerOption(
            id=uuid.uuid4(),
            question_id=question.id,
            text=opt_data.text,
            is_correct=opt_data.is_correct,
            order_index=opt_data.order_index,
        ))

    await db.commit()

    loaded = await db.execute(_load_test_q().where(Test.id == test_id))
    return _build_test_detail(loaded.scalar_one())


@router.patch("/{test_id}/questions/{question_id}", response_model=TestDetailResponse)
async def update_question(
    test_id: UUID,
    question_id: UUID,
    data: QuestionUpdate,
    current_user=Depends(get_content_creator),
    effective_company_id: UUID = Depends(get_effective_company_id),
    db: AsyncSession = Depends(get_db),
):
    q_result = await db.execute(
        select(Question).options(selectinload(Question.options))
        .where(Question.id == question_id, Question.test_id == test_id)
    )
    question = q_result.scalar_one_or_none()
    if not question:
        raise HTTPException(404, "Вопрос не найден")
    if question.company_id != effective_company_id:
        raise HTTPException(403, "Доступ запрещён")

    for field, value in data.model_dump(exclude_none=True, exclude={"options"}).items():
        setattr(question, field, value)

    if data.options is not None:
        for opt in question.options:
            await db.delete(opt)
        await db.flush()
        for opt_data in data.options:
            db.add(AnswerOption(
                id=uuid.uuid4(),
                question_id=question.id,
                text=opt_data.text,
                is_correct=opt_data.is_correct,
                order_index=opt_data.order_index,
            ))

    await db.commit()

    loaded = await db.execute(_load_test_q().where(Test.id == test_id))
    return _build_test_detail(loaded.scalar_one())


@router.delete("/{test_id}/questions/{question_id}", response_model=TestDetailResponse)
async def delete_question(
    test_id: UUID,
    question_id: UUID,
    current_user=Depends(get_content_creator),
    effective_company_id: UUID = Depends(get_effective_company_id),
    db: AsyncSession = Depends(get_db),
):
    q_result = await db.execute(
        select(Question).where(Question.id == question_id, Question.test_id == test_id)
    )
    question = q_result.scalar_one_or_none()
    if not question:
        raise HTTPException(404, "Вопрос не найден")
    if question.company_id != effective_company_id:
        raise HTTPException(403, "Доступ запрещён")
    await db.delete(question)
    await db.commit()

    loaded = await db.execute(_load_test_q().where(Test.id == test_id))
    return _build_test_detail(loaded.scalar_one())


# ── Test taking ────────────────────────────────────────────────────────────────

async def _get_employee(db: AsyncSession, user_id: UUID, company_id: UUID) -> Employee:
    result = await db.execute(
        select(Employee).where(Employee.user_id == user_id, Employee.company_id == company_id)
    )
    emp = result.scalar_one_or_none()
    if not emp:
        raise HTTPException(403, "Нет профиля сотрудника для этого пользователя. Обратитесь к HR.")
    return emp


@router.post("/{test_id}/start", response_model=TestForTakingResponse)
async def start_test(
    test_id: UUID,
    current_user=Depends(get_any_company_user),
    effective_company_id: UUID = Depends(get_effective_company_id),
    db: AsyncSession = Depends(get_db),
):
    """Start a new attempt or resume an in-progress one. Returns test + questions (no correct hints)."""
    loaded = await db.execute(_load_test_q().where(Test.id == test_id))
    test = loaded.scalar_one_or_none()
    if not test:
        raise HTTPException(404, "Тест не найден")
    if test.company_id != effective_company_id:
        raise HTTPException(403, "Доступ запрещён")
    if test.status != "published":
        raise HTTPException(400, "Тест не опубликован")
    if not test.questions:
        raise HTTPException(400, "В тесте нет вопросов")

    employee = await _get_employee(db, current_user.id, effective_company_id)

    # Check for in-progress attempt first
    in_progress = await db.execute(
        select(TestAttempt).where(
            TestAttempt.test_id == test_id,
            TestAttempt.employee_id == employee.id,
            TestAttempt.status == "in_progress",
        )
    )
    if in_progress.scalar_one_or_none():
        # Resume existing
        resp = _build_test_for_taking(test)
        return resp

    # Check attempt limit
    completed = await db.execute(
        select(TestAttempt).where(
            TestAttempt.test_id == test_id,
            TestAttempt.employee_id == employee.id,
            TestAttempt.status == "completed",
        )
    )
    completed_count = len(completed.scalars().all())
    if completed_count >= test.max_attempts:
        raise HTTPException(400, f"Исчерпан лимит попыток ({test.max_attempts})")

    attempt = TestAttempt(
        id=uuid.uuid4(),
        test_id=test_id,
        employee_id=employee.id,
        company_id=effective_company_id,
        status="in_progress",
    )
    db.add(attempt)
    await db.commit()

    return _build_test_for_taking(test)


@router.post("/{test_id}/submit", response_model=AttemptResultResponse)
async def submit_test(
    test_id: UUID,
    data: AttemptSubmit,
    current_user=Depends(get_any_company_user),
    effective_company_id: UUID = Depends(get_effective_company_id),
    db: AsyncSession = Depends(get_db),
):
    """Submit answers. Scores the attempt and triggers auto-assignment if score < passing_score."""
    employee = await _get_employee(db, current_user.id, effective_company_id)

    # Find in-progress attempt
    attempt_r = await db.execute(
        select(TestAttempt).where(
            TestAttempt.test_id == test_id,
            TestAttempt.employee_id == employee.id,
            TestAttempt.status == "in_progress",
        )
    )
    attempt = attempt_r.scalar_one_or_none()
    if not attempt:
        raise HTTPException(400, "Нет активной попытки. Начните тест сначала.")

    # Load test + questions + options
    loaded = await db.execute(_load_test_q().where(Test.id == test_id))
    test = loaded.scalar_one()
    if test.company_id != effective_company_id:
        raise HTTPException(403, "Доступ запрещён")

    questions_by_id = {q.id: q for q in test.questions}
    total_possible = sum(q.points for q in test.questions)
    total_earned = 0.0

    # Process and score each answer
    answered_ids = set()
    for ans_data in data.answers:
        qid = ans_data.question_id
        question = questions_by_id.get(qid)
        if not question:
            continue
        answered_ids.add(qid)

        is_correct, points_earned = _score_answer(
            question, ans_data.selected_option_ids, ans_data.text_answer
        )
        total_earned += points_earned

        db.add(AttemptAnswer(
            id=uuid.uuid4(),
            attempt_id=attempt.id,
            question_id=qid,
            selected_option_ids=ans_data.selected_option_ids,
            text_answer=ans_data.text_answer,
            is_correct=is_correct,
            points_earned=points_earned,
        ))

    # Questions not answered at all → 0 points, is_correct=False
    for qid, question in questions_by_id.items():
        if qid not in answered_ids:
            db.add(AttemptAnswer(
                id=uuid.uuid4(),
                attempt_id=attempt.id,
                question_id=qid,
                selected_option_ids=None,
                text_answer=None,
                is_correct=False,
                points_earned=0.0,
            ))

    score = round((total_earned / total_possible * 100), 1) if total_possible > 0 else 0.0
    passed = score >= test.passing_score

    attempt.status = "completed"
    attempt.score = score
    attempt.passed = passed
    attempt.completed_at = datetime.now(timezone.utc)
    if data.time_spent_seconds:
        attempt.time_spent_seconds = data.time_spent_seconds

    # ── Auto-assignment & diagnostics on failure ───────────────────────────────
    auto_lesson = None
    weak_topic_added = False
    repeat_test_assigned = False
    topic_str = str(test.topic_id) if test.topic_id else None

    def employee_level(value: float) -> str:
        if value >= 85:
            return "advanced"
        if value >= test.passing_score:
            return "intermediate"
        return "basic"

    if not passed:
        # 1. Assign linked lesson if not already assigned
        if test.lesson_id:
            lesson_r = await db.execute(select(Lesson).where(Lesson.id == test.lesson_id))
            lesson_obj = lesson_r.scalar_one_or_none()
            if lesson_obj and lesson_obj.status == LessonStatus.PUBLISHED:
                dup_r = await db.execute(
                    select(LessonAssignment).where(
                        LessonAssignment.lesson_id == test.lesson_id,
                        LessonAssignment.employee_id == employee.id,
                    )
                )
                if not dup_r.scalar_one_or_none():
                    db.add(LessonAssignment(
                        id=uuid.uuid4(),
                        lesson_id=test.lesson_id,
                        employee_id=employee.id,
                        company_id=effective_company_id,
                        assigned_by=None,
                    ))
                    auto_lesson = {"id": str(lesson_obj.id), "title": lesson_obj.title}
                    attempt.auto_assigned_lesson_id = lesson_obj.id

        # 2. Mark topic as weak area on employee
        if topic_str:
            emp_r = await db.execute(select(Employee).where(Employee.id == employee.id))
            emp = emp_r.scalar_one()
            weak = list(emp.weak_areas) if emp.weak_areas else []
            if topic_str not in weak:
                weak.append(topic_str)
                emp.weak_areas = weak
                weak_topic_added = True
            repeat_test_assigned = True

    # Store latest result in employee.test_results for quick lookup
    emp_r2 = await db.execute(select(Employee).where(Employee.id == employee.id))
    emp2 = emp_r2.scalar_one()
    results = dict(emp2.test_results) if emp2.test_results else {}
    results[str(test_id)] = {
        "score": score,
        "passed": passed,
        "knowledge_percent": score,
        "employee_level": employee_level(score),
        "attempted_at": datetime.now(timezone.utc).isoformat(),
    }
    emp2.test_results = results

    await db.commit()

    # Build per-question breakdown
    q_results = []
    for question in _sorted_questions(test):
        answered = next(
            (a for a in data.answers if a.question_id == question.id), None
        )
        is_correct, points_earned = _score_answer(
            question,
            answered.selected_option_ids if answered else None,
            answered.text_answer if answered else None,
        )
        q_results.append(QuestionResultItem(
            question_id=str(question.id),
            question_text=question.text,
            question_type=question.question_type,
            is_correct=is_correct,
            points_earned=points_earned,
            max_points=question.points,
            correct_option_ids=[str(o.id) for o in question.options if o.is_correct],
            selected_option_ids=answered.selected_option_ids if answered else None,
            text_answer=answered.text_answer if answered else None,
            explanation=question.explanation,
        ))

    return AttemptResultResponse(
        attempt_id=str(attempt.id),
        score=score,
        passed=passed,
        knowledge_percent=score,
        strong_topics=[topic_str] if topic_str and passed else [],
        weak_topics=[topic_str] if topic_str and not passed else [],
        employee_level=employee_level(score),
        total_points=total_possible,
        earned_points=total_earned,
        passing_score=test.passing_score,
        question_results=q_results,
        auto_assigned_lesson=auto_lesson,
        weak_topic_added=weak_topic_added,
        repeat_test_assigned=repeat_test_assigned,
    )


@router.get("/{test_id}/my-attempts", response_model=List[AttemptSummary])
async def my_attempts(
    test_id: UUID,
    current_user=Depends(get_any_company_user),
    effective_company_id: UUID = Depends(get_effective_company_id),
    db: AsyncSession = Depends(get_db),
):
    employee = await _get_employee(db, current_user.id, effective_company_id)
    result = await db.execute(
        select(TestAttempt)
        .where(TestAttempt.test_id == test_id, TestAttempt.employee_id == employee.id)
        .order_by(TestAttempt.started_at.desc())
    )
    return result.scalars().all()


# ── HR: all results for a test ─────────────────────────────────────────────────

@router.get("/{test_id}/results", response_model=List[AttemptSummary])
async def test_results(
    test_id: UUID,
    current_user=Depends(get_content_creator),
    effective_company_id: UUID = Depends(get_effective_company_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Test).where(Test.id == test_id))
    test = result.scalar_one_or_none()
    if not test:
        raise HTTPException(404, "Тест не найден")
    if test.company_id != effective_company_id:
        raise HTTPException(403, "Доступ запрещён")

    attempts_r = await db.execute(
        select(TestAttempt)
        .options(selectinload(TestAttempt.employee))
        .where(TestAttempt.test_id == test_id, TestAttempt.status == "completed")
        .order_by(TestAttempt.completed_at.desc())
    )
    attempts = attempts_r.scalars().all()

    result_list = []
    for a in attempts:
        s = AttemptSummary.model_validate(a)
        s.employee_name = a.employee.full_name if a.employee else None
        result_list.append(s)
    return result_list


# ── My tests list (employee cabinet) ──────────────────────────────────────────

@router.get("/my/overview", response_model=List[dict])
async def my_tests_overview(
    current_user=Depends(get_any_company_user),
    effective_company_id: UUID = Depends(get_effective_company_id),
    db: AsyncSession = Depends(get_db),
):
    """Returns published tests with the employee's best attempt info."""
    employee = await _get_employee(db, current_user.id, effective_company_id)

    tests_r = await db.execute(
        select(Test).where(Test.company_id == effective_company_id, Test.status == "published")
        .order_by(Test.created_at.desc())
    )
    tests = tests_r.scalars().all()

    overview = []
    for test in tests:
        attempts_r = await db.execute(
            select(TestAttempt)
            .where(TestAttempt.test_id == test.id, TestAttempt.employee_id == employee.id)
            .order_by(TestAttempt.started_at.desc())
        )
        attempts = attempts_r.scalars().all()
        completed = [a for a in attempts if a.status == "completed"]
        in_progress = next((a for a in attempts if a.status == "in_progress"), None)

        best = max((a.score for a in completed if a.score is not None), default=None)
        overview.append({
            "id": str(test.id),
            "title": test.title,
            "description": test.description,
            "passing_score": test.passing_score,
            "max_attempts": test.max_attempts,
            "time_limit_minutes": test.time_limit_minutes,
            "attempts_used": len(completed),
            "best_score": best,
            "passed": any(a.passed for a in completed),
            "in_progress": in_progress is not None,
            "can_attempt": len(completed) < test.max_attempts or in_progress is not None,
        })
    return overview
