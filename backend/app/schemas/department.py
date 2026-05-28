from pydantic import BaseModel
from uuid import UUID
from datetime import datetime
from typing import Optional


class DepartmentCreate(BaseModel):
    name: str
    description: Optional[str] = None
    head_id: Optional[UUID] = None


class DepartmentUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    head_id: Optional[UUID] = None


class DepartmentResponse(BaseModel):
    id: UUID
    name: str
    description: Optional[str]
    company_id: UUID
    head_id: Optional[UUID]
    created_at: datetime

    model_config = {"from_attributes": True}
