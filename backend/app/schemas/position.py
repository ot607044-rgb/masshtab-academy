from pydantic import BaseModel
from uuid import UUID
from datetime import datetime
from typing import Optional, List


class PositionCreate(BaseModel):
    name: str
    description: Optional[str] = None
    department_id: Optional[UUID] = None
    required_skills: Optional[List[str]] = None


class PositionUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    department_id: Optional[UUID] = None
    required_skills: Optional[List[str]] = None


class PositionResponse(BaseModel):
    id: UUID
    name: str
    description: Optional[str]
    company_id: UUID
    department_id: Optional[UUID]
    required_skills: Optional[List[str]]
    created_at: datetime

    model_config = {"from_attributes": True}
