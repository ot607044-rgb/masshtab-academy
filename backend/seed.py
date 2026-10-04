"""
Seed script — creates two test companies with admins and employees.
Run: python seed.py
"""
import asyncio
import uuid
from app.database import AsyncSessionLocal, engine, Base
from app.models import Company, User
from app.models.user import UserRole
from app.core.security import get_password_hash
from app.models.base import utc_now


async def seed():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as db:
        company1 = Company(id=uuid.uuid4(), name="Альфа Технологии", slug="alpha-tech",
                           description="Первая тестовая компания")
        company2 = Company(id=uuid.uuid4(), name="Бета Сервис", slug="beta-service",
                           description="Вторая тестовая компания")
        db.add_all([company1, company2])
        await db.flush()

        users = [
            User(id=uuid.uuid4(), email="admin@alpha-tech.ru",
                 hashed_password=get_password_hash("Admin123!"),
                 full_name="Иван Иванов", role=UserRole.COMPANY_ADMIN, company_id=company1.id, activated_at=utc_now()),
            User(id=uuid.uuid4(), email="hr@alpha-tech.ru",
                 hashed_password=get_password_hash("Hr123!"),
                 full_name="Мария Петрова", role=UserRole.HR, company_id=company1.id, activated_at=utc_now()),
            User(id=uuid.uuid4(), email="employee@alpha-tech.ru",
                 hashed_password=get_password_hash("Emp123!"),
                 full_name="Алексей Сидоров", role=UserRole.EMPLOYEE, company_id=company1.id, activated_at=utc_now()),
            User(id=uuid.uuid4(), email="admin@beta-service.ru",
                 hashed_password=get_password_hash("Admin123!"),
                 full_name="Сергей Козлов", role=UserRole.COMPANY_ADMIN, company_id=company2.id, activated_at=utc_now()),
            User(id=uuid.uuid4(), email="employee@beta-service.ru",
                 hashed_password=get_password_hash("Emp123!"),
                 full_name="Анна Новикова", role=UserRole.EMPLOYEE, company_id=company2.id, activated_at=utc_now()),
        ]
        db.add_all(users)
        await db.commit()

    print("✅ Тестовые данные созданы:")
    print("  Компания 1 — admin@alpha-tech.ru / Admin123!")
    print("  Компания 2 — admin@beta-service.ru / Admin123!")


if __name__ == "__main__":
    asyncio.run(seed())
