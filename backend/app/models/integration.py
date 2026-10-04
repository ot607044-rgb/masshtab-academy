import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime, JSON, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base
from app.models.base import TimestampMixin


class Integration(Base, TimestampMixin):
    __tablename__ = "integrations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(
        UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    provider = Column(String(50), nullable=False)
    access_token = Column(Text, nullable=True)
    refresh_token = Column(Text, nullable=True)
    expires_at = Column(DateTime, nullable=True)
    status = Column(String(20), default="inactive", nullable=False)
    settings_data = Column(JSON, nullable=True)

    vacancies = relationship("ExternalVacancy", back_populates="integration", cascade="all, delete-orphan")
    candidates = relationship("ExternalCandidate", back_populates="integration", cascade="all, delete-orphan")
    responses = relationship("ExternalResponse", back_populates="integration", cascade="all, delete-orphan")
    logs = relationship("IntegrationLog", back_populates="integration", cascade="all, delete-orphan")


class ExternalVacancy(Base, TimestampMixin):
    __tablename__ = "external_vacancies"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    integration_id = Column(
        UUID(as_uuid=True), ForeignKey("integrations.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    company_id = Column(
        UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    external_id = Column(String(255), nullable=False)
    title = Column(String(500), nullable=False)
    data = Column(JSON, nullable=True)
    synced_at = Column(DateTime, nullable=True)

    integration = relationship("Integration", back_populates="vacancies")


class ExternalCandidate(Base, TimestampMixin):
    __tablename__ = "external_candidates"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    integration_id = Column(
        UUID(as_uuid=True), ForeignKey("integrations.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    company_id = Column(
        UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    external_id = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    data = Column(JSON, nullable=True)
    synced_at = Column(DateTime, nullable=True)

    integration = relationship("Integration", back_populates="candidates")


class ExternalResponse(Base, TimestampMixin):
    __tablename__ = "external_responses"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    integration_id = Column(
        UUID(as_uuid=True), ForeignKey("integrations.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    company_id = Column(
        UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    external_id = Column(String(255), nullable=False)
    vacancy_id = Column(
        UUID(as_uuid=True), ForeignKey("external_vacancies.id", ondelete="SET NULL"), nullable=True
    )
    candidate_id = Column(
        UUID(as_uuid=True), ForeignKey("external_candidates.id", ondelete="SET NULL"), nullable=True
    )
    status = Column(String(50), nullable=True)
    data = Column(JSON, nullable=True)
    synced_at = Column(DateTime, nullable=True)

    integration = relationship("Integration", back_populates="responses")


class IntegrationLog(Base):
    __tablename__ = "integration_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    integration_id = Column(
        UUID(as_uuid=True), ForeignKey("integrations.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    company_id = Column(
        UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    action = Column(String(100), nullable=False)
    status = Column(String(20), nullable=False)
    message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    integration = relationship("Integration", back_populates="logs")
