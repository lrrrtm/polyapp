from fastapi import APIRouter, Depends, status

from app.api.deps import get_spbstu_pay_client
from app.api.errors import ApiError, ApiErrorCode, problem_responses
from app.services.client import SpbstuPayClient, SpbstuPayError, SpbstuPayRateLimitError
from app.services.schemas import DormitoryPaymentLookupRequest, DormitoryPaymentLookupResponse
from app.users.deps import get_current_user
from app.users.models import User

router = APIRouter(prefix="/services", tags=["services"])


@router.post(
    "/dormitory-payment/lookup",
    response_model=DormitoryPaymentLookupResponse,
    responses=problem_responses(status.HTTP_404_NOT_FOUND, status.HTTP_502_BAD_GATEWAY, status.HTTP_503_SERVICE_UNAVAILABLE),
)
async def lookup_dormitory_payment(
    payload: DormitoryPaymentLookupRequest,
    user: User = Depends(get_current_user),
    pay: SpbstuPayClient = Depends(get_spbstu_pay_client),
) -> DormitoryPaymentLookupResponse:
    _ = user
    try:
        return await pay.lookup_dormitory_payment(payload.contract)
    except SpbstuPayRateLimitError as error:
        raise pay_unavailable(status.HTTP_503_SERVICE_UNAVAILABLE) from error
    except SpbstuPayError as error:
        raise pay_unavailable(status.HTTP_502_BAD_GATEWAY) from error


def pay_unavailable(status_code: int) -> ApiError:
    return ApiError(
        status_code=status_code,
        code=ApiErrorCode.SPBSTU_PAY_UPSTREAM_ERROR,
        title="Payment service unavailable",
        message="Сервис оплаты временно недоступен. Попробуйте позже.",
        details={"service": "spbstu_pay"},
    )
