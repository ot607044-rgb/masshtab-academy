from datetime import datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, field_validator

from app.models.employee import EmployeeStatus
from app.models.user import UserRole

AccessStatus = Literal["invited", "invite_expired", "active", "blocked"]


def company_role(value):
    if value == UserRole.SUPER_ADMIN:
        raise ValueError("Роль Super Admin нельзя назначить в компании")
    return value


class AccessUser(BaseModel):
    id: UUID
    email: str
    full_name: str
    role: UserRole
    status: AccessStatus
    employee_id: Optional[UUID] = None
    employee_name: Optional[str] = None
    employee_status: Optional[EmployeeStatus] = None
    invitation_expires_at: Optional[datetime] = None
    last_login_at: Optional[datetime] = None
    created_at: datetime


class GrantAccess(BaseModel):
    email: EmailStr
    role: UserRole = UserRole.EMPLOYEE

    @field_validator("role")
    @classmethod
    def valid_role(cls, value):
        return company_role(value)


class AccessUpdate(BaseModel):
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None

    @field_validator("role")
    @classmethod
    def valid_role(cls, value):
        return value if value is None else company_role(value)


class InvitationIssued(BaseModel):
    user: AccessUser
    invite_path: str
    invite_expires_at: datetime
    email_sent: bool


class InvitationInfo(BaseModel):
    email: str
    full_name: str
    company_name: Optional[str]
    expires_at: datetime


class AcceptInvitation(BaseModel):
    password: str
