from pydantic import BaseModel
from uuid import UUID
from datetime import datetime
from typing import Optional, List


class NotificationResponse(BaseModel):
    id: UUID
    user_id: UUID
    company_id: UUID
    type: str
    title: str
    message: str
    entity_id: Optional[UUID] = None
    is_read: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class NotificationCreate(BaseModel):
    user_id: UUID
    company_id: UUID
    type: str
    title: str
    message: str
    entity_id: Optional[UUID] = None


class NotificationUnreadCount(BaseModel):
    count: int
