import uuid
from sqlalchemy import Column, String, Text, Integer, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base


class SupportAccessRequest(Base):
    __tablename__ = "support_access_requests"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    super_admin_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    reason = Column(Text, nullable=False)
    # pending | approved | rejected | revoked
    status = Column(String(20), nullable=False, default="pending")
    duration_hours = Column(Integer, nullable=False, default=8)
    requested_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    approved_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    revoked_at = Column(DateTime(timezone=True), nullable=True)
    revoked_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    reject_reason = Column(Text, nullable=True)

    super_admin = relationship("User", foreign_keys=[super_admin_id])
    approved_by = relationship("User", foreign_keys=[approved_by_id])
    revoked_by = relationship("User", foreign_keys=[revoked_by_id])
    company = relationship("Company")
    logs = relationship("SupportAccessLog", back_populates="session", cascade="all, delete-orphan")


class SupportAccessLog(Base):
    __tablename__ = "support_access_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(
        UUID(as_uuid=True),
        ForeignKey("support_access_requests.id", ondelete="CASCADE"),
        nullable=False,
    )
    # Denormalized for fast queries
    super_admin_id = Column(UUID(as_uuid=True), nullable=False)
    company_id = Column(UUID(as_uuid=True), nullable=False)
    endpoint = Column(String(500), nullable=True)
    method = Column(String(10), nullable=True)
    accessed_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    session = relationship("SupportAccessRequest", back_populates="logs")
