from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List, Optional
from uuid import UUID
import uuid
from app.database import get_db
from app.schemas.knowledge import (
    KnowledgeTopicCreate, KnowledgeTopicUpdate, KnowledgeTopicResponse,
    PositionTopicCreate, PositionTopicResponse,
)
from app.models.knowledge import KnowledgeTopic, PositionTopic
from app.models.position import Position
from app.models.user import UserRole
from app.api.deps import get_hr_or_above, get_any_company_user

router = APIRouter()

# ── Knowledge Topics ──────────────────────────────────────────────────────────

@router.get("/topics", response_model=List[KnowledgeTopicResponse])
async def list_topics(
    current_user=Depends(get_any_company_user),
    db: AsyncSession = Depends(get_db),
):
    q = select(KnowledgeTopic)
    if current_user.role != UserRole.SUPER_ADMIN:
        q = q.where(KnowledgeTopic.company_id == current_user.company_id)
    result = await db.execute(q.order_by(KnowledgeTopic.name))
    return result.scalars().all()


@router.post("/topics", response_model=KnowledgeTopicResponse, status_code=status.HTTP_201_CREATED)
async def create_topic(
    data: KnowledgeTopicCreate,
    current_user=Depends(get_hr_or_above),
    db: AsyncSession = Depends(get_db),
):
    topic = KnowledgeTopic(
        id=uuid.uuid4(),
        name=data.name,
        description=data.description,
        difficulty_level=data.difficulty_level,
        criticality=data.criticality,
        required_knowledge_level=data.required_knowledge_level,
        related_lessons=data.related_lessons,
        related_tests=data.related_tests,
        company_id=current_user.company_id,
    )
    db.add(topic)
    await db.commit()
    await db.refresh(topic)
    return topic


@router.patch("/topics/{topic_id}", response_model=KnowledgeTopicResponse)
async def update_topic(
    topic_id: UUID,
    data: KnowledgeTopicUpdate,
    current_user=Depends(get_hr_or_above),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(KnowledgeTopic).where(KnowledgeTopic.id == topic_id))
    topic = result.scalar_one_or_none()
    if not topic:
        raise HTTPException(status_code=404, detail="Тема не найдена")
    if current_user.role != UserRole.SUPER_ADMIN and topic.company_id != current_user.company_id:
        raise HTTPException(status_code=403, detail="Доступ запрещён")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(topic, field, value)
    await db.commit()
    await db.refresh(topic)
    return topic


@router.delete("/topics/{topic_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_topic(
    topic_id: UUID,
    current_user=Depends(get_hr_or_above),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(KnowledgeTopic).where(KnowledgeTopic.id == topic_id))
    topic = result.scalar_one_or_none()
    if not topic:
        raise HTTPException(status_code=404, detail="Тема не найдена")
    if current_user.role != UserRole.SUPER_ADMIN and topic.company_id != current_user.company_id:
        raise HTTPException(status_code=403, detail="Доступ запрещён")
    await db.delete(topic)
    await db.commit()


# ── Position Knowledge Matrix ─────────────────────────────────────────────────

@router.get("/matrix", response_model=List[PositionTopicResponse])
async def get_matrix(
    position_id: UUID,
    current_user=Depends(get_any_company_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all knowledge topics assigned to a position."""
    q = (
        select(PositionTopic)
        .options(selectinload(PositionTopic.topic))
        .where(PositionTopic.position_id == position_id)
    )
    if current_user.role != UserRole.SUPER_ADMIN:
        q = q.where(PositionTopic.company_id == current_user.company_id)
    result = await db.execute(q)
    return result.scalars().all()


@router.post("/matrix", response_model=PositionTopicResponse, status_code=status.HTTP_201_CREATED)
async def assign_topic_to_position(
    data: PositionTopicCreate,
    current_user=Depends(get_hr_or_above),
    db: AsyncSession = Depends(get_db),
):
    # Verify position belongs to this company
    pos_result = await db.execute(select(Position).where(Position.id == data.position_id))
    pos = pos_result.scalar_one_or_none()
    if not pos:
        raise HTTPException(status_code=404, detail="Должность не найдена")
    if current_user.role != UserRole.SUPER_ADMIN and pos.company_id != current_user.company_id:
        raise HTTPException(status_code=403, detail="Доступ запрещён")

    # Verify topic belongs to this company
    topic_result = await db.execute(select(KnowledgeTopic).where(KnowledgeTopic.id == data.topic_id))
    topic = topic_result.scalar_one_or_none()
    if not topic:
        raise HTTPException(status_code=404, detail="Тема не найдена")
    if current_user.role != UserRole.SUPER_ADMIN and topic.company_id != current_user.company_id:
        raise HTTPException(status_code=403, detail="Доступ запрещён")

    # Prevent duplicates
    dup = await db.execute(
        select(PositionTopic).where(
            PositionTopic.position_id == data.position_id,
            PositionTopic.topic_id == data.topic_id,
        )
    )
    if dup.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Тема уже добавлена к этой должности")

    link = PositionTopic(
        id=uuid.uuid4(),
        position_id=data.position_id,
        topic_id=data.topic_id,
        is_required=data.is_required,
        company_id=current_user.company_id,
    )
    db.add(link)
    await db.commit()

    # Reload with topic eager-loaded
    loaded = await db.execute(
        select(PositionTopic)
        .options(selectinload(PositionTopic.topic))
        .where(PositionTopic.id == link.id)
    )
    return loaded.scalar_one()


@router.delete("/matrix/{link_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_topic_from_position(
    link_id: UUID,
    current_user=Depends(get_hr_or_above),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(PositionTopic).where(PositionTopic.id == link_id))
    link = result.scalar_one_or_none()
    if not link:
        raise HTTPException(status_code=404, detail="Запись матрицы не найдена")
    if current_user.role != UserRole.SUPER_ADMIN and link.company_id != current_user.company_id:
        raise HTTPException(status_code=403, detail="Доступ запрещён")
    await db.delete(link)
    await db.commit()
