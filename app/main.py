from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
import ssl

import httpx
import truststore
from fastapi import FastAPI

from app.api.errors import setup_error_handlers
from app.api.v1.ruz import router as ruz_router
from app.buildings.router import router as buildings_router
from app.clients.ruz import RuzClient
from app.core.config import get_settings
from app.users.router import router as users_router


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None]:
    settings = get_settings()
    async with httpx.AsyncClient(
        base_url=settings.ruz_base_url,
        timeout=httpx.Timeout(settings.ruz_timeout),
        verify=truststore.SSLContext(ssl.PROTOCOL_TLS_CLIENT),
    ) as http:
        app.state.ruz_client = RuzClient(http)
        yield


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title=settings.app_name, lifespan=lifespan)
    setup_error_handlers(app)
    app.include_router(ruz_router, prefix=settings.api_v1_prefix)
    app.include_router(users_router, prefix=settings.api_v1_prefix)
    app.include_router(buildings_router, prefix=settings.api_v1_prefix)

    @app.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
