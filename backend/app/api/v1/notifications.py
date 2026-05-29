import uuid
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.database import get_db
from app.models.notification import Notification
from app.schemas.notification import NotificationResponse, NotificationUnreadCount
from app.api.deps import get_any_company_user

router = APIRouter()


@router.get("/", response_model=List[NotificationResponse])
async def list_notifications(
    limit: int = 50,
    current_user=Depends(get_any_company_user),
    db: AsyncSession = Depends(get_db),
):
    """Список уведомлений текущего пользователя (последние 50)."""
    result = await db.execute(
        select(Notification)
        .where(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .limit(limit)
    )
    return result.scalars().all()


@router.get("/unread-count", response_model=NotificationUnreadCount)
async def unread_count(
    current_user=Depends(get_any_company_user),
    db: AsyncSession = Depends(get_db),
):
    """Количество непрочитанных уведомлений."""
    result = await db.execute(
        select(func.count(Notification.id)).where(
            Notification.user_id == current_user.id,
            Notification.is_read == False,  # noqa: E712
        )
    )
    count = result.scalar_one()
    return {"count": count}


@router.post("/{notification_id}/read", response_model=NotificationResponse)
async def mark_read(
    notification_id: uuid.UUID,
    current_user=Depends(get_any_company_user),
    db: AsyncSession = Depends(get_db),
):
    """Пометить одно уведомление как прочитанное."""
    result = await db.execute(
        select(Notification).where(Notification.id == notification_id)
    )
    n = result.scalar_one_or_none()
    if not n:
        raise HTTPException(status_code=404, detail="Уведомление не найдено")
    if n.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Доступ запрещён")
    n.is_read = True
    await db.commit()
    await db.refresh(n)
    return n


@router.post("/read-all", status_code=status.HTTP_204_NO_CONTENT)
async def mark_all_read(
    current_user=Depends(get_any_company_user),
    db: AsyncSession = Depends(get_db),
):
    """Пометить все уведомления пользователя как прочитанные."""
    result = await db.execute(
        select(Notification).where(
            Notification.user_id == current_user.id,
            Notification.is_read == False,  # noqa: E712
        )
    )
    for n in result.scalars().all():
        n.is_read = True
    await db.commit()
