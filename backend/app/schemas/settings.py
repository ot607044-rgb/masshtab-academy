from pydantic import BaseModel
from uuid import UUID
from datetime import datetime
from typing import Optional, List, Any


# ── Funnel ────────────────────────────────────────────────────────────────────

class FunnelCreate(BaseModel):
    name: str
    entity_type: str


class FunnelUpdate(BaseModel):
    name: Optional[str] = None
    entity_type: Optional[str] = None


class FunnelResponse(BaseModel):
    id: UUID
    company_id: UUID
    name: str
    entity_type: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── FunnelStage ───────────────────────────────────────────────────────────────

class FunnelStageCreate(BaseModel):
    name: str
    order_index: int = 0
    status_id: Optional[UUID] = None


class FunnelStageUpdate(BaseModel):
    name: Optional[str] = None
    order_index: Optional[int] = None
    status_id: Optional[UUID] = None


class FunnelStageResponse(BaseModel):
    id: UUID
    funnel_id: UUID
    name: str
    order_index: int
    status_id: Optional[UUID]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── Status ────────────────────────────────────────────────────────────────────

class StatusCreate(BaseModel):
    name: str
    funnel_id: Optional[UUID] = None
    color: Optional[str] = "#6366f1"
    order_index: int = 0
    is_final: bool = False
    is_positive: Optional[bool] = None


class StatusUpdate(BaseModel):
    name: Optional[str] = None
    funnel_id: Optional[UUID] = None
    color: Optional[str] = None
    order_index: Optional[int] = None
    is_final: Optional[bool] = None
    is_positive: Optional[bool] = None


class StatusResponse(BaseModel):
    id: UUID
    company_id: UUID
    funnel_id: Optional[UUID]
    name: str
    color: Optional[str]
    order_index: int
    is_final: bool
    is_positive: Optional[bool]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── CustomSection ─────────────────────────────────────────────────────────────

class CustomSectionCreate(BaseModel):
    name: str
    slug: str
    icon: Optional[str] = None
    description: Optional[str] = None
    is_active: bool = True
    order_index: int = 0
    allowed_roles: Optional[List[str]] = None


class CustomSectionUpdate(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    icon: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None
    order_index: Optional[int] = None
    allowed_roles: Optional[List[str]] = None


class CustomSectionResponse(BaseModel):
    id: UUID
    company_id: UUID
    name: str
    slug: str
    icon: Optional[str]
    description: Optional[str]
    is_active: bool
    order_index: int
    allowed_roles: Optional[List[str]]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── CustomField ───────────────────────────────────────────────────────────────

class CustomFieldCreate(BaseModel):
    name: str
    field_type: str
    entity_type: str
    section_id: Optional[UUID] = None
    options: Optional[Any] = None
    is_required: bool = False
    order_index: int = 0


class CustomFieldUpdate(BaseModel):
    name: Optional[str] = None
    field_type: Optional[str] = None
    entity_type: Optional[str] = None
    section_id: Optional[UUID] = None
    options: Optional[Any] = None
    is_required: Optional[bool] = None
    order_index: Optional[int] = None


class CustomFieldResponse(BaseModel):
    id: UUID
    company_id: UUID
    name: str
    field_type: str
    entity_type: str
    section_id: Optional[UUID]
    options: Optional[Any]
    is_required: bool
    order_index: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── CustomSectionRecord ───────────────────────────────────────────────────────

class CustomSectionRecordCreate(BaseModel):
    title: str
    data: Optional[Any] = None
    status_id: Optional[UUID] = None


class CustomSectionRecordUpdate(BaseModel):
    title: Optional[str] = None
    data: Optional[Any] = None
    status_id: Optional[UUID] = None


class CustomSectionRecordResponse(BaseModel):
    id: UUID
    section_id: UUID
    company_id: UUID
    title: str
    data: Optional[Any]
    status_id: Optional[UUID]
    created_by: Optional[UUID]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
