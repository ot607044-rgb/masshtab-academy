import uuid

import pytest

from tests.test_hr_workspace import context
from app.models import Test as AcademyTest, Lesson
from app.models.lesson import LessonStatus


@pytest.mark.asyncio
async def test_editor_can_clear_optional_settings_without_resetting_other_fields(context):
    client, db, user, _, _ = context
    lesson = Lesson(id=uuid.uuid4(), company_id=user.company_id, title="Service", status=LessonStatus.PUBLISHED)
    db.add(lesson)
    await db.flush()
    item = AcademyTest(id=uuid.uuid4(), company_id=user.company_id, title="Service test", description="Old", lesson_id=lesson.id, time_limit_minutes=20, passing_score=80, max_attempts=3)
    db.add(item)
    await db.commit()
    response = await client.patch(f"/api/v1/tests/{item.id}", json={"description": "", "lesson_id": None, "time_limit_minutes": None})
    assert response.status_code == 200, response.text
    saved = (await client.get(f"/api/v1/tests/{item.id}")).json()
    assert saved["lesson_id"] is None
    assert saved["time_limit_minutes"] is None
    assert saved["description"] == ""
    assert saved["passing_score"] == 80
    assert saved["title"] == "Service test"
