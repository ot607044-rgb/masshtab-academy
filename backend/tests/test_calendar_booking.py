"""Calendar API behavior; public responses contain only bookable UTC intervals."""
from datetime import datetime, timezone
from types import SimpleNamespace
from zoneinfo import ZoneInfo

import pytest
from app.main import app
from app.api.deps import get_current_user
from test_hr_workspace import context  # noqa: F401

PREFIX = "/api/v1/recruitment"
DAY = "2030-01-07"


async def configure(client, **settings):
    response = await client.put(f"{PREFIX}/availability/rules", json={
        "timezone": "Asia/Yekaterinburg", "buffer_minutes": 15,
        "rules": [{"weekday": 0, "start_minute": 600, "end_minute": 720, "slot_minutes": 30}],
        **settings,
    })
    assert response.status_code == 200, response.text
    token = (await client.post(f"{PREFIX}/public-link")).json()["token"]
    return token


async def slots(client, token, start=f"{DAY}T00:00:00Z", end=f"{DAY}T23:59:00Z"):
    return await client.get(f"/api/v1/public-calendar/{token}/slots", params={"start": start, "end": end})


@pytest.mark.asyncio
async def test_work_hours_settings_persist_and_buffer_excludes_adjacent_slot(context):
    client, _, user, *_ = context
    token = await configure(client)
    state = (await client.get(f"{PREFIX}/availability")).json()
    assert state["timezone"] == "Asia/Yekaterinburg"
    assert state["buffer_minutes"] == 15
    response = await client.post(f"{PREFIX}/interviews", json={"title": "Private CRM discussion", "meeting_type": "work", "starts_at": f"{DAY}T10:00:00+05:00", "duration_minutes": 30, "participant_ids": [str(user.id)]})
    assert response.status_code == 201, response.text
    intervals = (await slots(client, token)).json()["slots"]
    assert [datetime.fromisoformat(s["starts_at"].replace("Z", "+00:00")).strftime("%H:%M") for s in intervals] == ["06:00", "06:30"]
    assert all(set(s) == {"starts_at", "ends_at", "duration_minutes"} for s in intervals)


@pytest.mark.asyncio
async def test_slot_instants_do_not_depend_on_visitors_timezone(context):
    client, *_ = context
    token = await configure(client, buffer_minutes=0)
    a = (await slots(client, token)).json()["slots"]
    b = (await slots(client, token, f"{DAY}T09:00:00+09:00", "2030-01-08T08:59:00+09:00")).json()["slots"]
    assert a == b
    assert datetime.fromisoformat(a[0]["starts_at"].replace("Z", "+00:00")) == datetime(2030, 1, 7, 5, tzinfo=timezone.utc)


@pytest.mark.asyncio
async def test_full_day_exception_blocks_public_and_internal_booking(context):
    client, _, user, *_ = context
    token = await configure(client)
    block = await client.post(f"{PREFIX}/availability/blocks", json={"starts_at": f"{DAY}T00:00:00+05:00", "duration_minutes": 1440, "title": "Private day off"})
    assert block.status_code == 201, block.text
    assert (await slots(client, token)).json()["slots"] == []
    assert (await client.post(f"{PREFIX}/interviews", json={"title": "Blocked", "starts_at": f"{DAY}T10:00:00+05:00", "participant_ids": [str(user.id)]})).status_code == 409
    assert (await client.delete(f"{PREFIX}/availability/blocks/{block.json()['id']}")).status_code == 204
    assert (await slots(client, token)).json()["slots"]


@pytest.mark.asyncio
async def test_public_booking_without_auth_pause_resume_and_revocation(context):
    client, *_ = context
    token = await configure(client, buffer_minutes=0)
    app.dependency_overrides.pop(get_current_user)
    selected = (await slots(client, token)).json()["slots"][0]
    payload = {"starts_at": selected["starts_at"], "duration_minutes": selected["duration_minutes"], "visitor_name": "Guest", "visitor_contact": "guest@example.org"}
    assert (await client.post(f"/api/v1/public-calendar/{token}/book", json=payload)).status_code == 201
    assert (await client.post(f"/api/v1/public-calendar/{token}/book", json=payload)).status_code == 409
    assert (await client.get(f"{PREFIX}/availability")).status_code in (401, 403)


@pytest.mark.asyncio
async def test_pause_retains_link_and_revocation_invalidates_old_token(context):
    client, *_ = context
    token = await configure(client)
    assert (await client.patch(f"{PREFIX}/public-link", json={"enabled": False})).status_code == 200
    assert (await slots(client, token)).status_code == 404
    assert (await client.post(f"{PREFIX}/public-link")).json()["token"] == token
    assert (await slots(client, token)).status_code == 200
    assert (await client.delete(f"{PREFIX}/public-link")).status_code == 204
    assert (await client.post(f"{PREFIX}/public-link")).json()["token"] != token
    assert (await slots(client, token)).status_code == 404


@pytest.mark.asyncio
async def test_ranges_are_bounded_and_overlapping_rules_rejected(context):
    client, *_ = context
    token = await configure(client)
    assert (await slots(client, token, f"{DAY}T00:00:00Z", "2031-01-01T00:00:00Z")).status_code == 422
    rule = {"weekday": 0, "start_minute": 600, "end_minute": 720, "slot_minutes": 30}
    assert (await client.put(f"{PREFIX}/availability/rules", json={"rules": [rule, rule]})).status_code == 422
    assert (await client.put(f"{PREFIX}/availability/rules", json={"rules": [rule], "timezone": "Mars/Test"})).status_code == 422


@pytest.mark.asyncio
async def test_null_required_meeting_fields_are_rejected(context):
    client, *_ = context
    meeting = (await client.post(f"{PREFIX}/interviews", json={"title": "Meeting", "starts_at": f"{DAY}T10:00:00Z"})).json()
    for field in ("title", "starts_at", "duration_minutes", "participant_ids", "meeting_type"):
        response = await client.patch(f"{PREFIX}/interviews/{meeting['id']}", json={field: None})
        assert response.status_code == 422, (field, response.text)


def test_dst_spring_skips_nonexistent_hours_and_autumn_keeps_distinct_instants():
    from app.services.calendar import calculate_slots
    rule = SimpleNamespace(weekday=6, start_minute=60, end_minute=240, slot_minutes=30)
    spring = calculate_slots([rule], "Europe/Berlin", 0, datetime(2030, 3, 31, tzinfo=timezone.utc), datetime(2030, 4, 1, tzinfo=timezone.utc), [])
    assert [s["starts_at"].astimezone(ZoneInfo("Europe/Berlin")).strftime("%H:%M") for s in spring] == ["01:00", "01:30", "03:00", "03:30"]
    autumn = calculate_slots([rule], "Europe/Berlin", 0, datetime(2030, 10, 26, 22, tzinfo=timezone.utc), datetime(2030, 10, 27, 6, tzinfo=timezone.utc), [])
    repeated = [s for s in autumn if s["starts_at"].astimezone(ZoneInfo("Europe/Berlin")).strftime("%H:%M") == "02:00"]
    assert len(repeated) == 2
    assert repeated[0]["starts_at"] != repeated[1]["starts_at"]


def test_dst_does_not_join_separate_fold_windows_or_discard_valid_spring_hours():
    from app.services.calendar import calculate_slots
    rule = SimpleNamespace(weekday=6, start_minute=135, end_minute=165, slot_minutes=30)
    autumn = calculate_slots([rule], "Europe/Berlin", 0, datetime(2030, 10, 27, tzinfo=timezone.utc), datetime(2030, 10, 28, tzinfo=timezone.utc), [])
    assert [s["starts_at"].strftime("%H:%M") for s in autumn] == ["00:15", "01:15"]
    spring_rule = SimpleNamespace(weekday=6, start_minute=120, end_minute=240, slot_minutes=30)
    spring = calculate_slots([spring_rule], "Europe/Berlin", 0, datetime(2030, 3, 31, tzinfo=timezone.utc), datetime(2030, 4, 1, tzinfo=timezone.utc), [])
    assert [s["starts_at"].astimezone(ZoneInfo("Europe/Berlin")).strftime("%H:%M") for s in spring] == ["03:00", "03:30"]


@pytest.mark.asyncio
async def test_events_are_durable_and_past_slots_cannot_be_booked(context):
    from sqlalchemy import select
    from app.models.calendar import CalendarChange
    client, db, user, *_ = context
    token = await configure(client)
    assert (await slots(client, token, "2020-01-06T00:00:00Z", "2020-01-07T00:00:00Z")).json()["slots"] == []
    payload = {"starts_at": f"{DAY}T10:00:00+05:00", "title": "Saved", "participant_ids": [str(user.id)]}
    created = (await client.post(f"{PREFIX}/interviews", json=payload)).json()
    assert (await client.patch(f"{PREFIX}/interviews/{created['id']}", json={"title": "Edited"})).status_code == 200
    assert (await client.delete(f"{PREFIX}/interviews/{created['id']}")).status_code == 204
    db.expire_all()
    events = (await db.execute(select(CalendarChange).order_by(CalendarChange.created_at))).scalars().all()
    assert [e.kind for e in events] == ["created", "updated", "cancelled"]
    assert all(str(e.meeting_id) == created["id"] for e in events)
    assert events[-1].payload["title"] == "Edited"


@pytest.mark.asyncio
async def test_deactivated_owner_cannot_be_booked_but_old_meetings_still_display(context):
    client, db, user, *_ = context
    token = await configure(client)
    response = await client.post(f"{PREFIX}/interviews", json={"title": "Existing", "starts_at": f"{DAY}T10:00:00Z", "participant_ids": [str(user.id)]})
    assert response.status_code == 201
    user.is_active = False
    await db.commit()
    assert (await slots(client, token)).status_code == 404
    response = await client.get(f"{PREFIX}/interviews")
    assert response.status_code == 200 and response.json()[0]["title"] == "Existing"
