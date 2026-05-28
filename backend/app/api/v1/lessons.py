import os
import uuid
from pathlib import Path
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.schemas.lesson import (
    LessonCreate, LessonUpdate, LessonResponse, LessonDetailResponse,
    LessonMaterialResponse, MaterialLinkCreate,
)
from app.models.lesson import Lesson, LessonMaterial, LessonStatus, MaterialType
from app.models.user import UserRole
from app.api.deps import get_content_creator, get_any_company_user, get_effective_company_id
from app.config import settings

router = APIRouter()

ALLOWED_EXTENSIONS = {
    ".pdf", ".doc", ".docx", ".xls", ".xlsx",
    ".jpg", ".jpeg", ".png", ".gif", ".webp",
    ".ppt", ".pptx", ".txt",
}
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB


def _get_material_type_from_ext(ext: str) -> MaterialType:
    ext = ext.lower()
    if ext == ".pdf":
        return MaterialType.PDF
    if ext in {".doc", ".docx"}:
        return MaterialType.DOC
    if ext in {".xls", ".xlsx"}:
        return MaterialType.XLS
    if ext in {".jpg", ".jpeg", ".png", ".gif", ".webp"}:
        return MaterialType.IMAGE
    if ext in {".ppt", ".pptx"}:
        return MaterialType.PRESENTATION
    return MaterialType.TEXT


# ── List / Create ─────────────────────────────────────────────────────────────

@router.get("/", response_model=List[LessonResponse])
async def list_lessons(
    status_filter: Optional[str] = None,
    position_id: Optional[str] = None,
    topic_id: Optional[str] = None,
    current_user=Depends(get_any_company_user),
    effective_company_id: UUID = Depends(get_effective_company_id),
    db: AsyncSession = Depends(get_db),
):
    q = select(Lesson).where(Lesson.company_id == effective_company_id)

    if current_user.role == UserRole.EMPLOYEE:
        q = q.where(Lesson.status == LessonStatus.PUBLISHED)
    elif status_filter:
        q = q.where(Lesson.status == status_filter)

    if position_id:
        q = q.where(Lesson.position_id == position_id)
    if topic_id:
        q = q.where(Lesson.topic_id == topic_id)

    result = await db.execute(q.order_by(Lesson.created_at.desc()))
    return result.scalars().all()


@router.post("/", response_model=LessonResponse, status_code=status.HTTP_201_CREATED)
async def create_lesson(
    data: LessonCreate,
    current_user=Depends(get_content_creator),
    effective_company_id: UUID = Depends(get_effective_company_id),
    db: AsyncSession = Depends(get_db),
):
    lesson = Lesson(
        id=uuid.uuid4(),
        title=data.title,
        description=data.description,
        text_content=data.text_content,
        position_id=data.position_id,
        topic_id=data.topic_id,
        author_id=current_user.id,
        difficulty_level=data.difficulty_level,
        duration_minutes=data.duration_minutes,
        video_url=data.video_url,
        external_links=[link.model_dump() for link in data.external_links] if data.external_links else None,
        company_id=effective_company_id,
    )
    db.add(lesson)
    await db.commit()
    await db.refresh(lesson)
    return lesson


# ── Detail ────────────────────────────────────────────────────────────────────

@router.get("/{lesson_id}", response_model=LessonDetailResponse)
async def get_lesson(
    lesson_id: uuid.UUID,
    current_user=Depends(get_any_company_user),
    effective_company_id: UUID = Depends(get_effective_company_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Lesson)
        .options(selectinload(Lesson.materials))
        .where(Lesson.id == lesson_id)
    )
    lesson = result.scalar_one_or_none()
    if not lesson:
        raise HTTPException(status_code=404, detail="Урок не найден")
    if lesson.company_id != effective_company_id:
        raise HTTPException(status_code=403, detail="Доступ запрещён")
    if current_user.role == UserRole.EMPLOYEE and lesson.status != LessonStatus.PUBLISHED:
        raise HTTPException(status_code=403, detail="Урок не опубликован")
    return lesson


@router.patch("/{lesson_id}", response_model=LessonResponse)
async def update_lesson(
    lesson_id: uuid.UUID,
    data: LessonUpdate,
    current_user=Depends(get_content_creator),
    effective_company_id: UUID = Depends(get_effective_company_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Lesson).where(Lesson.id == lesson_id))
    lesson = result.scalar_one_or_none()
    if not lesson:
        raise HTTPException(status_code=404, detail="Урок не найден")
    if lesson.company_id != effective_company_id:
        raise HTTPException(status_code=403, detail="Доступ запрещён")

    update_data = data.model_dump(exclude_none=True)
    if "external_links" in update_data and update_data["external_links"] is not None:
        update_data["external_links"] = [
            lnk.model_dump() if hasattr(lnk, "model_dump") else lnk
            for lnk in data.external_links
        ]
    for field, value in update_data.items():
        setattr(lesson, field, value)
    await db.commit()
    await db.refresh(lesson)
    return lesson


@router.post("/{lesson_id}/publish", response_model=LessonResponse)
async def publish_lesson(
    lesson_id: uuid.UUID,
    current_user=Depends(get_content_creator),
    effective_company_id: UUID = Depends(get_effective_company_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Lesson).where(Lesson.id == lesson_id))
    lesson = result.scalar_one_or_none()
    if not lesson:
        raise HTTPException(status_code=404, detail="Урок не найден")
    if lesson.company_id != effective_company_id:
        raise HTTPException(status_code=403, detail="Доступ запрещён")
    lesson.status = LessonStatus.PUBLISHED
    await db.commit()
    await db.refresh(lesson)
    return lesson


@router.post("/{lesson_id}/archive", response_model=LessonResponse)
async def archive_lesson(
    lesson_id: uuid.UUID,
    current_user=Depends(get_content_creator),
    effective_company_id: UUID = Depends(get_effective_company_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Lesson).where(Lesson.id == lesson_id))
    lesson = result.scalar_one_or_none()
    if not lesson:
        raise HTTPException(status_code=404, detail="Урок не найден")
    if lesson.company_id != effective_company_id:
        raise HTTPException(status_code=403, detail="Доступ запрещён")
    lesson.status = LessonStatus.ARCHIVED
    await db.commit()
    await db.refresh(lesson)
    return lesson


@router.delete("/{lesson_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_lesson(
    lesson_id: uuid.UUID,
    current_user=Depends(get_content_creator),
    effective_company_id: UUID = Depends(get_effective_company_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Lesson).where(Lesson.id == lesson_id))
    lesson = result.scalar_one_or_none()
    if not lesson:
        raise HTTPException(status_code=404, detail="Урок не найден")
    if lesson.company_id != effective_company_id:
        raise HTTPException(status_code=403, detail="Доступ запрещён")
    await db.delete(lesson)
    await db.commit()


# ── Materials: add link ───────────────────────────────────────────────────────

@router.post("/{lesson_id}/materials", response_model=LessonMaterialResponse, status_code=201)
async def add_material_link(
    lesson_id: uuid.UUID,
    data: MaterialLinkCreate,
    current_user=Depends(get_content_creator),
    effective_company_id: UUID = Depends(get_effective_company_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Lesson).where(Lesson.id == lesson_id))
    lesson = result.scalar_one_or_none()
    if not lesson:
        raise HTTPException(status_code=404, detail="Урок не найден")
    if lesson.company_id != effective_company_id:
        raise HTTPException(status_code=403, detail="Доступ запрещён")

    material = LessonMaterial(
        id=uuid.uuid4(),
        lesson_id=lesson_id,
        company_id=lesson.company_id,
        title=data.title,
        material_type=data.material_type,
        url=data.url,
    )
    db.add(material)
    await db.commit()
    await db.refresh(material)
    return material


# ── Materials: upload file ────────────────────────────────────────────────────

@router.post("/{lesson_id}/upload", response_model=LessonMaterialResponse, status_code=201)
async def upload_file_material(
    lesson_id: uuid.UUID,
    file: UploadFile = File(...),
    title: str = Form(default=""),
    current_user=Depends(get_content_creator),
    effective_company_id: UUID = Depends(get_effective_company_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Lesson).where(Lesson.id == lesson_id))
    lesson = result.scalar_one_or_none()
    if not lesson:
        raise HTTPException(status_code=404, detail="Урок не найден")
    if lesson.company_id != effective_company_id:
        raise HTTPException(status_code=403, detail="Доступ запрещён")

    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Тип файла не поддерживается: {ext}")

    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="Файл превышает 50 МБ")

    save_dir = Path(settings.UPLOADS_DIR) / str(lesson.company_id) / str(lesson_id)
    save_dir.mkdir(parents=True, exist_ok=True)
    safe_name = f"{uuid.uuid4().hex}{ext}"
    save_path = save_dir / safe_name
    with open(save_path, "wb") as f:
        f.write(contents)

    file_url = f"/uploads/{lesson.company_id}/{lesson_id}/{safe_name}"
    material_type = _get_material_type_from_ext(ext)

    material = LessonMaterial(
        id=uuid.uuid4(),
        lesson_id=lesson_id,
        company_id=lesson.company_id,
        title=title or file.filename or safe_name,
        material_type=material_type,
        url=file_url,
        file_name=file.filename,
        file_size=len(contents),
    )
    db.add(material)
    await db.commit()
    await db.refresh(material)
    return material


# ── Materials: delete ─────────────────────────────────────────────────────────

@router.delete("/{lesson_id}/materials/{material_id}", status_code=204)
async def delete_material(
    lesson_id: uuid.UUID,
    material_id: uuid.UUID,
    current_user=Depends(get_content_creator),
    effective_company_id: UUID = Depends(get_effective_company_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(LessonMaterial).where(
            LessonMaterial.id == material_id,
            LessonMaterial.lesson_id == lesson_id,
        )
    )
    mat = result.scalar_one_or_none()
    if not mat:
        raise HTTPException(status_code=404, detail="Материал не найден")
    if mat.company_id != effective_company_id:
        raise HTTPException(status_code=403, detail="Доступ запрещён")

    if mat.url and mat.url.startswith("/uploads/"):
        try:
            path = Path(settings.UPLOADS_DIR) / mat.url.removeprefix("/uploads/")
            path.unlink(missing_ok=True)
        except Exception:
            pass

    await db.delete(mat)
    await db.commit()
