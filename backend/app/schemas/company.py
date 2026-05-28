from pydantic import BaseModel, field_validator
from uuid import UUID
from datetime import datetime
from typing import Optional
import re


class CompanyCreate(BaseModel):
    name: str
    slug: str
    description: Optional[str] = None

    @field_validator("slug")
    @classmethod
    def slug_must_be_valid(cls, v: str) -> str:
        if not re.match(r"^[a-z0-9-]+$", v):
            raise ValueError("Slug must contain only lowercase letters, digits, and hyphens")
        return v


class CompanyResponse(BaseModel):
    id: UUID
    name: str
    slug: str
    description: Optional[str]
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class CompanyWithAdminCreate(BaseModel):
    company: CompanyCreate
    admin_email: str
    admin_password: str
    admin_full_name: str
