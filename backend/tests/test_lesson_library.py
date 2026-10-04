import uuid

import pytest

from tests.test_hr_workspace import context
from app.models import Position
from app.models.knowledge import PositionTopic
from app.models.lesson import LessonMaterial, MaterialType


async def create_block(client, name):
    response = await client.post("/api/v1/knowledge/topics", json={"name": name})
    assert response.status_code == 201, response.text
    return response.json()


async def create_lesson(client, title, topic_id=None):
    response = await client.post("/api/v1/lessons/", json={"title": title, "topic_id": topic_id})
    assert response.status_code == 201, response.text
    return response.json()


@pytest.mark.asyncio
async def test_blocks_keep_order_and_lessons_are_created_in_study_order(context):
    client, db, user, _, _ = context
    intro = await create_block(client, "Знакомство с компанией")
    crm = await create_block(client, "Работа в CRM")
    assert [intro["sort_order"], crm["sort_order"]] == [1, 2]

    reordered = await client.post("/api/v1/knowledge/topics/reorder", json={"ids": [crm["id"], intro["id"]]})
    assert reordered.status_code == 204, reordered.text
    names = [t["name"] for t in (await client.get("/api/v1/knowledge/topics")).json()]
    assert names == ["Работа в CRM", "Знакомство с компанией"]

    first = await create_lesson(client, "О компании", intro["id"])
    second = await create_lesson(client, "Контакты", intro["id"])
    db.add(LessonMaterial(id=uuid.uuid4(), lesson_id=uuid.UUID(second["id"]), company_id=user.company_id, title="Памятка", material_type=MaterialType.PDF, url="/x.pdf"))
    await db.commit()
    lessons = (await client.get("/api/v1/lessons/", params={"topic_id": intro["id"]})).json()
    assert [l["title"] for l in lessons] == ["О компании", "Контакты"]
    assert lessons[1]["material_types"] == ["pdf"]

    moved = await client.post("/api/v1/lessons/reorder", json={"topic_id": intro["id"], "ids": [second["id"], first["id"]]})
    assert moved.status_code == 204, moved.text
    lessons = (await client.get("/api/v1/lessons/", params={"topic_id": intro["id"]})).json()
    assert [l["title"] for l in lessons] == ["Контакты", "О компании"]

    wrong_block = await client.post("/api/v1/lessons/reorder", json={"topic_id": crm["id"], "ids": [first["id"]]})
    assert wrong_block.status_code == 400


@pytest.mark.asyncio
async def test_lesson_moves_between_blocks_and_to_unassigned(context):
    client, _, _, _, _ = context
    intro = await create_block(client, "Знакомство с компанией")
    crm = await create_block(client, "Работа в CRM")
    await create_lesson(client, "Сделки", crm["id"])
    lesson = await create_lesson(client, "Карточка клиента", intro["id"])

    moved = await client.patch(f"/api/v1/lessons/{lesson['id']}", json={"topic_id": crm["id"]})
    assert moved.status_code == 200, moved.text
    assert moved.json()["topic_id"] == crm["id"]
    assert moved.json()["sort_order"] == 2
    assert moved.json()["title"] == "Карточка клиента"

    unassigned = await client.patch(f"/api/v1/lessons/{lesson['id']}", json={"topic_id": None})
    assert unassigned.json()["topic_id"] is None

    foreign = await client.patch(f"/api/v1/lessons/{lesson['id']}", json={"topic_id": str(uuid.uuid4())})
    assert foreign.status_code == 400
    assert (await client.patch(f"/api/v1/lessons/{lesson['id']}", json={"title": None})).json()["title"] == "Карточка клиента"


@pytest.mark.asyncio
async def test_topic_positions_show_programs_using_block(context):
    client, db, user, _, foreign_position = context
    block = await create_block(client, "Работа с клиентами")
    position = Position(id=uuid.uuid4(), company_id=user.company_id, name="Менеджер")
    db.add(position)
    db.add(PositionTopic(id=uuid.uuid4(), position_id=position.id, topic_id=uuid.UUID(block["id"]), company_id=user.company_id, is_required=True))
    db.add(PositionTopic(id=uuid.uuid4(), position_id=foreign_position.id, topic_id=uuid.UUID(block["id"]), company_id=foreign_position.company_id))
    await db.commit()
    links = (await client.get("/api/v1/knowledge/topic-positions")).json()
    assert links == [{"topic_id": block["id"], "position_id": str(position.id), "position_name": "Менеджер", "is_required": True}]
