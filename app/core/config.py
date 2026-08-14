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
    user_cookie_name: str = Field(default="polytech_user", validation_alias="USER_COOKIE_NAME")
    user_cookie_max_age: int = Field(default=60 * 60 * 24 * 365, validation_alias="USER_COOKIE_MAX_AGE")
    user_cookie_secure: bool = Field(default=False, validation_alias="USER_COOKIE_SECURE")
    user_cookie_samesite: str = Field(default="lax", validation_alias="USER_COOKIE_SAMESITE")


@lru_cache
def get_settings() -> Settings:
    return Settings()
