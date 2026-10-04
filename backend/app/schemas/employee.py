from pydantic import BaseModel, StringConstraints, field_validator
from uuid import UUID
from datetime import date, datetime
from typing import Annotated, Optional, List, Any
from app.models.employee import EmployeeStatus

EmployeeName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=255)]
EmployeeEmail = Annotated[str, StringConstraints(strip_whitespace=True, max_length=255)]
EmployeePhone = Annotated[str, StringConstraints(strip_whitespace=True, max_length=50)]


class EmployeeCreate(BaseModel):
    full_name: EmployeeName
    email: Optional[EmployeeEmail] = None
    phone: Optional[EmployeePhone] = None
    department_id: Optional[UUID] = None
    position_id: Optional[UUID] = None
    manager_id: Optional[UUID] = None
    status: EmployeeStatus = EmployeeStatus.ACTIVE
    hire_date: Optional[date] = None
    weak_areas: Optional[List[str]] = None


class EmployeeUpdate(BaseModel):
    full_name: Optional[EmployeeName] = None
    email: Optional[EmployeeEmail] = None
    phone: Optional[EmployeePhone] = None
    department_id: Optional[UUID] = None
    position_id: Optional[UUID] = None
    manager_id: Optional[UUID] = None
    status: Optional[EmployeeStatus] = None
    hire_date: Optional[date] = None
    weak_areas: Optional[List[str]] = None
    learning_history: Optional[List[Any]] = None
    test_results: Optional[dict] = None

    @field_validator("full_name", "status")
    @classmethod
    def required_fields_cannot_be_null(cls, value):
        if value is None:
            raise ValueError("ФИО и статус обязательны")
        return value


class EmployeeResponse(BaseModel):
    id: UUID
    full_name: str
    email: Optional[str]
    phone: Optional[str]
    photo_url: Optional[str] = None
    company_id: UUID
    department_id: Optional[UUID]
    position_id: Optional[UUID]
    manager_id: Optional[UUID]
    user_id: Optional[UUID]
    status: EmployeeStatus
    hire_date: Optional[date]
    weak_areas: Optional[List[str]]
    learning_history: Optional[List[Any]]
    test_results: Optional[dict]
    created_at: datetime

    model_config = {"from_attributes": True}
