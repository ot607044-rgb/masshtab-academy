from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import AwareDatetime, BaseModel, ConfigDict, EmailStr, Field, HttpUrl

VacancyStatus = Literal["request", "open", "paused", "closed"]
CandidateStage = Literal["new", "review", "interview", "testing", "offer", "rejected"]
MeetingType = Literal["interview", "work", "planning", "other"]


class VacancyCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")
    title: str = Field(min_length=1, max_length=300)
    description: str | None = Field(default=None, max_length=10000)
    position_id: UUID | None = None
    department_id: UUID | None = None
    status: VacancyStatus = "open"


class VacancyPatch(BaseModel):
    status: VacancyStatus


class CandidateCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")
    full_name: str = Field(min_length=1, max_length=255)
    vacancy_id: UUID | None = None
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=50)
    source: str = Field(default="manual", min_length=1, max_length=100)
    notes: str | None = Field(default=None, max_length=10000)


class CandidatePatch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    stage: CandidateStage | None = None
    notes: str | None = Field(default=None, max_length=10000)


class InterviewCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")
    candidate_id: UUID | None = None
    meeting_type: MeetingType = "interview"
    title: str = Field(min_length=1, max_length=300)
    starts_at: AwareDatetime
    duration_minutes: int = Field(default=30, ge=5, le=480)
    participant_ids: list[UUID] = Field(default_factory=list, max_length=50)
    meeting_url: HttpUrl | None = None
    notes: str | None = Field(default=None, max_length=10000)
    external_name: str | None = Field(default=None, max_length=255)
    external_contact: str | None = Field(default=None, max_length=255)


class InterviewPatch(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")
    candidate_id: UUID | None = None
    meeting_type: MeetingType | None = None
    title: str | None = Field(default=None, min_length=1, max_length=300)
    starts_at: AwareDatetime | None = None
    duration_minutes: int | None = Field(default=None, ge=5, le=480)
    participant_ids: list[UUID] | None = Field(default=None, max_length=50)
    meeting_url: HttpUrl | None = None
    notes: str | None = Field(default=None, max_length=10000)
    external_name: str | None = Field(default=None, max_length=255)
    external_contact: str | None = Field(default=None, max_length=255)


class AvailabilityRuleIn(BaseModel):
    weekday: int = Field(ge=0, le=6)
    start_minute: int = Field(ge=0, le=1439)
    end_minute: int = Field(ge=1, le=1440)
    slot_minutes: int = Field(default=30, ge=5, le=240)


class AvailabilityRulesUpdate(BaseModel):
    rules: list[AvailabilityRuleIn] = Field(default_factory=list, max_length=28)


class CalendarBlockCreate(BaseModel):
    starts_at: AwareDatetime
    duration_minutes: int = Field(default=30, ge=5, le=480)
    title: str | None = Field(default=None, max_length=300)


class PublicBookingCreate(BaseModel):
    starts_at: AwareDatetime
    duration_minutes: int = Field(default=30, ge=5, le=240)
    visitor_name: str = Field(min_length=1, max_length=255)
    visitor_contact: str = Field(min_length=1, max_length=255)
    notes: str | None = Field(default=None, max_length=10000)


class HireRequest(BaseModel):
    hire_date: date
