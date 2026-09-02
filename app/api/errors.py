from enum import StrEnum
import logging
from typing import Any
from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field
from starlette import status

logger = logging.getLogger(__name__)


class ApiErrorCode(StrEnum):
    ADMISSIONS_DATA_UNAVAILABLE = "ADMISSIONS_DATA_UNAVAILABLE"
    ACADEMIC_CALENDAR_NOT_FOUND = "ACADEMIC_CALENDAR_NOT_FOUND"
    APPLICANT_CODE_NOT_FOUND = "APPLICANT_CODE_NOT_FOUND"
    APPLICANT_CODE_NOT_SET = "APPLICANT_CODE_NOT_SET"
    FAVORITE_NOT_FOUND = "FAVORITE_NOT_FOUND"
    FEEDBACK_ATTACHMENT_TOO_LARGE = "FEEDBACK_ATTACHMENT_TOO_LARGE"
    FEEDBACK_ATTACHMENT_TYPE_NOT_ALLOWED = "FEEDBACK_ATTACHMENT_TYPE_NOT_ALLOWED"
    RUZ_GROUP_NOT_FOUND = "RUZ_GROUP_NOT_FOUND"
    RUZ_TEACHER_NOT_FOUND = "RUZ_TEACHER_NOT_FOUND"
    RUZ_RESOURCE_NOT_FOUND = "RUZ_RESOURCE_NOT_FOUND"
    RUZ_UPSTREAM_ERROR = "RUZ_UPSTREAM_ERROR"
    SCHEDULE_ITEM_NOT_FOUND = "SCHEDULE_ITEM_NOT_FOUND"
    SPBSTU_PAY_UPSTREAM_ERROR = "SPBSTU_PAY_UPSTREAM_ERROR"
    TELEGRAM_BOT_UNAVAILABLE = "TELEGRAM_BOT_UNAVAILABLE"
    USER_NOT_FOUND = "USER_NOT_FOUND"


PROBLEM_MEDIA_TYPE = "application/problem+json"

ERROR_RESPONSE_DESCRIPTIONS = {
    status.HTTP_404_NOT_FOUND: "Resource was not found.",
    status.HTTP_502_BAD_GATEWAY: "Upstream schedule service failed.",
    status.HTTP_503_SERVICE_UNAVAILABLE: "Service data is temporarily unavailable.",
}

ERROR_RESPONSE_EXAMPLES = {
    status.HTTP_404_NOT_FOUND: {
        "not_found": {
            "summary": "Referenced schedule item does not exist",
            "value": {
                "type": "https://polytech.local/errors/ruz-group-not-found",
                "title": "Group not found",
                "status": 404,
                "code": "RUZ_GROUP_NOT_FOUND",
                "message": "Группа не найдена в расписании Политеха.",
                "request_id": "8bb2d4c84b804948a763c74b82f13b2e",
                "details": {"service": "ruz", "resource": "group", "ruz_id": 42828},
            },
        }
    },
    status.HTTP_502_BAD_GATEWAY: {
        "upstream_error": {
            "summary": "RUZ is unavailable or returned invalid data",
            "value": {
                "type": "https://polytech.local/errors/ruz-upstream-error",
                "title": "Schedule service unavailable",
                "status": 502,
                "code": "RUZ_UPSTREAM_ERROR",
                "message": "Сервис расписания временно недоступен. Попробуйте позже.",
                "request_id": "8bb2d4c84b804948a763c74b82f13b2e",
                "details": {"service": "ruz"},
            },
        }
    },
    status.HTTP_503_SERVICE_UNAVAILABLE: {
        "data_unavailable": {
            "summary": "Admissions data has not been loaded yet",
            "value": {
                "type": "https://polytech.local/errors/admissions-data-unavailable",
                "title": "Admissions data unavailable",
                "status": 503,
                "code": "ADMISSIONS_DATA_UNAVAILABLE",
                "message": "Данные конкурсных списков пока недоступны. Попробуйте позже.",
                "request_id": "8bb2d4c84b804948a763c74b82f13b2e",
                "details": {"service": "spbstu_admissions"},
            },
        }
    },
}


class ErrorResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    type: str
    title: str
    status: int
    code: ApiErrorCode
    message: str
    request_id: str
    details: dict[str, Any] = Field(default_factory=dict)


class ApiError(Exception):
    def __init__(
        self,
        *,
        status_code: int,
        code: ApiErrorCode,
        message: str,
        title: str | None = None,
        details: dict[str, Any] | None = None,
    ) -> None:
        self.status_code = status_code
        self.code = code
        self.message = message
        self.title = title or code.value.replace("_", " ").title()
        self.details = details or {}


def problem_responses(*status_codes: int) -> dict[int, dict[str, Any]]:
    return {
        status_code: {
            "description": ERROR_RESPONSE_DESCRIPTIONS[status_code],
            "content": {
                PROBLEM_MEDIA_TYPE: {
                    "schema": {"$ref": "#/components/schemas/ErrorResponse"},
                    "examples": ERROR_RESPONSE_EXAMPLES[status_code],
                }
            },
        }
        for status_code in status_codes
    }


def setup_error_handlers(app: FastAPI) -> None:
    original_openapi = app.openapi

    def custom_openapi() -> dict[str, Any]:
        if app.openapi_schema:
            return app.openapi_schema

        schema = original_openapi()
        schemas = schema.setdefault("components", {}).setdefault("schemas", {})
        error_schema = ErrorResponse.model_json_schema(ref_template="#/components/schemas/{model}")
        for name, definition in error_schema.pop("$defs", {}).items():
            schemas.setdefault(name, definition)
        schemas.setdefault("ErrorResponse", error_schema)
        app.openapi_schema = schema
        return app.openapi_schema

    app.openapi = custom_openapi  # type: ignore[method-assign]

    @app.middleware("http")
    async def request_id_middleware(request: Request, call_next: Any) -> Any:
        request_id = request.headers.get("X-Request-ID") or uuid4().hex
        request.state.request_id = request_id[:128]
        response = await call_next(request)
        response.headers["X-Request-ID"] = request.state.request_id
        return response

    @app.exception_handler(ApiError)
    async def api_error_handler(request: Request, error: ApiError) -> JSONResponse:
        request_id = getattr(request.state, "request_id", uuid4().hex)
        if error.status_code >= status.HTTP_500_INTERNAL_SERVER_ERROR:
            logger.warning(
                "Handled API error",
                extra={
                    "request_id": request_id,
                    "code": error.code.value,
                    "details": error.details,
                },
                exc_info=error.__cause__,
            )

        body = ErrorResponse(
            type=f"https://polytech.local/errors/{error.code.value.lower().replace('_', '-')}",
            title=error.title,
            status=error.status_code,
            code=error.code,
            message=error.message,
            request_id=request_id,
            details=error.details,
        )
        return JSONResponse(
            status_code=error.status_code,
            content=body.model_dump(mode="json"),
            media_type="application/problem+json",
        )
