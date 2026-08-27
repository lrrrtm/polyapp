from uuid import UUID

import httpx
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from app.api.deps import get_spbstu_pay_client
from app.core.config import get_settings
from app.main import app
from app.notifications.models import NotificationOutbox
from app.services.client import SpbstuPayClient, SpbstuPayError, SpbstuPayRateLimitError
from app.services.models import FeedbackRequest
from app.services.router import MAX_FEEDBACK_ATTACHMENT_BYTES
from app.services.schemas import DormitoryPaymentLookupResponse


VALID_PAYLOAD = {
    "data": [
        {
            "name": "Сафронов Александр Дмитриевич",
            "data": "СТГ-0005005/25",
            "base": "Оплата за общежитие",
            "recipient": "Сафронов Александр Дмитриевич",
            "dep": "СПбПУ",
            "account": "271201000",
            "additional": "Общежитие № 6, г. Санкт-Петербург ул. Харченко, д.16 ",
            "pays": [
                {"name": "задолженность", "type": "pay", "sum": 871.23},
                {"name": "текущий месяц", "type": "pay", "sum": 100.0},
            ],
            "data_date": None,
        }
    ],
    "status": "done",
    "valid": True,
}


@pytest.mark.asyncio
async def test_pay_client_returns_valid_lookup() -> None:
    client = make_pay_client(httpx.Response(200, json=VALID_PAYLOAD))

    result = await client.lookup_dormitory_payment("СТГ-0005005/25")

    assert result.valid is True
    assert result.contract == "СТГ-0005005/25"
    assert result.payer_name == "Сафронов Александр Дмитриевич"
    assert result.base == "Оплата за общежитие"
    assert result.department == "СПбПУ"
    assert result.amount_due == 971.23
    assert len(result.pays) == 2


@pytest.mark.asyncio
async def test_pay_client_returns_invalid_lookup() -> None:
    client = make_pay_client(httpx.Response(200, json={"data": [], "status": "done", "valid": False}))

    result = await client.lookup_dormitory_payment("СТГ-0005005/25")

    assert result == DormitoryPaymentLookupResponse(valid=False)


@pytest.mark.asyncio
async def test_pay_client_maps_http_error() -> None:
    client = make_pay_client(httpx.Response(500, text="fail"))

    with pytest.raises(SpbstuPayError):
        await client.lookup_dormitory_payment("СТГ-0005005/25")


@pytest.mark.asyncio
async def test_pay_client_maps_rate_limit() -> None:
    client = make_pay_client(httpx.Response(429, text="rate limited"))

    with pytest.raises(SpbstuPayRateLimitError):
        await client.lookup_dormitory_payment("СТГ-0005005/25")


@pytest.mark.asyncio
async def test_pay_client_maps_invalid_payload() -> None:
    client = make_pay_client(httpx.Response(200, json={"valid": True, "data": []}))

    with pytest.raises(SpbstuPayError):
        await client.lookup_dormitory_payment("СТГ-0005005/25")


@pytest.mark.asyncio
async def test_dormitory_lookup_requires_user(override_db: None) -> None:
    app.dependency_overrides[get_spbstu_pay_client] = lambda: FakePayClient()
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post("/api/v1/services/dormitory-payment/lookup", json={"contract": "СТГ-0005005/25"})
    finally:
        app.dependency_overrides.pop(get_spbstu_pay_client, None)

    assert response.status_code == 404
    assert response.json()["code"] == "USER_NOT_FOUND"


@pytest.mark.asyncio
async def test_dormitory_lookup_validates_contract(override_db: None) -> None:
    app.dependency_overrides[get_spbstu_pay_client] = lambda: FakePayClient()
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            await client.post("/api/v1/me")
            response = await client.post("/api/v1/services/dormitory-payment/lookup", json={"contract": "   "})
    finally:
        app.dependency_overrides.pop(get_spbstu_pay_client, None)

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_dormitory_lookup_returns_payload(override_db: None) -> None:
    app.dependency_overrides[get_spbstu_pay_client] = lambda: FakePayClient()
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            await client.post("/api/v1/me")
            response = await client.post("/api/v1/services/dormitory-payment/lookup", json={"contract": "СТГ-0005005/25"})
    finally:
        app.dependency_overrides.pop(get_spbstu_pay_client, None)

    assert response.status_code == 200
    assert response.json()["valid"] is True
    assert response.json()["amount_due"] == 871.23


@pytest.mark.asyncio
async def test_feedback_requires_user(override_db: None) -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/api/v1/services/feedback",
            data={"subject": "comment", "message": "Привет", "contact": "@student"},
        )

    assert response.status_code == 404
    assert response.json()["code"] == "USER_NOT_FOUND"


@pytest.mark.asyncio
async def test_feedback_saves_valid_submission_without_file(override_db: None, db_session) -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        await client.post("/api/v1/me")
        response = await client.post(
            "/api/v1/services/feedback",
            data={"subject": "question", "message": "  Как дела?  ", "contact": "  @student  "},
        )

    assert response.status_code == 201
    feedback = await db_session.get(FeedbackRequest, UUID(response.json()["id"]))
    assert feedback is not None
    assert feedback.subject == "question"
    assert feedback.message == "Как дела?"
    assert feedback.contact == "@student"
    assert feedback.attachment_data is None


@pytest.mark.asyncio
async def test_feedback_saves_attachment(override_db: None, db_session) -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        await client.post("/api/v1/me")
        response = await client.post(
            "/api/v1/services/feedback",
            data={"subject": "bug", "message": "Сломалось", "contact": "mail@example.com"},
            files={"attachment": ("screen.png", b"hello", "image/png")},
        )

    assert response.status_code == 201
    feedback = await db_session.get(FeedbackRequest, UUID(response.json()["id"]))
    assert feedback is not None
    assert feedback.attachment_filename == "screen.png"
    assert feedback.attachment_content_type == "image/png"
    assert feedback.attachment_size == 5
    assert feedback.attachment_data == b"hello"


@pytest.mark.asyncio
async def test_feedback_rejects_large_attachment(override_db: None) -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        await client.post("/api/v1/me")
        response = await client.post(
            "/api/v1/services/feedback",
            data={"subject": "bug", "message": "Сломалось", "contact": "mail@example.com"},
            files={"attachment": ("large.png", b"x" * (MAX_FEEDBACK_ATTACHMENT_BYTES + 1), "image/png")},
        )

    assert response.status_code == 413
    assert response.json()["code"] == "FEEDBACK_ATTACHMENT_TOO_LARGE"


@pytest.mark.asyncio
async def test_feedback_rejects_unsupported_attachment_type(override_db: None) -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        await client.post("/api/v1/me")
        response = await client.post(
            "/api/v1/services/feedback",
            data={"subject": "bug", "message": "Сломалось", "contact": "mail@example.com"},
            files={"attachment": ("notes.txt", b"hello", "text/plain")},
        )

    assert response.status_code == 415
    assert response.json()["code"] == "FEEDBACK_ATTACHMENT_TYPE_NOT_ALLOWED"


@pytest.mark.asyncio
async def test_feedback_validates_required_fields(override_db: None) -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        await client.post("/api/v1/me")
        response = await client.post(
            "/api/v1/services/feedback",
            data={"subject": "comment", "message": "   ", "contact": "   "},
        )

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_feedback_enqueues_telegram_notification(override_db: None, db_session) -> None:
    settings = get_settings()
    old_chat_id = settings.feedback_telegram_chat_id
    settings.feedback_telegram_chat_id = 2002
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            await client.post("/api/v1/me")
            response = await client.post(
                "/api/v1/services/feedback",
                data={"subject": "feature", "message": "Добавьте виджет", "contact": "vk.com/student"},
            )
    finally:
        settings.feedback_telegram_chat_id = old_chat_id

    assert response.status_code == 201
    notification = await db_session.scalar(select(NotificationOutbox).where(NotificationOutbox.event_type == "feedback_created"))
    assert notification is not None
    assert notification.telegram_chat_id == 2002
    assert notification.payload["feedback_id"] == response.json()["id"]
    assert "Добавьте виджет" in notification.text


def make_pay_client(response: httpx.Response) -> SpbstuPayClient:
    async def handler(request: httpx.Request) -> httpx.Response:
        assert request.method == "POST"
        assert request.url.path == "/api/v2/pay/payer/valid"
        assert request.content == b"payer_data=%D0%A1%D0%A2%D0%93-0005005%2F25&type=payer_data"
        return response

    return SpbstuPayClient(httpx.AsyncClient(base_url="https://pay.spbstu.ru", transport=httpx.MockTransport(handler)))


class FakePayClient:
    async def lookup_dormitory_payment(self, contract: str) -> DormitoryPaymentLookupResponse:
        assert contract == "СТГ-0005005/25"
        return DormitoryPaymentLookupResponse(
            valid=True,
            contract=contract,
            payer_name="Сафронов Александр Дмитриевич",
            base="Оплата за общежитие",
            amount_due=871.23,
        )
