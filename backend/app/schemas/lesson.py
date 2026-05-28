from pydantic import BaseModel, HttpUrl
from uuid import UUID
from datetime import datetime
from typing import Optional, List, Any
from app.models.lesson import LessonStatus, MaterialType, AssignmentStatus


# ── Lesson ────────────────────────────────────────────────────────────────────

class ExternalLink(BaseModel):
    title: str
    url: str


class LessonCreate(BaseModel):
    title: str
    description: Optional[str] = None
    text_content: Optional[str] = None
    position_id: Optional[UUID] = None
    topic_id: Optional[UUID] = None
    difficulty_level: Optional[str] = "basic"
    duration_minutes: Optional[int] = None
    video_url: Optional[str] = None
    external_links: Optional[List[ExternalLink]] = None


class LessonUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    text_content: Optional[str] = None
    position_id: Optional[UUID] = None
    topic_id: Optional[UUID] = None
    difficulty_level: Optional[str] = None
    duration_minutes: Optional[int] = None
    video_url: Optional[str] = None
    external_links: Optional[List[ExternalLink]] = None
    status: Optional[LessonStatus] = None


class LessonResponse(BaseModel):
    id: UUID
    title: str
    description: Optional[str]
    company_id: UUID
    position_id: Optional[UUID]
    topic_id: Optional[UUID]
    author_id: Optional[UUID]
    difficulty_level: Optional[str]
    duration_minutes: Optional[int]
    video_url: Optional[str]
    status: LessonStatus
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class LessonMaterialResponse(BaseModel):
    id: UUID
    lesson_id: UUID
    title: str
    material_type: MaterialType
    url: Optional[str]
    file_name: Optional[str]
    file_size: Optional[int]
    created_at: datetime

    model_config = {"from_attributes": True}


class LessonDetailResponse(LessonResponse):
    text_content: Optional[str]
    external_links: Optional[List[Any]]
    materials: List[LessonMaterialResponse] = []


# ── Material add via link ─────────────────────────────────────────────────────

class MaterialLinkCreate(BaseModel):
    title: str
    material_type: MaterialType
    url: str


# ── Assignment ────────────────────────────────────────────────────────────────

class AssignmentCreate(BaseModel):
    lesson_id: UUID
    employee_id: UUID
    due_date: Optional[str] = None


class AssignmentStatusUpdate(BaseModel):
    status: AssignmentStatus
    completed_at: Optional[str] = None


class AssignmentResponse(BaseModel):
    id: UUID
    lesson_id: UUID
    employee_id: UUID
    company_id: UUID
    assigned_by: Optional[UUID]
    status: AssignmentStatus
    due_date: Optional[str]
    completed_at: Optional[str]
    lesson: LessonResponse
    created_at: datetime

    model_config = {"from_attributes": True}


class AssignmentWithEmployeeResponse(AssignmentResponse):
    employee_name: str = ""
