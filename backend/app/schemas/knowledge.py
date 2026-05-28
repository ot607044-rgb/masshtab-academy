from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime
from typing import Optional, List
from app.models.knowledge import DifficultyLevel, Criticality


class KnowledgeTopicCreate(BaseModel):
    name: str
    description: Optional[str] = None
    difficulty_level: DifficultyLevel = DifficultyLevel.BASIC
    criticality: Criticality = Criticality.MEDIUM
    required_knowledge_level: int = Field(default=1, ge=1, le=5)
    related_lessons: Optional[List[str]] = None
    related_tests: Optional[List[str]] = None


class KnowledgeTopicUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    difficulty_level: Optional[DifficultyLevel] = None
    criticality: Optional[Criticality] = None
    required_knowledge_level: Optional[int] = Field(default=None, ge=1, le=5)
    related_lessons: Optional[List[str]] = None
    related_tests: Optional[List[str]] = None


class KnowledgeTopicResponse(BaseModel):
    id: UUID
    name: str
    description: Optional[str]
    company_id: UUID
    difficulty_level: DifficultyLevel
    criticality: Criticality
    required_knowledge_level: int
    related_lessons: Optional[List[str]]
    related_tests: Optional[List[str]]
    created_at: datetime

    model_config = {"from_attributes": True}


class PositionTopicCreate(BaseModel):
    position_id: UUID
    topic_id: UUID
    is_required: bool = True


class PositionTopicResponse(BaseModel):
    id: UUID
    position_id: UUID
    topic_id: UUID
    company_id: UUID
    is_required: bool
    topic: KnowledgeTopicResponse

    model_config = {"from_attributes": True}
