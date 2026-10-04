import uuid
from sqlalchemy import Column, String, Text, Boolean, Integer, JSON, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base
from app.models.base import TimestampMixin


class Funnel(Base, TimestampMixin):
    __tablename__ = "funnels"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(
        UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    name = Column(String(255), nullable=False)
    entity_type = Column(String(50), nullable=False)

    stages = relationship("FunnelStage", back_populates="funnel", cascade="all, delete-orphan")
    statuses = relationship("Status", back_populates="funnel")


class Status(Base, TimestampMixin):
    __tablename__ = "statuses"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(
        UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    funnel_id = Column(
        UUID(as_uuid=True), ForeignKey("funnels.id", ondelete="SET NULL"), nullable=True
    )
    name = Column(String(255), nullable=False)
    color = Column(String(20), nullable=True, default="#6366f1")
    order_index = Column(Integer, default=0, nullable=False)
    is_final = Column(Boolean, default=False, nullable=False)
    is_positive = Column(Boolean, nullable=True)

    funnel = relationship("Funnel", back_populates="statuses")


class CustomSection(Base, TimestampMixin):
    __tablename__ = "custom_sections"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(
        UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    name = Column(String(255), nullable=False)
    slug = Column(String(100), nullable=False)
    icon = Column(String(50), nullable=True)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    order_index = Column(Integer, default=0, nullable=False)
    allowed_roles = Column(JSON, nullable=True)

    fields = relationship("CustomField", back_populates="section")
    records = relationship("CustomSectionRecord", back_populates="section", cascade="all, delete-orphan")


class CustomField(Base, TimestampMixin):
    __tablename__ = "custom_fields"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(
        UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    name = Column(String(255), nullable=False)
    # string/text/number/date/list/multi_list/checkbox/file/link/email/phone/status/user
    field_type = Column(String(50), nullable=False)
    # employee/vacancy/candidate/response/lesson/test/custom_section
    entity_type = Column(String(50), nullable=False)
    section_id = Column(
        UUID(as_uuid=True), ForeignKey("custom_sections.id", ondelete="SET NULL"), nullable=True
    )
    options = Column(JSON, nullable=True)
    is_required = Column(Boolean, default=False, nullable=False)
    order_index = Column(Integer, default=0, nullable=False)

    section = relationship("CustomSection", back_populates="fields")


class CustomSectionRecord(Base, TimestampMixin):
    __tablename__ = "custom_section_records"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    section_id = Column(
        UUID(as_uuid=True), ForeignKey("custom_sections.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    company_id = Column(
        UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    title = Column(String(500), nullable=False)
    data = Column(JSON, nullable=True)
    status_id = Column(
        UUID(as_uuid=True), ForeignKey("statuses.id", ondelete="SET NULL"), nullable=True
    )
    created_by = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    section = relationship("CustomSection", back_populates="records")


class FunnelStage(Base, TimestampMixin):
    __tablename__ = "funnel_stages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    funnel_id = Column(
        UUID(as_uuid=True), ForeignKey("funnels.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    name = Column(String(255), nullable=False)
    order_index = Column(Integer, default=0, nullable=False)
    status_id = Column(
        UUID(as_uuid=True), ForeignKey("statuses.id", ondelete="SET NULL"), nullable=True
    )

    funnel = relationship("Funnel", back_populates="stages")
