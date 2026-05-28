import uuid
from sqlalchemy import Column, String, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base
from app.models.base import TimestampMixin


class Department(Base, TimestampMixin):
    __tablename__ = "departments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    company_id = Column(
        UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    # Soft reference to employees.id — set after employees table is created
    head_id = Column(UUID(as_uuid=True), nullable=True)

    company = relationship("Company", back_populates="departments")
    positions = relationship("Position", back_populates="department")
    employees = relationship(
        "Employee", back_populates="department", foreign_keys="Employee.department_id"
    )
