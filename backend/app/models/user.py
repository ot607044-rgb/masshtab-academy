import uuid
import enum
from sqlalchemy import Column, String, Boolean, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base
from app.models.base import TimestampMixin


class UserRole(str, enum.Enum):
    SUPER_ADMIN = "super_admin"
    COMPANY_ADMIN = "company_admin"
    HR = "hr"
    DEPARTMENT_HEAD = "department_head"
    METHODOLOGIST = "methodologist"
    EMPLOYEE = "employee"


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    # String(50) — не используем Enum чтобы избежать PostgreSQL-каста ::userrole
    role = Column(String(50), nullable=False, default=UserRole.EMPLOYEE.value)
    is_active = Column(Boolean, default=True, nullable=False)

    # NULL only for super_admin (platform-level, no company)
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=True)
    company = relationship("Company", back_populates="users")
