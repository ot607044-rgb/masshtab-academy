"""Calendar calculations use UTC instants and an owner's IANA wall clock.

All calendar writers acquire the same existing User row locks before reading
availability. PostgreSQL READ COMMITTED then observes the previous writer's
commit, including when requests arrive through different public tokens.
"""
from datetime import datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from fastapi import HTTPException
from sqlalchemy import select
from app.models.calendar import CalendarSettings, CalendarChange
from app.models.recruitment import Interview, CalendarBlock, CalendarAvailabilityRule
from app.models.user import User

MAX_BLOCK_MINUTES = 44640


def utc(value):
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def now_utc():
    return datetime.now(timezone.utc)


def validate_range(start, end):
    if start.tzinfo is None or end.tzinfo is None:
        raise HTTPException(422, "Укажите часовой пояс")
    if end <= start or end - start > timedelta(days=31):
        raise HTTPException(422, "Допустимый период: от 1 минуты до 31 дня")


async def lock_users(db, company_id, ids):
    for user_id in sorted(set(ids), key=str):
        user = (await db.execute(select(User).where(User.id == user_id, User.company_id == company_id, User.is_active.is_(True)).with_for_update())).scalar_one_or_none()
        if user is None:
            raise HTTPException(404, "Участник не найден")


async def settings_for(db, company_id, user_id):
    return (await db.execute(select(CalendarSettings).where(CalendarSettings.company_id == company_id, CalendarSettings.user_id == user_id))).scalar_one_or_none()


def calculate_slots(rules, zone_name, buffer_minutes, start, end, busy, now=None):
    zone = ZoneInfo(zone_name)
    lower, upper = utc(start), utc(end)
    day, last = lower.astimezone(zone).date(), upper.astimezone(zone).date()
    result = {}
    minute_step = timedelta(minutes=1)
    while day <= last:
        # Build actual instants for this wall-clock date. Nonexistent minutes
        # are absent; repeated minutes retain both distinct UTC keys.
        cursor = datetime.combine(day, time.min, tzinfo=zone).astimezone(timezone.utc) - timedelta(days=1)
        finish_day = datetime.combine(day + timedelta(days=1), time.min, tzinfo=zone).astimezone(timezone.utc) + timedelta(days=1)
        wall_minutes = {}
        while cursor < finish_day:
            local = cursor.astimezone(zone)
            if local.date() == day:
                wall_minutes[cursor] = local.hour * 60 + local.minute
            cursor += minute_step
        for rule in rules:
            if rule.weekday != day.weekday():
                continue
            step = timedelta(minutes=rule.slot_minutes)
            for cursor, minute in wall_minutes.items():
                if not rule.start_minute <= minute < rule.end_minute or (minute - rule.start_minute) % rule.slot_minutes:
                    continue
                finish = cursor + step
                if cursor < lower or finish > upper or (now is not None and cursor <= utc(now)):
                    continue
                # Every minute must belong to this window, including across
                # a fold: never bridge two separate occurrences of a window.
                if not all(rule.start_minute <= wall_minutes.get(cursor + minute_step * offset, -1) < rule.end_minute for offset in range(rule.slot_minutes)):
                    continue
                if not any(cursor < busy_end and busy_start < finish for busy_start, busy_end in busy):
                    result[(cursor, finish)] = {"starts_at": cursor, "ends_at": finish, "duration_minutes": rule.slot_minutes}
        day += timedelta(days=1)
    return [result[key] for key in sorted(result)]


async def slots_for_user(db, company_id, user_id, start, end, include_past=False):
    validate_range(start, end)
    prefs = await settings_for(db, company_id, user_id)
    zone_name = prefs.timezone if prefs else "UTC"
    buffer = prefs.buffer_minutes if prefs else 0
    rules = (await db.execute(select(CalendarAvailabilityRule).where(CalendarAvailabilityRule.company_id == company_id, CalendarAvailabilityRule.user_id == user_id))).scalars().all()
    gap = timedelta(minutes=buffer)
    records = (await db.execute(select(Interview).where(Interview.company_id == company_id, Interview.starts_at < utc(end) + gap, Interview.starts_at >= utc(start) - timedelta(hours=8) - gap))).scalars().all()
    blocks = (await db.execute(select(CalendarBlock).where(CalendarBlock.company_id == company_id, CalendarBlock.user_id == user_id, CalendarBlock.starts_at < utc(end), CalendarBlock.starts_at >= utc(start) - timedelta(minutes=MAX_BLOCK_MINUTES)))).scalars().all()
    owner = str(user_id)
    busy = [(utc(r.starts_at) - gap, utc(r.starts_at) + timedelta(minutes=r.duration_minutes) + gap) for r in records if owner in {str(p) for p in r.participant_ids or []} or r.created_by == user_id]
    busy += [(utc(b.starts_at), utc(b.starts_at) + timedelta(minutes=b.duration_minutes)) for b in blocks]
    return calculate_slots(rules, zone_name, buffer, start, end, busy, now=None if include_past else now_utc())


async def record_change(db, meeting, kind):
    await db.flush()
    db.add(CalendarChange(company_id=meeting.company_id, meeting_id=meeting.id, kind=kind, created_at=now_utc(), payload={
        "version": 1, "id": str(meeting.id), "title": meeting.title,
        "starts_at": utc(meeting.starts_at).isoformat(), "duration_minutes": meeting.duration_minutes,
        "participant_ids": [str(p) for p in meeting.participant_ids or []],
        "organizer_id": str(meeting.created_by) if meeting.created_by else None,
        "meeting_url": meeting.meeting_url,
    }))
