import uuid
import enum
from sqlalchemy import Column, String, Text, ForeignKey, Enum, Integer, JSON, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base
from app.models.base import TimestampMixin


class DifficultyLevel(str, enum.Enum):
    BASIC = "basic"
    INTERMEDIATE = "intermediate"
    ADVANCED = "advanced"


class Criticality(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class KnowledgeTopic(Base, TimestampMixin):
    __tablename__ = "knowledge_topics"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    company_id = Column(
        UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    difficulty_level = Column(Enum(DifficultyLevel), default=DifficultyLevel.BASIC, nullable=False)
    criticality = Column(Enum(Criticality), default=Criticality.MEDIUM, nullable=False)
    required_knowledge_level = Column(Integer, default=1, nullable=False)  # 1–5
    related_lessons = Column(JSON, nullable=True)  # list[str]
    related_tests = Column(JSON, nullable=True)    # list[str]
    sort_order = Column(Integer, default=0, server_default="0", nullable=False)  # position in the library

    company = relationship("Company", back_populates="knowledge_topics")
    position_links = relationship("PositionTopic", back_populates="topic", cascade="all, delete-orphan")


class PositionTopic(Base, TimestampMixin):
    """M2M: Position ↔ KnowledgeTopic assignment."""
    __tablename__ = "position_topics"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    position_id = Column(
        UUID(as_uuid=True), ForeignKey("positions.id", ondelete="CASCADE"), nullable=False
    )
    topic_id = Column(
        UUID(as_uuid=True), ForeignKey("knowledge_topics.id", ondelete="CASCADE"), nullable=False
    )
    company_id = Column(
        UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    is_required = Column(Boolean, default=True, nullable=False)

    position = relationship("Position", back_populates="knowledge_links")
    topic = relationship("KnowledgeTopic", back_populates="position_links")
