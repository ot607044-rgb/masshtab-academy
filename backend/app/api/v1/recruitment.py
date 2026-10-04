from datetime import datetime, timezone
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
from app.schemas.recruitment import CandidateCreate, CandidatePatch, HireRequest, InterviewCreate, VacancyCreate, VacancyPatch

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
    return [{**record_data(record), "starts_at": record.starts_at.replace(tzinfo=timezone.utc) if record.starts_at.tzinfo is None else record.starts_at, "candidate_name": name} for record, name in rows]


@router.post("/interviews", status_code=201)
async def create_interview(data: InterviewCreate, company_id: UUID = Depends(get_effective_company_id), user=Depends(get_hr_or_above), db: AsyncSession = Depends(get_db)):
    candidate = await company_record(db, Candidate, data.candidate_id, company_id)
    if candidate.stage in ("hired", "rejected"):
        raise HTTPException(409, "Кандидат больше не участвует в подборе")
    values = data.model_dump()
    values["starts_at"] = data.starts_at.astimezone(timezone.utc)
    values["meeting_url"] = str(data.meeting_url) if data.meeting_url else None
    record = Interview(company_id=company_id, created_by=user.id, **values)
    db.add(record)
    await db.commit()
    await db.refresh(record)
    return record_data(record)


@router.delete("/interviews/{record_id}", status_code=204)
async def cancel_interview(record_id: UUID, company_id: UUID = Depends(get_effective_company_id), db: AsyncSession = Depends(get_db)):
    record = await company_record(db, Interview, record_id, company_id)
    await db.delete(record)
    await db.commit()
    return Response(status_code=204)
