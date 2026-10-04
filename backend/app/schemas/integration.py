from pydantic import BaseModel
from uuid import UUID
from datetime import datetime
from typing import Optional, Any


class IntegrationCreate(BaseModel):
    provider: str
    access_token: Optional[str] = None
    refresh_token: Optional[str] = None
    expires_at: Optional[datetime] = None
    status: str = "inactive"
    settings_data: Optional[Any] = None


class IntegrationUpdate(BaseModel):
    provider: Optional[str] = None
    access_token: Optional[str] = None
    refresh_token: Optional[str] = None
    expires_at: Optional[datetime] = None
    status: Optional[str] = None
    settings_data: Optional[Any] = None


class IntegrationResponse(BaseModel):
    id: UUID
    company_id: UUID
    provider: str
    expires_at: Optional[datetime]
    status: str
    settings_data: Optional[Any]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class IntegrationLogResponse(BaseModel):
    id: UUID
    integration_id: UUID
    company_id: UUID
    action: str
    status: str
    message: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}
