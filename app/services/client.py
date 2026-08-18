from typing import Any

import httpx
from pydantic import ValidationError

from app.services.schemas import DormitoryPaymentLookupResponse, DormitoryPaymentPay


class SpbstuPayError(Exception):
    pass


class SpbstuPayRateLimitError(SpbstuPayError):
    pass


class SpbstuPayClient:
    def __init__(self, http: httpx.AsyncClient) -> None:
        self._http = http

    async def lookup_dormitory_payment(self, contract: str) -> DormitoryPaymentLookupResponse:
        try:
            response = await self._http.post(
                "/api/v2/pay/payer/valid",
                data={"payer_data": contract, "type": "payer_data"},
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
            if response.status_code == 429:
                raise SpbstuPayRateLimitError("SPbSTU pay lookup rate limited")
            response.raise_for_status()
            payload = response.json()
        except SpbstuPayRateLimitError:
            raise
        except httpx.HTTPError as error:
            raise SpbstuPayError(f"SPbSTU pay lookup failed: {error}") from error
        except ValueError as error:
            raise SpbstuPayError("SPbSTU pay lookup returned invalid JSON") from error

        try:
            return parse_lookup_payload(payload)
        except (IndexError, KeyError, TypeError, ValidationError) as error:
            raise SpbstuPayError("SPbSTU pay lookup returned invalid payload") from error


def parse_lookup_payload(payload: dict[str, Any]) -> DormitoryPaymentLookupResponse:
    if not isinstance(payload, dict):
        raise TypeError("payload")
    if payload.get("valid") is False:
        return DormitoryPaymentLookupResponse(valid=False)
    if payload.get("valid") is not True:
        raise KeyError("valid")

    item = payload["data"][0]
    pays = [DormitoryPaymentPay.model_validate(pay) for pay in item.get("pays") or []]
    return DormitoryPaymentLookupResponse(
        valid=True,
        contract=item.get("data"),
        payer_name=item.get("name"),
        base=item.get("base"),
        recipient=item.get("recipient"),
        department=item.get("dep"),
        account=item.get("account"),
        additional=item.get("additional"),
        amount_due=sum(pay.sum for pay in pays) if pays else None,
        pays=pays,
        data_date=item.get("data_date"),
    )
