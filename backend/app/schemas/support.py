from pydantic import BaseModel, field_validator
from uuid import UUID
from datetime import datetime
from typing import Optional, List


class SupportRequestCreate(BaseModel):
    company_id: UUID
    reason: str
    duration_hours: int = 8

    @field_validator("reason")
    @classmethod
    def reason_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Необходимо указать причину")
        return v.strip()

    @field_validator("duration_hours")
    @classmethod
    def duration_valid(cls, v: int) -> int:
        if not 1 <= v <= 72:
            raise ValueError("Допустимое время: от 1 до 72 часов")
        return v


class SupportRequestApprove(BaseModel):
    duration_hours: int = 8

    @field_validator("duration_hours")
    @classmethod
    def duration_valid(cls, v: int) -> int:
        if not 1 <= v <= 72:
            raise ValueError("Допустимое время: от 1 до 72 часов")
        return v


class SupportRequestReject(BaseModel):
    reason: Optional[str] = None


class SupportAccessLogResponse(BaseModel):
    id: UUID
    session_id: UUID
    super_admin_id: UUID
    company_id: UUID
    endpoint: Optional[str]
    method: Optional[str]
    accessed_at: datetime

    model_config = {"from_attributes": True}


class SupportRequestResponse(BaseModel):
    id: UUID
    super_admin_id: UUID
    company_id: UUID
    reason: str
    status: str
    duration_hours: int
    requested_at: datetime
    approved_at: Optional[datetime]
    approved_by_id: Optional[UUID]
    expires_at: Optional[datetime]
    revoked_at: Optional[datetime]
    revoked_by_id: Optional[UUID]
    reject_reason: Optional[str]
    super_admin_name: Optional[str] = None
    company_name: Optional[str] = None
    logs_count: int = 0

    model_config = {"from_attributes": True}
