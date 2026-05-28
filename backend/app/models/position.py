import uuid
from sqlalchemy import Column, String, Text, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base
from app.models.base import TimestampMixin


class Position(Base, TimestampMixin):
    __tablename__ = "positions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    company_id = Column(
        UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    department_id = Column(
        UUID(as_uuid=True), ForeignKey("departments.id", ondelete="SET NULL"), nullable=True
    )
    required_skills = Column(JSON, nullable=True)  # list[str]

    company = relationship("Company", back_populates="positions")
    department = relationship("Department", back_populates="positions")
    employees = relationship("Employee", back_populates="position")
    knowledge_links = relationship("PositionTopic", back_populates="position", cascade="all, delete-orphan")
