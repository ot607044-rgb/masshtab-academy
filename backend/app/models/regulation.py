import uuid
from sqlalchemy import Column, String, Text, ForeignKey, JSON, Boolean, DateTime, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base
from app.models.base import TimestampMixin, utc_now


class PositionRegulation(Base, TimestampMixin):
    """Вариант функционала (регламент) должности: цель и перечень обязанностей."""
    __tablename__ = "position_regulations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    position_id = Column(UUID(as_uuid=True), ForeignKey("positions.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    summary = Column(String(255), nullable=True)   # «Полный функционал», «Специализация»
    status = Column(String(20), nullable=False, default="active")  # active | draft
    goal = Column(Text, nullable=True)
    duties = Column(JSON, nullable=False, default=list)  # list[str]
    updated_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    updated_by_name = Column(String(255), nullable=True)


class RegulationAssignment(Base):
    """Назначенный сотруднику регламент. У сотрудника один действующий вариант."""
    __tablename__ = "regulation_assignments"
    __table_args__ = (UniqueConstraint("employee_id", name="uq_regulation_assignments_employee"),)

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    employee_id = Column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    regulation_id = Column(UUID(as_uuid=True), ForeignKey("position_regulations.id", ondelete="CASCADE"), nullable=False, index=True)
    require_ack = Column(Boolean, nullable=False, default=True)
    acknowledged_at = Column(DateTime, nullable=True)
    assigned_at = Column(DateTime, nullable=False, default=utc_now)
    assigned_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
