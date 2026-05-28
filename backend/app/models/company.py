import uuid
from sqlalchemy import Column, String, Boolean, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base
from app.models.base import TimestampMixin


class Company(Base, TimestampMixin):
    __tablename__ = "companies"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    slug = Column(String(100), unique=True, nullable=False, index=True)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)

    users = relationship("User", back_populates="company", cascade="all, delete-orphan")
    departments = relationship("Department", back_populates="company", cascade="all, delete-orphan")
    positions = relationship("Position", back_populates="company", cascade="all, delete-orphan")
    hr_employees = relationship("Employee", back_populates="company", cascade="all, delete-orphan")
    knowledge_topics = relationship("KnowledgeTopic", back_populates="company", cascade="all, delete-orphan")
    lessons = relationship("Lesson", back_populates="company", cascade="all, delete-orphan")
