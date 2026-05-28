from pydantic import BaseModel, EmailStr
from uuid import UUID
from datetime import date, datetime
from typing import Optional, List, Any
from app.models.employee import EmployeeStatus


class EmployeeCreate(BaseModel):
    full_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    department_id: Optional[UUID] = None
    position_id: Optional[UUID] = None
    manager_id: Optional[UUID] = None
    user_id: Optional[UUID] = None
    status: EmployeeStatus = EmployeeStatus.ACTIVE
    hire_date: Optional[date] = None
    weak_areas: Optional[List[str]] = None


class EmployeeUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    department_id: Optional[UUID] = None
    position_id: Optional[UUID] = None
    manager_id: Optional[UUID] = None
    user_id: Optional[UUID] = None
    status: Optional[EmployeeStatus] = None
    hire_date: Optional[date] = None
    weak_areas: Optional[List[str]] = None
    learning_history: Optional[List[Any]] = None
    test_results: Optional[dict] = None


class EmployeeResponse(BaseModel):
    id: UUID
    full_name: str
    email: Optional[str]
    phone: Optional[str]
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
