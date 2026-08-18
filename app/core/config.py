from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Polytech Schedule API"
    api_v1_prefix: str = "/api/v1"
    database_url: str = Field(validation_alias="DATABASE_URL")
    db_echo: bool = Field(default=False, validation_alias="DB_ECHO")
    ruz_base_url: str = Field(
        default="https://ruz.spbstu.ru/api/v1/ruz/",
        validation_alias="RUZ_BASE_URL",
    )
    ruz_timeout: float = Field(default=10.0, validation_alias="RUZ_TIMEOUT")
    spbstu_base_url: str = Field(default="https://my.spbstu.ru", validation_alias="SPBSTU_BASE_URL")
    spbstu_timeout: float = Field(default=30.0, validation_alias="SPBSTU_TIMEOUT")
    spbstu_concurrency: int = Field(default=5, validation_alias="SPBSTU_CONCURRENCY")
    spbstu_sessionid: str | None = Field(default=None, validation_alias="SPBSTU_SESSIONID")
    spbstu_pay_base_url: str = Field(default="https://pay.spbstu.ru", validation_alias="SPBSTU_PAY_BASE_URL")
    spbstu_pay_timeout: float = Field(default=10.0, validation_alias="SPBSTU_PAY_TIMEOUT")
    admissions_refresh_interval_seconds: int = Field(
        default=15 * 60,
        validation_alias="ADMISSIONS_REFRESH_INTERVAL_SECONDS",
    )
    admissions_refresh_enabled: bool = Field(default=True, validation_alias="ADMISSIONS_REFRESH_ENABLED")
    schedule_refresh_interval_seconds: int = Field(
        default=15 * 60,
        validation_alias="SCHEDULE_REFRESH_INTERVAL_SECONDS",
    )
    schedule_refresh_enabled: bool = Field(default=True, validation_alias="SCHEDULE_REFRESH_ENABLED")
    schedule_refresh_concurrency: int = Field(default=4, validation_alias="SCHEDULE_REFRESH_CONCURRENCY")
    telegram_bot_token: str | None = Field(default=None, validation_alias="TELEGRAM_BOT_TOKEN")
    telegram_bot_username: str | None = Field(default=None, validation_alias="TELEGRAM_BOT_USERNAME")
    telegram_bot_enabled: bool = Field(default=False, validation_alias="TELEGRAM_BOT_ENABLED")
    telegram_outbox_poll_interval_seconds: int = Field(default=5, validation_alias="TELEGRAM_OUTBOX_POLL_INTERVAL_SECONDS")
    telegram_send_concurrency: int = Field(default=4, validation_alias="TELEGRAM_SEND_CONCURRENCY")
    user_cookie_name: str = Field(default="polytech_user", validation_alias="USER_COOKIE_NAME")
    user_cookie_max_age: int = Field(default=60 * 60 * 24 * 365, validation_alias="USER_COOKIE_MAX_AGE")
    user_cookie_secure: bool = Field(default=False, validation_alias="USER_COOKIE_SECURE")
    user_cookie_samesite: str = Field(default="lax", validation_alias="USER_COOKIE_SAMESITE")


@lru_cache
def get_settings() -> Settings:
    return Settings()
