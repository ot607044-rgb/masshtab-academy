from pydantic import BaseModel, StringConstraints, field_validator
from uuid import UUID
from datetime import datetime
from typing import Annotated, Optional, List

PositionName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=255)]


class PositionCreate(BaseModel):
    name: PositionName
    description: Optional[str] = None
    department_id: Optional[UUID] = None
    required_skills: Optional[List[str]] = None


class PositionUpdate(BaseModel):
    name: Optional[PositionName] = None
    description: Optional[str] = None
    department_id: Optional[UUID] = None
    required_skills: Optional[List[str]] = None

    @field_validator("name")
    @classmethod
    def name_cannot_be_null(cls, value):
        if value is None:
            raise ValueError("Название должности обязательно")
        return value


class PositionResponse(BaseModel):
    id: UUID
    name: str
    description: Optional[str]
    company_id: UUID
    department_id: Optional[UUID]
    required_skills: Optional[List[str]]
    created_at: datetime

    model_config = {"from_attributes": True}
