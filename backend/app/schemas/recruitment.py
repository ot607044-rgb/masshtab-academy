from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import AwareDatetime, BaseModel, ConfigDict, EmailStr, Field, HttpUrl, model_validator
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

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

    @model_validator(mode="after")
    def required_fields_cannot_be_null(self):
        for field in ("title", "starts_at", "duration_minutes", "participant_ids", "meeting_type"):
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ValueError(f"{field} cannot be null")
        return self


class AvailabilityRuleIn(BaseModel):
    weekday: int = Field(ge=0, le=6)
    start_minute: int = Field(ge=0, le=1439)
    end_minute: int = Field(ge=1, le=1440)
    slot_minutes: int = Field(default=30, ge=5, le=240)


class AvailabilityRulesUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    rules: list[AvailabilityRuleIn] = Field(default_factory=list, max_length=28)
    timezone: str = Field(default="UTC", min_length=1, max_length=64)
    buffer_minutes: int = Field(default=0, ge=0, le=120)

    @model_validator(mode="after")
    def valid_schedule(self):
        try:
            ZoneInfo(self.timezone)
        except (ZoneInfoNotFoundError, ValueError):
            raise ValueError("Unknown IANA time zone")
        ordered = sorted(self.rules, key=lambda r: (r.weekday, r.start_minute))
        for index, rule in enumerate(ordered):
            if rule.end_minute <= rule.start_minute:
                raise ValueError("Window end must follow its start")
            if index and ordered[index - 1].weekday == rule.weekday and ordered[index - 1].end_minute > rule.start_minute:
                raise ValueError("Working windows must not overlap")
        return self


class CalendarBlockCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")
    starts_at: AwareDatetime
    duration_minutes: int = Field(default=30, ge=5, le=44640)
    title: str | None = Field(default=None, max_length=300)


class PublicBookingCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")
    starts_at: AwareDatetime
    duration_minutes: int = Field(default=30, ge=5, le=240)
    visitor_name: str = Field(min_length=1, max_length=255)
    visitor_contact: str = Field(min_length=1, max_length=255)
    notes: str | None = Field(default=None, max_length=10000)


class PublicLinkUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    enabled: bool


class HireRequest(BaseModel):
    hire_date: date
