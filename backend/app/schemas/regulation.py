from datetime import datetime
from typing import Annotated, List, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field, StringConstraints

RegulationName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=255)]
DutyText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=2000)]
RegulationStatus = Literal["active", "draft"]


class RegulationCreate(BaseModel):
    position_id: UUID
    name: RegulationName
    summary: Optional[Annotated[str, StringConstraints(strip_whitespace=True, max_length=255)]] = None
    status: RegulationStatus = "active"
    goal: Optional[Annotated[str, StringConstraints(max_length=5000)]] = None
    duties: List[DutyText] = Field(default_factory=list, max_length=200)


class RegulationUpdate(BaseModel):
    name: Optional[RegulationName] = None
    summary: Optional[Annotated[str, StringConstraints(strip_whitespace=True, max_length=255)]] = None
    status: Optional[RegulationStatus] = None
    goal: Optional[Annotated[str, StringConstraints(max_length=5000)]] = None
    duties: Optional[List[DutyText]] = Field(default=None, max_length=200)


class RegulationResponse(BaseModel):
    id: UUID
    company_id: UUID
    position_id: UUID
    name: str
    summary: Optional[str]
    status: str
    goal: Optional[str]
    duties: List[str]
    updated_by_name: Optional[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AssignmentCreate(BaseModel):
    employee_id: UUID
    regulation_id: UUID
    require_ack: bool = True


class AssignmentResponse(BaseModel):
    id: UUID
    employee_id: UUID
    regulation_id: UUID
    require_ack: bool
    acknowledged_at: Optional[datetime]
    assigned_at: datetime
    notified: bool = False

    model_config = {"from_attributes": True}


class MyRegulationResponse(BaseModel):
    assignment: AssignmentResponse
    regulation: RegulationResponse
    position_name: Optional[str]
