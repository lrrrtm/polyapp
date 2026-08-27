from datetime import UTC, datetime
from html import escape
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_spbstu_pay_client
from app.api.errors import ApiError, ApiErrorCode, problem_responses
from app.core.config import get_settings
from app.db.session import get_db
from app.notifications.models import NotificationChannel, NotificationOutbox
from app.services.client import SpbstuPayClient, SpbstuPayError, SpbstuPayRateLimitError
from app.services.models import FeedbackRequest, FeedbackSubject
from app.services.schemas import DormitoryPaymentLookupRequest, DormitoryPaymentLookupResponse, FeedbackSubmissionResponse
from app.users.deps import get_current_user
from app.users.models import User

router = APIRouter(prefix="/services", tags=["services"])
MAX_FEEDBACK_ATTACHMENT_BYTES = 10 * 1024 * 1024
ALLOWED_FEEDBACK_ATTACHMENT_CONTENT_TYPES = {"application/pdf"}
ALLOWED_FEEDBACK_ATTACHMENT_CONTENT_TYPE_PREFIXES = ("image/", "video/")
FEEDBACK_SUBJECT_LABELS = {
    FeedbackSubject.COMMENT: "Комментарий",
    FeedbackSubject.QUESTION: "Вопрос",
    FeedbackSubject.BUG: "Сообщение об ошибке",
    FeedbackSubject.FEATURE: "Запрос новой функциональности",
}


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


@router.post(
    "/feedback",
    response_model=FeedbackSubmissionResponse,
    status_code=status.HTTP_201_CREATED,
    responses=problem_responses(status.HTTP_404_NOT_FOUND),
)
async def submit_feedback(
    subject: Annotated[FeedbackSubject, Form()],
    message: Annotated[str, Form(min_length=1, max_length=4000)],
    contact: Annotated[str, Form(min_length=1, max_length=200)],
    attachment: Annotated[UploadFile | None, File()] = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> FeedbackSubmissionResponse:
    message = strip_required_form_value(message, "message", 4000)
    contact = strip_required_form_value(contact, "contact", 200)
    attachment_data: bytes | None = None
    attachment_filename: str | None = None
    attachment_content_type: str | None = None
    attachment_size: int | None = None

    if attachment is not None:
        if not is_allowed_feedback_attachment_content_type(attachment.content_type):
            raise ApiError(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                code=ApiErrorCode.FEEDBACK_ATTACHMENT_TYPE_NOT_ALLOWED,
                title="Attachment type not allowed",
                message="Можно приложить только картинку, PDF или видео.",
                details={"content_type": attachment.content_type},
            )
        attachment_data = await attachment.read(MAX_FEEDBACK_ATTACHMENT_BYTES + 1)
        if len(attachment_data) > MAX_FEEDBACK_ATTACHMENT_BYTES:
            raise ApiError(
                status_code=status.HTTP_413_CONTENT_TOO_LARGE,
                code=ApiErrorCode.FEEDBACK_ATTACHMENT_TOO_LARGE,
                title="Attachment too large",
                message="Файл слишком большой. Максимальный размер — 10 МБ.",
                details={"max_size": MAX_FEEDBACK_ATTACHMENT_BYTES},
            )
        attachment_filename = attachment.filename or "attachment"
        attachment_content_type = attachment.content_type
        attachment_size = len(attachment_data)

    now = datetime.now(UTC)
    feedback = FeedbackRequest(
        user_id=user.id,
        subject=subject.value,
        message=message,
        contact=contact,
        attachment_filename=attachment_filename,
        attachment_content_type=attachment_content_type,
        attachment_size=attachment_size,
        attachment_data=attachment_data,
        created_at=now,
    )
    db.add(feedback)
    await db.flush()
    enqueue_feedback_notification(db, feedback)
    await db.flush()
    return FeedbackSubmissionResponse(id=feedback.id, created_at=feedback.created_at)


def pay_unavailable(status_code: int) -> ApiError:
    return ApiError(
        status_code=status_code,
        code=ApiErrorCode.SPBSTU_PAY_UPSTREAM_ERROR,
        title="Payment service unavailable",
        message="Сервис оплаты временно недоступен. Попробуйте позже.",
        details={"service": "spbstu_pay"},
    )


def strip_required_form_value(value: str, field_name: str, max_length: int) -> str:
    value = value.strip()
    if not value or len(value) > max_length:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=f"{field_name} is invalid")
    return value


def is_allowed_feedback_attachment_content_type(content_type: str | None) -> bool:
    if not content_type:
        return False

    content_type = content_type.lower().split(";", 1)[0].strip()
    return content_type in ALLOWED_FEEDBACK_ATTACHMENT_CONTENT_TYPES or content_type.startswith(
        ALLOWED_FEEDBACK_ATTACHMENT_CONTENT_TYPE_PREFIXES
    )


def enqueue_feedback_notification(db: AsyncSession, feedback: FeedbackRequest) -> None:
    chat_id = get_settings().feedback_telegram_chat_id
    if chat_id is None:
        return

    attachment = "нет"
    if feedback.attachment_filename:
        attachment = f"{feedback.attachment_filename} ({feedback.attachment_size or 0} байт)"

    text = "\n".join(
        [
            "<b>Новое обращение</b>",
            "",
            f"Тема: {escape(FEEDBACK_SUBJECT_LABELS[FeedbackSubject(feedback.subject)])}",
            f"Контакт: {escape(feedback.contact)}",
            f"Файл: {escape(attachment)}",
            "",
            escape(feedback.message),
        ]
    )
    db.add(
        NotificationOutbox(
            user_id=feedback.user_id,
            channel=NotificationChannel.TELEGRAM.value,
            telegram_chat_id=chat_id,
            event_type="feedback_created",
            payload={
                "feedback_id": str(feedback.id),
                "subject": feedback.subject,
                "contact": feedback.contact,
                "attachment": {
                    "filename": feedback.attachment_filename,
                    "content_type": feedback.attachment_content_type,
                    "size": feedback.attachment_size,
                },
            },
            text=text,
            dedupe_key=f"telegram:feedback:{feedback.id}",
            next_attempt_at=feedback.created_at,
            updated_at=feedback.created_at,
        )
    )
