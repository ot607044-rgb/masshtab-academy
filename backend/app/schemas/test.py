from pydantic import BaseModel, field_validator
from uuid import UUID
from datetime import datetime
from typing import Optional, List, Any


# ── Answer options ─────────────────────────────────────────────────────────────

class AnswerOptionPublic(BaseModel):
    """Without is_correct — shown to employee during the test."""
    id: UUID
    text: str
    order_index: int
    model_config = {"from_attributes": True}


class AnswerOptionFull(BaseModel):
    """With is_correct — shown to HR in the editor."""
    id: UUID
    text: str
    is_correct: bool
    order_index: int
    model_config = {"from_attributes": True}


class AnswerOptionCreate(BaseModel):
    text: str
    is_correct: bool = False
    order_index: int = 0


# ── Questions ──────────────────────────────────────────────────────────────────

class QuestionPublic(BaseModel):
    """Options without is_correct — for test-taking."""
    id: UUID
    question_type: str
    text: str
    explanation: Optional[str] = None
    points: int
    order_index: int
    options: List[AnswerOptionPublic] = []
    model_config = {"from_attributes": True}


class QuestionFull(BaseModel):
    """Full data including is_correct — for HR editor."""
    id: UUID
    question_type: str
    text: str
    explanation: Optional[str] = None
    points: int
    order_index: int
    options: List[AnswerOptionFull] = []
    model_config = {"from_attributes": True}


class QuestionCreate(BaseModel):
    question_type: str = "single"
    text: str
    explanation: Optional[str] = None
    points: int = 1
    order_index: int = 0
    options: List[AnswerOptionCreate] = []

    @field_validator("question_type")
    @classmethod
    def valid_type(cls, v: str) -> str:
        allowed = {"single", "multiple", "text", "yes_no", "case"}
        if v not in allowed:
            raise ValueError(f"Тип вопроса должен быть одним из: {', '.join(allowed)}")
        return v

    @field_validator("points")
    @classmethod
    def positive_points(cls, v: int) -> int:
        if v < 1:
            raise ValueError("Баллы должны быть не менее 1")
        return v


class QuestionUpdate(BaseModel):
    question_type: Optional[str] = None
    text: Optional[str] = None
    explanation: Optional[str] = None
    points: Optional[int] = None
    order_index: Optional[int] = None
    options: Optional[List[AnswerOptionCreate]] = None


# ── Test ───────────────────────────────────────────────────────────────────────

class TestCreate(BaseModel):
    title: str
    description: Optional[str] = None
    position_id: Optional[UUID] = None
    topic_id: Optional[UUID] = None
    lesson_id: Optional[UUID] = None
    passing_score: int = 70
    max_attempts: int = 3
    time_limit_minutes: Optional[int] = None
    status: str = "draft"

    @field_validator("passing_score")
    @classmethod
    def score_range(cls, v: int) -> int:
        if not 1 <= v <= 100:
            raise ValueError("Проходной балл: 1–100")
        return v


class TestUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    position_id: Optional[UUID] = None
    topic_id: Optional[UUID] = None
    lesson_id: Optional[UUID] = None
    passing_score: Optional[int] = None
    max_attempts: Optional[int] = None
    time_limit_minutes: Optional[int] = None
    status: Optional[str] = None


class TestResponse(BaseModel):
    id: UUID
    company_id: UUID
    title: str
    description: Optional[str]
    position_id: Optional[UUID]
    topic_id: Optional[UUID]
    lesson_id: Optional[UUID]
    author_id: Optional[UUID]
    passing_score: int
    max_attempts: int
    time_limit_minutes: Optional[int]
    status: str
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


class TestDetailResponse(TestResponse):
    """Full test data with questions (HR editor view)."""
    questions: List[QuestionFull] = []


class TestForTakingResponse(TestResponse):
    """Test data without correct-answer hints (employee view)."""
    questions: List[QuestionPublic] = []


# ── Attempt submission ─────────────────────────────────────────────────────────

class AnswerSubmit(BaseModel):
    question_id: UUID
    selected_option_ids: Optional[List[str]] = None
    text_answer: Optional[str] = None


class AttemptSubmit(BaseModel):
    answers: List[AnswerSubmit]
    time_spent_seconds: Optional[int] = None


# ── Attempt results ────────────────────────────────────────────────────────────

class QuestionResultItem(BaseModel):
    question_id: str
    question_text: str
    question_type: str
    is_correct: Optional[bool]
    points_earned: float
    max_points: int
    correct_option_ids: List[str]
    selected_option_ids: Optional[List[str]]
    text_answer: Optional[str]
    explanation: Optional[str]


class AttemptResultResponse(BaseModel):
    attempt_id: str
    score: float
    passed: bool
    knowledge_percent: float
    strong_topics: List[str] = []
    weak_topics: List[str] = []
    employee_level: str
    total_points: int
    earned_points: float
    passing_score: int
    question_results: List[QuestionResultItem]
    auto_assigned_lesson: Optional[dict] = None
    weak_topic_added: bool = False
    repeat_test_assigned: bool = False


class AttemptSummary(BaseModel):
    id: UUID
    test_id: UUID
    employee_id: UUID
    status: str
    score: Optional[float]
    passed: Optional[bool]
    started_at: datetime
    completed_at: Optional[datetime]
    time_spent_seconds: Optional[int]
    auto_assigned_lesson_id: Optional[UUID]
    employee_name: Optional[str] = None
    model_config = {"from_attributes": True}
