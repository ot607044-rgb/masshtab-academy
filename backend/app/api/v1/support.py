import uuid
from datetime import datetime, timezone, timedelta
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.schemas.support import (
    SupportRequestCreate, SupportRequestApprove, SupportRequestReject,
    SupportRequestResponse, SupportAccessLogResponse,
)
from app.models.support import SupportAccessRequest, SupportAccessLog
from app.models.company import Company
from app.models.user import UserRole
from app.api.deps import get_super_admin, get_company_admin_or_above, get_current_user

router = APIRouter()


def _to_response(req: SupportAccessRequest) -> SupportRequestResponse:
    return SupportRequestResponse(
        id=req.id,
        super_admin_id=req.super_admin_id,
        company_id=req.company_id,
        reason=req.reason,
        status=req.status,
        duration_hours=req.duration_hours,
        requested_at=req.requested_at,
        approved_at=req.approved_at,
        approved_by_id=req.approved_by_id,
        expires_at=req.expires_at,
        revoked_at=req.revoked_at,
        revoked_by_id=req.revoked_by_id,
        reject_reason=req.reject_reason,
        super_admin_name=req.super_admin.full_name if req.super_admin else None,
        company_name=req.company.name if req.company else None,
        logs_count=len(req.logs) if req.logs else 0,
    )


def _load_q():
    return (
        select(SupportAccessRequest)
        .options(
            selectinload(SupportAccessRequest.super_admin),
            selectinload(SupportAccessRequest.company),
            selectinload(SupportAccessRequest.logs),
        )
    )


def _is_expired(req: SupportAccessRequest) -> bool:
    if not req.expires_at:
        return False
    exp = req.expires_at
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    return exp < datetime.now(timezone.utc)


# ── Super Admin: request access ───────────────────────────────────────────────

@router.post("/request", response_model=SupportRequestResponse, status_code=201)
async def create_support_request(
    data: SupportRequestCreate,
    current_user=Depends(get_super_admin),
    db: AsyncSession = Depends(get_db),
):
    company_r = await db.execute(select(Company).where(Company.id == data.company_id))
    if not company_r.scalar_one_or_none():
        raise HTTPException(404, "Компания не найдена")

    dup = await db.execute(
        select(SupportAccessRequest).where(
            SupportAccessRequest.super_admin_id == current_user.id,
            SupportAccessRequest.company_id == data.company_id,
            SupportAccessRequest.status.in_(["pending", "approved"]),
        )
    )
    if dup.scalar_one_or_none():
        raise HTTPException(400, "Уже есть активный или ожидающий запрос для этой компании")

    req = SupportAccessRequest(
        id=uuid.uuid4(),
        super_admin_id=current_user.id,
        company_id=data.company_id,
        reason=data.reason,
        status="pending",
        duration_hours=data.duration_hours,
    )
    db.add(req)
    await db.commit()

    loaded = await db.execute(_load_q().where(SupportAccessRequest.id == req.id))
    return _to_response(loaded.scalar_one())


# ── Super Admin: list own requests ────────────────────────────────────────────

@router.get("/my-requests", response_model=List[SupportRequestResponse])
async def list_my_requests(
    current_user=Depends(get_super_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        _load_q()
        .where(SupportAccessRequest.super_admin_id == current_user.id)
        .order_by(SupportAccessRequest.requested_at.desc())
    )
    requests = result.scalars().all()

    # Auto-mark expired approved sessions
    for req in requests:
        if req.status == "approved" and _is_expired(req):
            req.status = "revoked"
            req.revoked_at = datetime.now(timezone.utc)
    await db.commit()

    # Re-fetch to get updated state
    result = await db.execute(
        _load_q()
        .where(SupportAccessRequest.super_admin_id == current_user.id)
        .order_by(SupportAccessRequest.requested_at.desc())
    )
    return [_to_response(r) for r in result.scalars().all()]


# ── Super Admin: revoke own session ──────────────────────────────────────────

@router.post("/sessions/{session_id}/revoke", response_model=SupportRequestResponse)
async def revoke_session(
    session_id: uuid.UUID,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    loaded = await db.execute(_load_q().where(SupportAccessRequest.id == session_id))
    req = loaded.scalar_one_or_none()
    if not req:
        raise HTTPException(404, "Запрос не найден")

    # Super admin can revoke their own; company admin can revoke requests for their company
    if current_user.role == UserRole.SUPER_ADMIN:
        if req.super_admin_id != current_user.id:
            raise HTTPException(403, "Доступ запрещён")
    elif current_user.role == UserRole.COMPANY_ADMIN:
        if req.company_id != current_user.company_id:
            raise HTTPException(403, "Доступ запрещён")
    else:
        raise HTTPException(403, "Доступ запрещён")

    if req.status not in ("pending", "approved"):
        raise HTTPException(400, f"Нельзя отозвать запрос со статусом «{req.status}»")

    req.status = "revoked"
    req.revoked_at = datetime.now(timezone.utc)
    req.revoked_by_id = current_user.id
    await db.commit()

    reloaded = await db.execute(_load_q().where(SupportAccessRequest.id == session_id))
    return _to_response(reloaded.scalar_one())


# ── Company Admin: list pending requests ─────────────────────────────────────

@router.get("/pending", response_model=List[SupportRequestResponse])
async def list_pending_requests(
    current_user=Depends(get_company_admin_or_above),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role == UserRole.SUPER_ADMIN:
        raise HTTPException(403, "Используйте /my-requests для своих запросов")

    result = await db.execute(
        _load_q()
        .where(
            SupportAccessRequest.company_id == current_user.company_id,
            SupportAccessRequest.status == "pending",
        )
        .order_by(SupportAccessRequest.requested_at.asc())
    )
    return [_to_response(r) for r in result.scalars().all()]


# ── Company Admin: full history ───────────────────────────────────────────────

@router.get("/history", response_model=List[SupportRequestResponse])
async def list_support_history(
    current_user=Depends(get_company_admin_or_above),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role == UserRole.SUPER_ADMIN:
        raise HTTPException(403, "Доступ запрещён")

    result = await db.execute(
        _load_q()
        .where(SupportAccessRequest.company_id == current_user.company_id)
        .order_by(SupportAccessRequest.requested_at.desc())
    )
    return [_to_response(r) for r in result.scalars().all()]


# ── Company Admin: approve request ────────────────────────────────────────────

@router.post("/sessions/{session_id}/approve", response_model=SupportRequestResponse)
async def approve_request(
    session_id: uuid.UUID,
    data: SupportRequestApprove,
    current_user=Depends(get_company_admin_or_above),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role == UserRole.SUPER_ADMIN:
        raise HTTPException(403, "Только администратор компании может одобрять запросы")

    loaded = await db.execute(_load_q().where(SupportAccessRequest.id == session_id))
    req = loaded.scalar_one_or_none()
    if not req:
        raise HTTPException(404, "Запрос не найден")
    if req.company_id != current_user.company_id:
        raise HTTPException(403, "Доступ запрещён")
    if req.status != "pending":
        raise HTTPException(400, f"Запрос уже имеет статус «{req.status}»")

    now = datetime.now(timezone.utc)
    req.status = "approved"
    req.approved_at = now
    req.approved_by_id = current_user.id
    req.duration_hours = data.duration_hours
    req.expires_at = now + timedelta(hours=data.duration_hours)
    await db.commit()

    reloaded = await db.execute(_load_q().where(SupportAccessRequest.id == session_id))
    return _to_response(reloaded.scalar_one())


# ── Company Admin: reject request ─────────────────────────────────────────────

@router.post("/sessions/{session_id}/reject", response_model=SupportRequestResponse)
async def reject_request(
    session_id: uuid.UUID,
    data: SupportRequestReject,
    current_user=Depends(get_company_admin_or_above),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role == UserRole.SUPER_ADMIN:
        raise HTTPException(403, "Только администратор компании может отклонять запросы")

    loaded = await db.execute(_load_q().where(SupportAccessRequest.id == session_id))
    req = loaded.scalar_one_or_none()
    if not req:
        raise HTTPException(404, "Запрос не найден")
    if req.company_id != current_user.company_id:
        raise HTTPException(403, "Доступ запрещён")
    if req.status != "pending":
        raise HTTPException(400, f"Запрос уже имеет статус «{req.status}»")

    req.status = "rejected"
    req.reject_reason = data.reason
    await db.commit()

    reloaded = await db.execute(_load_q().where(SupportAccessRequest.id == session_id))
    return _to_response(reloaded.scalar_one())


# ── Audit log for a session ───────────────────────────────────────────────────

@router.get("/sessions/{session_id}/logs", response_model=List[SupportAccessLogResponse])
async def get_session_logs(
    session_id: uuid.UUID,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    req_r = await db.execute(
        select(SupportAccessRequest).where(SupportAccessRequest.id == session_id)
    )
    req = req_r.scalar_one_or_none()
    if not req:
        raise HTTPException(404, "Сессия не найдена")

    if current_user.role == UserRole.SUPER_ADMIN:
        if req.super_admin_id != current_user.id:
            raise HTTPException(403, "Доступ запрещён")
    elif current_user.role == UserRole.COMPANY_ADMIN:
        if req.company_id != current_user.company_id:
            raise HTTPException(403, "Доступ запрещён")
    else:
        raise HTTPException(403, "Доступ запрещён")

    result = await db.execute(
        select(SupportAccessLog)
        .where(SupportAccessLog.session_id == session_id)
        .order_by(SupportAccessLog.accessed_at.desc())
    )
    return result.scalars().all()


# ── Pending count (for company admin badge) ───────────────────────────────────

@router.get("/pending-count")
async def pending_count(
    current_user=Depends(get_company_admin_or_above),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role == UserRole.SUPER_ADMIN:
        return {"count": 0}
    result = await db.execute(
        select(SupportAccessRequest).where(
            SupportAccessRequest.company_id == current_user.company_id,
            SupportAccessRequest.status == "pending",
        )
    )
    return {"count": len(result.scalars().all())}
