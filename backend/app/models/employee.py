import uuid
import enum
from sqlalchemy import Column, String, Text, ForeignKey, Enum, Date, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base
from app.models.base import TimestampMixin


class EmployeeStatus(str, enum.Enum):
    ACTIVE = "active"
    PROBATION = "probation"
    VACATION = "vacation"
    FIRED = "fired"


class Employee(Base, TimestampMixin):
    __tablename__ = "employees"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    full_name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)

    company_id = Column(
        UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    department_id = Column(
        UUID(as_uuid=True), ForeignKey("departments.id", ondelete="SET NULL"), nullable=True
    )
    position_id = Column(
        UUID(as_uuid=True), ForeignKey("positions.id", ondelete="SET NULL"), nullable=True
    )
    # Self-referential: руководитель
    manager_id = Column(
        UUID(as_uuid=True), ForeignKey("employees.id", ondelete="SET NULL"), nullable=True
    )
    # Optional link to a system User account
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    status = Column(Enum(EmployeeStatus), default=EmployeeStatus.ACTIVE, nullable=False)
    hire_date = Column(Date, nullable=True)
    weak_areas = Column(JSON, nullable=True)       # list[str]
    learning_history = Column(JSON, nullable=True) # list[dict]
    test_results = Column(JSON, nullable=True)     # dict

    company = relationship("Company", back_populates="hr_employees")
    department = relationship("Department", back_populates="employees", foreign_keys=[department_id])
    position = relationship("Position", back_populates="employees")
    manager = relationship("Employee", remote_side="Employee.id", foreign_keys=[manager_id])
