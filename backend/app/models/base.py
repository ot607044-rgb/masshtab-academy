from datetime import datetime, timezone
from sqlalchemy import Column, DateTime


def utc_now():
    # Existing database columns store UTC without a timezone offset.
    return datetime.now(timezone.utc).replace(tzinfo=None)


class TimestampMixin:
    created_at = Column(DateTime, default=utc_now, nullable=False)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now, nullable=False)
