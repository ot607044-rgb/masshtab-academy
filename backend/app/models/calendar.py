"""Calendar preferences and transactional changes for future sync adapters."""
import uuid
from sqlalchemy import Column, DateTime, ForeignKey, Integer, JSON, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base
from app.models.base import TimestampMixin


class CalendarSettings(Base, TimestampMixin):
    __tablename__ = "calendar_settings"
    __table_args__ = (UniqueConstraint("company_id", "user_id"),)
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    timezone = Column(String(64), nullable=False, default="UTC")
    buffer_minutes = Column(Integer, nullable=False, default=0)


class CalendarChange(Base):
    __tablename__ = "calendar_changes"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    # No foreign key: cancellation events survive deletion of the meeting.
    meeting_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    kind = Column(String(20), nullable=False)
    payload = Column(JSON, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False)
    processed_at = Column(DateTime(timezone=True), nullable=True, index=True)
