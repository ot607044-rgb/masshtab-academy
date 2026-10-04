import uuid
import enum
from sqlalchemy import Column, String, Text, Integer, ForeignKey, Enum
from sqlalchemy.dialects.postgresql import UUID, JSON
from sqlalchemy.orm import relationship
from app.database import Base
from app.models.base import TimestampMixin


class LessonStatus(str, enum.Enum):
    DRAFT = "draft"
    PUBLISHED = "published"
    ARCHIVED = "archived"


class MaterialType(str, enum.Enum):
    TEXT = "text"
    PDF = "pdf"
    DOC = "doc"
    XLS = "xls"
    IMAGE = "image"
    PRESENTATION = "presentation"
    CHECKLIST = "checklist"
    EXTERNAL_LINK = "external_link"
    VIDEO_LINK = "video_link"


class AssignmentStatus(str, enum.Enum):
    ASSIGNED = "assigned"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"


class Lesson(Base, TimestampMixin):
    __tablename__ = "lessons"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String(500), nullable=False)
    description = Column(Text, nullable=True)
    text_content = Column(Text, nullable=True)

    company_id = Column(
        UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    position_id = Column(
        UUID(as_uuid=True), ForeignKey("positions.id", ondelete="SET NULL"), nullable=True
    )
    topic_id = Column(
        UUID(as_uuid=True), ForeignKey("knowledge_topics.id", ondelete="SET NULL"), nullable=True
    )
    author_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    difficulty_level = Column(String(20), nullable=True)   # basic / intermediate / advanced
    duration_minutes = Column(Integer, nullable=True)
    video_url = Column(String(2048), nullable=True)
    external_links = Column(JSON, nullable=True)           # list[{title, url}]
    sort_order = Column(Integer, default=0, server_default="0", nullable=False)  # position inside the topic block

    # stored as VARCHAR via native_enum=False to avoid PG enum-type conflicts
    status = Column(
        Enum(LessonStatus, native_enum=False, name="_lesson_status"),
        default=LessonStatus.DRAFT, nullable=False,
    )

    company = relationship("Company", back_populates="lessons")
    materials = relationship(
        "LessonMaterial", back_populates="lesson", cascade="all, delete-orphan"
    )
    assignments = relationship(
        "LessonAssignment", back_populates="lesson", cascade="all, delete-orphan"
    )

    @property
    def material_types(self) -> list[str]:
        """Material types for library cards; requires materials to be eager-loaded."""
        return [m.material_type.value if hasattr(m.material_type, "value") else m.material_type for m in self.materials]


class LessonMaterial(Base, TimestampMixin):
    __tablename__ = "lesson_materials"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    lesson_id = Column(
        UUID(as_uuid=True), ForeignKey("lessons.id", ondelete="CASCADE"), nullable=False
    )
    company_id = Column(
        UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    title = Column(String(500), nullable=False)
    material_type = Column(
        Enum(MaterialType, native_enum=False, name="_material_type"),
        nullable=False,
    )
    url = Column(String(2048), nullable=True)      # link or server path for uploads
    file_name = Column(String(500), nullable=True) # original filename
    file_size = Column(Integer, nullable=True)     # bytes

    lesson = relationship("Lesson", back_populates="materials")


class LessonAssignment(Base, TimestampMixin):
    __tablename__ = "lesson_assignments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    lesson_id = Column(
        UUID(as_uuid=True), ForeignKey("lessons.id", ondelete="CASCADE"), nullable=False
    )
    employee_id = Column(
        UUID(as_uuid=True), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False
    )
    company_id = Column(
        UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    assigned_by = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    status = Column(
        Enum(AssignmentStatus, native_enum=False, name="_assignment_status"),
        default=AssignmentStatus.ASSIGNED, nullable=False,
    )
    due_date = Column(String(10), nullable=True)    # ISO date YYYY-MM-DD
    completed_at = Column(String(30), nullable=True)

    lesson = relationship("Lesson", back_populates="assignments")
    employee = relationship("Employee", foreign_keys=[employee_id])
