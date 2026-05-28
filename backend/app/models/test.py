import uuid
from sqlalchemy import Column, String, Text, Integer, Float, Boolean, DateTime, ForeignKey, JSON, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base


class Test(Base):
    __tablename__ = "tests"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(300), nullable=False)
    description = Column(Text, nullable=True)
    position_id = Column(UUID(as_uuid=True), ForeignKey("positions.id", ondelete="SET NULL"), nullable=True)
    topic_id = Column(UUID(as_uuid=True), ForeignKey("knowledge_topics.id", ondelete="SET NULL"), nullable=True)
    lesson_id = Column(UUID(as_uuid=True), ForeignKey("lessons.id", ondelete="SET NULL"), nullable=True)
    author_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    # passing_score: minimum percentage to pass (0–100)
    passing_score = Column(Integer, nullable=False, default=70)
    max_attempts = Column(Integer, nullable=False, default=3)
    time_limit_minutes = Column(Integer, nullable=True)
    # status: draft | published | archived
    status = Column(String(20), nullable=False, default="draft")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    questions = relationship("Question", back_populates="test", cascade="all, delete-orphan")
    attempts = relationship("TestAttempt", back_populates="test", cascade="all, delete-orphan")


class Question(Base):
    __tablename__ = "questions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    test_id = Column(UUID(as_uuid=True), ForeignKey("tests.id", ondelete="CASCADE"), nullable=False, index=True)
    company_id = Column(UUID(as_uuid=True), nullable=False)
    # question_type: single | multiple | text | yes_no | case
    question_type = Column(String(20), nullable=False, default="single")
    text = Column(Text, nullable=False)
    explanation = Column(Text, nullable=True)
    points = Column(Integer, nullable=False, default=1)
    order_index = Column(Integer, nullable=False, default=0)

    test = relationship("Test", back_populates="questions")
    options = relationship("AnswerOption", back_populates="question", cascade="all, delete-orphan")
    attempt_answers = relationship("AttemptAnswer", back_populates="question", cascade="all, delete-orphan")


class AnswerOption(Base):
    __tablename__ = "answer_options"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    question_id = Column(UUID(as_uuid=True), ForeignKey("questions.id", ondelete="CASCADE"), nullable=False, index=True)
    text = Column(Text, nullable=False)
    is_correct = Column(Boolean, nullable=False, default=False)
    order_index = Column(Integer, nullable=False, default=0)

    question = relationship("Question", back_populates="options")


class TestAttempt(Base):
    __tablename__ = "test_attempts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    test_id = Column(UUID(as_uuid=True), ForeignKey("tests.id", ondelete="CASCADE"), nullable=False, index=True)
    employee_id = Column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True)
    company_id = Column(UUID(as_uuid=True), nullable=False)
    # status: in_progress | completed
    status = Column(String(20), nullable=False, default="in_progress")
    score = Column(Float, nullable=True)          # percentage 0–100
    passed = Column(Boolean, nullable=True)
    started_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    time_spent_seconds = Column(Integer, nullable=True)
    auto_assigned_lesson_id = Column(UUID(as_uuid=True), nullable=True)

    test = relationship("Test", back_populates="attempts")
    employee = relationship("Employee")
    answers = relationship("AttemptAnswer", back_populates="attempt", cascade="all, delete-orphan")


class AttemptAnswer(Base):
    __tablename__ = "attempt_answers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    attempt_id = Column(UUID(as_uuid=True), ForeignKey("test_attempts.id", ondelete="CASCADE"), nullable=False, index=True)
    question_id = Column(UUID(as_uuid=True), ForeignKey("questions.id", ondelete="CASCADE"), nullable=False)
    # For SINGLE / MULTIPLE / YES_NO — list of selected option ID strings
    selected_option_ids = Column(JSON, nullable=True)
    # For TEXT / CASE — free-form answer
    text_answer = Column(Text, nullable=True)
    # null for TEXT/CASE if non-empty (auto-passed), True/False for objective types
    is_correct = Column(Boolean, nullable=True)
    points_earned = Column(Float, nullable=False, default=0.0)

    attempt = relationship("TestAttempt", back_populates="answers")
    question = relationship("Question", back_populates="attempt_answers")
