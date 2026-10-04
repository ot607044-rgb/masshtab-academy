from pydantic import BaseModel, StringConstraints, field_validator
from uuid import UUID
from datetime import datetime
from typing import Annotated, Optional

DepartmentName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=255)]


class DepartmentCreate(BaseModel):
    name: DepartmentName
    description: Optional[str] = None
    head_id: Optional[UUID] = None
    parent_id: Optional[UUID] = None


class DepartmentUpdate(BaseModel):
    name: Optional[DepartmentName] = None
    description: Optional[str] = None
    head_id: Optional[UUID] = None
    parent_id: Optional[UUID] = None

    @field_validator("name")
    @classmethod
    def name_cannot_be_null(cls, value):
        if value is None:
            raise ValueError("Название отдела обязательно")
        return value


class DepartmentResponse(BaseModel):
    id: UUID
    name: str
    description: Optional[str]
    company_id: UUID
    head_id: Optional[UUID]
    parent_id: Optional[UUID] = None
    created_at: datetime

    model_config = {"from_attributes": True}
