import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.employee_photos import PublicUploads
from sqlalchemy import select
from app.database import engine, AsyncSessionLocal
from app.models import Company, User  # noqa: ensures all models are registered
from app.models.user import UserRole
from app.core.security import get_password_hash
from app.models.base import utc_now
from app.config import settings
from app.api.v1 import auth, companies, users, departments, positions, employees, knowledge, lessons, assignments, support, tests, notifications, analytics, custom_fields, custom_sections, statuses, integrations
import uuid
from app.api.v1 import recruitment, workspace, access


async def _create_superadmin() -> None:
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.role == UserRole.SUPER_ADMIN))
        if result.scalar_one_or_none():
            return
        superadmin = User(
            id=uuid.uuid4(),
            email=settings.FIRST_SUPERADMIN_EMAIL,
            hashed_password=get_password_hash(settings.FIRST_SUPERADMIN_PASSWORD),
            full_name="Super Administrator",
            role=UserRole.SUPER_ADMIN,
            is_active=True,
            activated_at=utc_now(),
        )
        db.add(superadmin)
        await db.commit()
        print(f"✅ Super Admin создан: {settings.FIRST_SUPERADMIN_EMAIL}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    os.makedirs(settings.UPLOADS_DIR, exist_ok=True)
    await _create_superadmin()
    yield
    await engine.dispose()


app = FastAPI(
    title="Академия Масштаба",
    version="1.0.0",
    description="SaaS-платформа для корпоративного обучения",
    lifespan=lifespan,
)

# В dev - разрешаем localhost; в prod - nginx проксирует запросы same-origin,
# но ALLOWED_ORIGINS можно задать через env на случай прямого обращения к API
_raw_origins = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:3000,http://localhost:5173"
)
_origins = [o.strip() for o in _raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*", "X-Support-Session"],
)

# Serve uploaded files statically
os.makedirs(settings.UPLOADS_DIR, exist_ok=True)
app.mount("/uploads", PublicUploads(directory=settings.UPLOADS_DIR), name="uploads")

app.include_router(auth.router,        prefix="/api/v1/auth",        tags=["auth"])
app.include_router(companies.router,   prefix="/api/v1/companies",   tags=["companies"])
app.include_router(users.router,       prefix="/api/v1/users",       tags=["users"])
app.include_router(departments.router, prefix="/api/v1/departments", tags=["departments"])
app.include_router(positions.router,   prefix="/api/v1/positions",   tags=["positions"])
app.include_router(employees.router,   prefix="/api/v1/employees",   tags=["employees"])
app.include_router(knowledge.router,   prefix="/api/v1/knowledge",   tags=["knowledge"])
app.include_router(lessons.router,     prefix="/api/v1/lessons",     tags=["lessons"])
app.include_router(assignments.router, prefix="/api/v1/assignments", tags=["assignments"])
app.include_router(support.router,       prefix="/api/v1/support",        tags=["support"])
app.include_router(tests.router,         prefix="/api/v1/tests",          tags=["tests"])
app.include_router(notifications.router, prefix="/api/v1/notifications",  tags=["notifications"])
app.include_router(analytics.router,     prefix="/api/v1/analytics",      tags=["analytics"])
app.include_router(custom_fields.router,   prefix="/api/v1/custom-fields",   tags=["custom-fields"])
app.include_router(custom_sections.router, prefix="/api/v1/custom-sections", tags=["custom-sections"])
app.include_router(statuses.router,        prefix="/api/v1/statuses",         tags=["statuses"])
app.include_router(integrations.router,    prefix="/api/v1/integrations",     tags=["integrations"])
app.include_router(recruitment.router, prefix="/api/v1/recruitment", tags=["recruitment"])
app.include_router(workspace.router, prefix="/api/v1/workspace", tags=["workspace"])
app.include_router(access.router, prefix="/api/v1/access", tags=["access"])


@app.get("/health", tags=["system"])
async def health():
    return {"status": "ok", "service": "Академия Масштаба"}
