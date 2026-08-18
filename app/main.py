from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
import asyncio
import logging
import ssl

import httpx
import truststore
from fastapi import FastAPI

from app.admissions.router import router as admissions_router
from app.admissions.service import refresh_admissions
from app.api.errors import setup_error_handlers
from app.api.v1.ruz import router as ruz_router
from app.buildings.router import router as buildings_router
from app.clients.ruz import RuzClient
from app.core.config import get_settings
from app.db.session import SessionLocal
from app.schedules.router import router as schedules_router
from app.schedules.service import refresh_saved_group_schedules
from app.users.router import router as users_router

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None]:
    settings = get_settings()
    admissions_refresh_lock = asyncio.Lock()
    schedule_refresh_lock = asyncio.Lock()
    admissions_refresh_task = None
    schedule_refresh_task = None
    if settings.admissions_refresh_enabled:
        admissions_refresh_task = asyncio.create_task(run_admissions_refresh_loop(admissions_refresh_lock))
    async with httpx.AsyncClient(
        base_url=settings.ruz_base_url,
        timeout=httpx.Timeout(settings.ruz_timeout),
        verify=truststore.SSLContext(ssl.PROTOCOL_TLS_CLIENT),
    ) as http:
        ruz_client = RuzClient(http)
        app.state.ruz_client = ruz_client
        if settings.schedule_refresh_enabled:
            schedule_refresh_task = asyncio.create_task(run_schedule_refresh_loop(schedule_refresh_lock, ruz_client))
        try:
            yield
        finally:
            if admissions_refresh_task:
                admissions_refresh_task.cancel()
                try:
                    await admissions_refresh_task
                except asyncio.CancelledError:
                    pass
            if schedule_refresh_task:
                schedule_refresh_task.cancel()
                try:
                    await schedule_refresh_task
                except asyncio.CancelledError:
                    pass


async def run_admissions_refresh_loop(refresh_lock: asyncio.Lock) -> None:
    settings = get_settings()
    while True:
        try:
            await refresh_admissions(
                settings=settings,
                session_factory=SessionLocal,
                in_process_lock=refresh_lock,
            )
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Admissions refresh failed")
        await asyncio.sleep(settings.admissions_refresh_interval_seconds)


async def run_schedule_refresh_loop(refresh_lock: asyncio.Lock, ruz_client: RuzClient) -> None:
    settings = get_settings()
    while True:
        try:
            await refresh_saved_group_schedules(
                settings=settings,
                session_factory=SessionLocal,
                ruz=ruz_client,
                in_process_lock=refresh_lock,
            )
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Schedule refresh failed")
        await asyncio.sleep(settings.schedule_refresh_interval_seconds)


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title=settings.app_name, lifespan=lifespan)
    setup_error_handlers(app)
    app.include_router(ruz_router, prefix=settings.api_v1_prefix)
    app.include_router(users_router, prefix=settings.api_v1_prefix)
    app.include_router(buildings_router, prefix=settings.api_v1_prefix)
    app.include_router(admissions_router, prefix=settings.api_v1_prefix)
    app.include_router(schedules_router, prefix=settings.api_v1_prefix)

    @app.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
