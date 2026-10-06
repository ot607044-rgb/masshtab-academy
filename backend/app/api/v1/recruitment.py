from datetime import datetime, time, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_effective_company_id, get_hr_or_above
from app.database import get_db
from app.models.department import Department
from app.models.employee import Employee, EmployeeStatus
from app.models.position import Position
from app.models.recruitment import Candidate, Interview, Vacancy
from app.models.user import User
from app.schemas.recruitment import CandidateCreate, CandidatePatch, HireRequest, InterviewCreate, InterviewPatch, VacancyCreate, VacancyPatch

router = APIRouter(dependencies=[Depends(get_hr_or_above)])


async def company_record(db, model, record_id, company_id, lock=False):
    query = select(model).where(model.id == record_id, model.company_id == company_id)
    if lock:
        query = query.with_for_update()
    record = (await db.execute(query)).scalar_one_or_none()
    if not record:
        raise HTTPException(404, "Запись не найдена")
    return record


def record_data(record):
    return {column.name: getattr(record, column.name) for column in record.__table__.columns}


def history_event(stage, user_id):
    return {"stage": stage, "at": datetime.now(timezone.utc).isoformat(), "user_id": str(user_id)}


def interview_start(record):
    return record.starts_at.replace(tzinfo=timezone.utc) if record.starts_at.tzinfo is None else record.starts_at


def interview_end(record):
    return interview_start(record) + timedelta(minutes=record.duration_minutes)


def overlaps(a_start, a_end, b_start, b_end):
    return a_start < b_end and b_start < a_end


async def participants_map(db: AsyncSession, company_id: UUID, ids: list[UUID]):
    unique = list(dict.fromkeys(ids))
    if not unique:
        return {}
    rows = (await db.execute(select(User).where(User.company_id == company_id, User.id.in_(unique), User.is_active.is_(True)))).scalars().all()
    found = {user.id: user for user in rows}
    if len(found) != len(unique):
        raise HTTPException(404, "Участник не найден")
    return found


def participant_data(user: User):
    return {"id": user.id, "full_name": user.full_name, "email": user.email, "role": user.role}


async def serialize_interview(db: AsyncSession, record: Interview, candidate_name: str, company_id: UUID):
    participant_ids = [UUID(str(item)) for item in (record.participant_ids or [])]
    users = await participants_map(db, company_id, participant_ids)
    data = record_data(record)
    data["participant_ids"] = participant_ids
    data["participants"] = [participant_data(users[user_id]) for user_id in participant_ids if user_id in users]
    data["candidate_name"] = candidate_name
    data["starts_at"] = interview_start(record)
    return data


async def ensure_interview_available(db: AsyncSession, company_id: UUID, candidate_id: UUID, participant_ids: list[UUID], starts_at: datetime, duration_minutes: int, exclude_id: UUID | None = None):
    start_utc = starts_at.astimezone(timezone.utc)
    end_utc = start_utc + timedelta(minutes=duration_minutes)
    rows = (await db.execute(select(Interview).where(Interview.company_id == company_id))).scalars().all()
    participant_set = {str(item) for item in participant_ids}
    for record in rows:
        if exclude_id and record.id == exclude_id:
            continue
        record_start = interview_start(record).astimezone(timezone.utc)
        record_end = interview_end(record).astimezone(timezone.utc)
        if not overlaps(start_utc, end_utc, record_start, record_end):
            continue
        record_participants = {str(item) for item in (record.participant_ids or [])}
        if record.candidate_id == candidate_id or participant_set.intersection(record_participants):
            raise HTTPException(409, "Выбранное время занято")


def work_bounds(day: datetime):
    local_day = day.astimezone(day.tzinfo or timezone.utc)
    return (
        datetime.combine(local_day.date(), time(9, 0), tzinfo=local_day.tzinfo),
        datetime.combine(local_day.date(), time(18, 0), tzinfo=local_day.tzinfo),
    )


def slot_payload(start: datetime, end: datetime):
    return {"starts_at": start, "ends_at": end, "duration_minutes": max(0, int((end - start).total_seconds() // 60))}


def free_slots_for_day(records: list[Interview], day: datetime):
    work_start, work_end = work_bounds(day)
    busy = []
    for record in records:
        start = interview_start(record).astimezone(work_start.tzinfo)
        end = interview_end(record).astimezone(work_start.tzinfo)
        if overlaps(start, end, work_start, work_end):
            busy.append((max(start, work_start), min(end, work_end)))
    busy.sort()
    free = []
    cursor = work_start
    for start, end in busy:
        if start > cursor:
            free.append(slot_payload(cursor, start))
        if end > cursor:
            cursor = end
    if cursor < work_end:
        free.append(slot_payload(cursor, work_end))
    return [slot for slot in free if slot["duration_minutes"] >= 5]


def load_percent(records: list[Interview], start: datetime, end: datetime):
    minutes = 0
    day = start
    while day < end:
        work_start, work_end = work_bounds(day)
        minutes += int((work_end - work_start).total_seconds() // 60)
        day = day + timedelta(days=1)
    if not minutes:
        return 0
    busy = 0
    for record in records:
        record_start = interview_start(record).astimezone(start.tzinfo or timezone.utc)
        record_end = interview_end(record).astimezone(start.tzinfo or timezone.utc)
        current = start
        while current < end:
            work_start, work_end = work_bounds(current)
            if overlaps(record_start, record_end, work_start, work_end):
                busy += int((min(record_end, work_end) - max(record_start, work_start)).total_seconds() // 60)
            current = current + timedelta(days=1)
    return round(busy * 100 / minutes)


@router.get("/vacancies")
async def vacancies(company_id: UUID = Depends(get_effective_company_id), db: AsyncSession = Depends(get_db)):
    records = (await db.execute(select(Vacancy).where(Vacancy.company_id == company_id).order_by(Vacancy.created_at.desc()))).scalars().all()
    return [record_data(record) for record in records]


@router.post("/vacancies", status_code=201)
async def create_vacancy(data: VacancyCreate, company_id: UUID = Depends(get_effective_company_id), user=Depends(get_hr_or_above), db: AsyncSession = Depends(get_db)):
    if data.department_id:
        await company_record(db, Department, data.department_id, company_id)
    if data.position_id:
        position = await company_record(db, Position, data.position_id, company_id)
        if data.department_id and position.department_id and position.department_id != data.department_id:
            raise HTTPException(422, "Должность относится к другому отделу")
    record = Vacancy(company_id=company_id, created_by=user.id, **data.model_dump())
    db.add(record)
    await db.commit()
    await db.refresh(record)
    return record_data(record)


@router.patch("/vacancies/{record_id}")
async def update_vacancy(record_id: UUID, data: VacancyPatch, company_id: UUID = Depends(get_effective_company_id), db: AsyncSession = Depends(get_db)):
    record = await company_record(db, Vacancy, record_id, company_id)
    record.status = data.status
    await db.commit()
    await db.refresh(record)
    return record_data(record)


@router.get("/candidates")
async def candidates(company_id: UUID = Depends(get_effective_company_id), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(Candidate, Vacancy.title).outerjoin(Vacancy, (Candidate.vacancy_id == Vacancy.id) & (Vacancy.company_id == company_id)).where(Candidate.company_id == company_id).order_by(Candidate.updated_at.desc()))).all()
    return [{**record_data(record), "vacancy_title": title} for record, title in rows]


@router.post("/candidates", status_code=201)
async def create_candidate(data: CandidateCreate, company_id: UUID = Depends(get_effective_company_id), user=Depends(get_hr_or_above), db: AsyncSession = Depends(get_db)):
    if data.vacancy_id:
        vacancy = await company_record(db, Vacancy, data.vacancy_id, company_id)
        if vacancy.status != "open":
            raise HTTPException(409, "Вакансия не открыта")
    record = Candidate(company_id=company_id, history=[history_event("new", user.id)], **data.model_dump())
    db.add(record)
    await db.commit()
    await db.refresh(record)
    return record_data(record)


@router.get("/candidates/{record_id}")
async def candidate_detail(record_id: UUID, company_id: UUID = Depends(get_effective_company_id), db: AsyncSession = Depends(get_db)):
    return record_data(await company_record(db, Candidate, record_id, company_id))


@router.patch("/candidates/{record_id}")
async def update_candidate(record_id: UUID, data: CandidatePatch, company_id: UUID = Depends(get_effective_company_id), user=Depends(get_hr_or_above), db: AsyncSession = Depends(get_db)):
    record = await company_record(db, Candidate, record_id, company_id, lock=True)
    if record.employee_id and data.stage is not None:
        raise HTTPException(409, "Кандидат уже оформлен сотрудником")
    if data.stage and data.stage != record.stage:
        record.stage = data.stage
        record.history = [*(record.history or []), history_event(data.stage, user.id)]
    if "notes" in data.model_fields_set:
        record.notes = data.notes
    await db.commit()
    await db.refresh(record)
    return record_data(record)


@router.post("/candidates/{record_id}/hire")
async def hire_candidate(record_id: UUID, data: HireRequest, company_id: UUID = Depends(get_effective_company_id), user=Depends(get_hr_or_above), db: AsyncSession = Depends(get_db)):
    # Lock serializes retries so one candidate cannot create two employees.
    record = await company_record(db, Candidate, record_id, company_id, lock=True)
    if record.employee_id:
        return {"employee_id": record.employee_id}
    if record.stage != "offer":
        raise HTTPException(409, "Сначала переведите кандидата на этап оффера")
    vacancy = await company_record(db, Vacancy, record.vacancy_id, company_id) if record.vacancy_id else None
    employee = Employee(company_id=company_id, full_name=record.full_name, email=record.email, phone=record.phone, department_id=vacancy.department_id if vacancy else None, position_id=vacancy.position_id if vacancy else None, hire_date=data.hire_date, status=EmployeeStatus.PROBATION, weak_areas=[])
    db.add(employee)
    await db.flush()
    record.employee_id = employee.id
    record.stage = "hired"
    record.history = [*(record.history or []), history_event("hired", user.id)]
    await db.commit()
    return {"employee_id": employee.id}


@router.get("/participants")
async def participants(company_id: UUID = Depends(get_effective_company_id), db: AsyncSession = Depends(get_db)):
    records = (await db.execute(select(User).where(User.company_id == company_id, User.is_active.is_(True)).order_by(User.full_name))).scalars().all()
    return [participant_data(record) for record in records]


@router.get("/interviews")
async def interviews(start: datetime | None = None, end: datetime | None = None, company_id: UUID = Depends(get_effective_company_id), db: AsyncSession = Depends(get_db)):
    query = select(Interview, Candidate.full_name).join(Candidate, (Interview.candidate_id == Candidate.id) & (Candidate.company_id == company_id)).where(Interview.company_id == company_id)
    for bound in (start, end):
        if bound is not None and bound.tzinfo is None:
            raise HTTPException(422, "Укажите часовой пояс")
    if start and end and end <= start:
        raise HTTPException(422, "Конец периода должен быть позже начала")
    if start:
        query = query.where(Interview.starts_at >= start.astimezone(timezone.utc))
    if end:
        query = query.where(Interview.starts_at < end.astimezone(timezone.utc))
    rows = (await db.execute(query.order_by(Interview.starts_at))).all()
    return [await serialize_interview(db, record, name, company_id) for record, name in rows]


@router.get("/interviews/calendar")
async def interview_calendar(start: datetime, end: datetime, day: datetime, company_id: UUID = Depends(get_effective_company_id), db: AsyncSession = Depends(get_db)):
    for bound in (start, end, day):
        if bound.tzinfo is None:
            raise HTTPException(422, "Укажите часовой пояс")
    if end <= start:
        raise HTTPException(422, "Конец периода должен быть позже начала")
    query = select(Interview, Candidate.full_name).join(Candidate, (Interview.candidate_id == Candidate.id) & (Candidate.company_id == company_id)).where(Interview.company_id == company_id, Interview.starts_at >= start.astimezone(timezone.utc), Interview.starts_at < end.astimezone(timezone.utc)).order_by(Interview.starts_at)
    rows = (await db.execute(query)).all()
    records = [record for record, _ in rows]
    day_start = datetime.combine(day.date(), time.min, tzinfo=day.tzinfo)
    day_end = day_start + timedelta(days=1)
    day_records = [record for record in records if overlaps(interview_start(record).astimezone(day.tzinfo), interview_end(record).astimezone(day.tzinfo), day_start, day_end)]
    free = free_slots_for_day(day_records, day)
    best = max(free, key=lambda slot: slot["duration_minutes"], default=None)
    return {
        "meetings": [await serialize_interview(db, record, name, company_id) for record, name in rows],
        "day_load_percent": load_percent(day_records, day_start, day_end),
        "week_load_percent": load_percent(records, start, end),
        "free_slots": free,
        "best_slot": best,
    }


@router.post("/interviews", status_code=201)
async def create_interview(data: InterviewCreate, company_id: UUID = Depends(get_effective_company_id), user=Depends(get_hr_or_above), db: AsyncSession = Depends(get_db)):
    candidate = await company_record(db, Candidate, data.candidate_id, company_id)
    if candidate.stage in ("hired", "rejected"):
        raise HTTPException(409, "Кандидат больше не участвует в подборе")
    participant_ids = list(dict.fromkeys(data.participant_ids))
    await participants_map(db, company_id, participant_ids)
    await ensure_interview_available(db, company_id, data.candidate_id, participant_ids, data.starts_at, data.duration_minutes)
    values = data.model_dump()
    values["participant_ids"] = [str(item) for item in participant_ids]
    values["starts_at"] = data.starts_at.astimezone(timezone.utc)
    values["meeting_url"] = str(data.meeting_url) if data.meeting_url else None
    record = Interview(company_id=company_id, created_by=user.id, **values)
    db.add(record)
    await db.commit()
    await db.refresh(record)
    return await serialize_interview(db, record, candidate.full_name, company_id)


@router.patch("/interviews/{record_id}")
async def update_interview(record_id: UUID, data: InterviewPatch, company_id: UUID = Depends(get_effective_company_id), db: AsyncSession = Depends(get_db)):
    record = await company_record(db, Interview, record_id, company_id, lock=True)
    candidate = await company_record(db, Candidate, data.candidate_id or record.candidate_id, company_id)
    if candidate.stage in ("hired", "rejected"):
        raise HTTPException(409, "Кандидат больше не участвует в подборе")
    participant_ids = list(dict.fromkeys(data.participant_ids if data.participant_ids is not None else [UUID(str(item)) for item in (record.participant_ids or [])]))
    await participants_map(db, company_id, participant_ids)
    starts_at = data.starts_at or record.starts_at
    duration_minutes = data.duration_minutes or record.duration_minutes
    await ensure_interview_available(db, company_id, candidate.id, participant_ids, starts_at, duration_minutes, exclude_id=record.id)
    for field, value in data.model_dump(exclude_unset=True).items():
        if field == "starts_at" and value is not None:
            value = value.astimezone(timezone.utc)
        if field == "meeting_url" and value is not None:
            value = str(value)
        if field == "participant_ids" and value is not None:
            value = [str(item) for item in participant_ids]
        setattr(record, field, value)
    await db.commit()
    await db.refresh(record)
    return await serialize_interview(db, record, candidate.full_name, company_id)


@router.delete("/interviews/{record_id}", status_code=204)
async def cancel_interview(record_id: UUID, company_id: UUID = Depends(get_effective_company_id), db: AsyncSession = Depends(get_db)):
    record = await company_record(db, Interview, record_id, company_id)
    await db.delete(record)
    await db.commit()
    return Response(status_code=204)
