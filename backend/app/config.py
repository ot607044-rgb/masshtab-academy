from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/masshtab_academy"
    SECRET_KEY: str = "change-me-in-production-use-long-random-string"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24

    FIRST_SUPERADMIN_EMAIL: str = "superadmin@masshtab.ru"
    FIRST_SUPERADMIN_PASSWORD: str = "SuperAdmin123!"

    UPLOADS_DIR: str = "uploads"

    # Приглашения сотрудников. Без SMTP администратор копирует ссылку вручную.
    INVITATION_TTL_HOURS: int = 72
    PUBLIC_APP_URL: str = ""
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = ""
    SMTP_STARTTLS: bool = True

    model_config = SettingsConfigDict(env_file=".env")


settings = Settings()
