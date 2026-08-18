import httpx
import pytest
from httpx import ASGITransport, AsyncClient

from app.api.deps import get_spbstu_pay_client
from app.main import app
from app.services.client import SpbstuPayClient, SpbstuPayError, SpbstuPayRateLimitError
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
