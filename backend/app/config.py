from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/masshtab_academy"
    SECRET_KEY: str = "change-me-in-production-use-long-random-string"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24

    FIRST_SUPERADMIN_EMAIL: str = "superadmin@masshtab.ru"
    FIRST_SUPERADMIN_PASSWORD: str = "SuperAdmin123!"

    UPLOADS_DIR: str = "uploads"

    class Config:
        env_file = ".env"


settings = Settings()
