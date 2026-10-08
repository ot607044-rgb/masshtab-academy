from pydantic import BaseModel, Field, StringConstraints, field_validator
from uuid import UUID
from datetime import datetime
from typing import Annotated, Literal, Optional

DepartmentName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=255)]
DescriptionFont = Literal["sans", "serif", "mono"]
DescriptionSize = Annotated[int, Field(ge=11, le=20)]


class DepartmentCreate(BaseModel):
    name: DepartmentName
    description: Optional[str] = None
    description_font: Optional[DescriptionFont] = None
    description_size: Optional[DescriptionSize] = None
    head_id: Optional[UUID] = None
    parent_id: Optional[UUID] = None


class DepartmentUpdate(BaseModel):
    name: Optional[DepartmentName] = None
    description: Optional[str] = None
    description_font: Optional[DescriptionFont] = None
    description_size: Optional[DescriptionSize] = None
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
    description_font: Optional[str] = None
    description_size: Optional[int] = None
    company_id: UUID
    head_id: Optional[UUID]
    parent_id: Optional[UUID] = None
    created_at: datetime

    model_config = {"from_attributes": True}
