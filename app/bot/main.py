from __future__ import annotations

import asyncio
import logging
from uuid import UUID

from aiogram import Bot, Dispatcher, Router
from aiogram.client.session.aiohttp import AiohttpSession
from aiogram.exceptions import TelegramForbiddenError, TelegramRetryAfter, TelegramAPIError
from aiogram.filters import Command, CommandObject
from aiogram.types import BufferedInputFile, Message
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.config import get_settings
from app.db.session import SessionLocal
from app.notifications.models import NotificationOutbox, TelegramAccount
from app.notifications.service import (
    claim_due_notifications,
    deactivate_telegram_chat,
    mark_notification_cancelled,
    link_telegram_account,
    mark_notification_failed,
    mark_notification_sent,
)
from app.services.models import FeedbackRequest

logger = logging.getLogger(__name__)
router = Router()


@router.message(Command("start"))
async def start(message: Message, command: CommandObject) -> None:
    token = (command.args or "").strip()
    if not token:
        await message.answer("Подключение Telegram-уведомлений нужно начать из настроек приложения.")
        return

    if not message.from_user:
        await message.answer("Не удалось определить пользователя Telegram.")
        return

    async with SessionLocal() as db:
        account = await link_telegram_account(
            db,
            token,
            telegram_user_id=message.from_user.id,
            telegram_chat_id=message.chat.id,
            telegram_username=message.from_user.username,
        )
        await db.commit()

    if account:
        await message.answer(
            "Твой Telegram успешно привязан, теперь сюда будут приходить уведомления о выбранных тобой событиях. "
            "Возвращайся в настройки, чтоб выбрать"
        )
    else:
        await message.answer("Ссылка для подключения устарела или уже использована.")


@router.message(Command("status"))
async def status(message: Message) -> None:
    async with SessionLocal() as db:
        account = await db.scalar(
            select(TelegramAccount).where(
                TelegramAccount.telegram_chat_id == message.chat.id,
                TelegramAccount.is_active.is_(True),
            )
        )
    await message.answer("Telegram-уведомления подключены." if account else "Telegram-уведомления не подключены.")


@router.message(Command("stop"))
async def stop(message: Message) -> None:
    async with SessionLocal() as db:
        await deactivate_telegram_chat(db, message.chat.id)
        await db.commit()
    await message.answer("Telegram-уведомления отключены.")


async def run_sender_loop(bot: Bot) -> None:
    settings = get_settings()
    while True:
        try:
            async with SessionLocal() as db:
                notifications = await claim_due_notifications(db, settings.telegram_send_concurrency)
                await db.commit()

            for notification in notifications:
                async with SessionLocal() as db:
                    db_notification = await db.get(type(notification), notification.id)
                    if not db_notification or db_notification.telegram_chat_id is None:
                        continue
                    try:
                        await send_telegram_notification(bot, db, db_notification)
                    except TelegramRetryAfter as error:
                        await mark_notification_failed(db, db_notification, str(error), retry_after_seconds=error.retry_after)
                    except TelegramForbiddenError as error:
                        await deactivate_telegram_chat(db, db_notification.telegram_chat_id)
                        await mark_notification_cancelled(db, db_notification, str(error))
                    except TelegramAPIError as error:
                        await mark_notification_failed(db, db_notification, str(error), retry_after_seconds=None)
                    else:
                        await mark_notification_sent(db, db_notification)
                    await db.commit()
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Telegram sender loop failed")
        await asyncio.sleep(settings.telegram_outbox_poll_interval_seconds)


async def send_telegram_notification(bot: Bot, db: AsyncSession, notification: NotificationOutbox) -> None:
    if notification.telegram_chat_id is None:
        return

    await bot.send_message(notification.telegram_chat_id, notification.text, parse_mode="HTML")
    if notification.event_type == "feedback_created":
        await send_feedback_attachment(bot, db, notification)


async def send_feedback_attachment(bot: Bot, db: AsyncSession, notification: NotificationOutbox) -> None:
    if notification.telegram_chat_id is None:
        return

    feedback_id = notification.payload.get("feedback_id")
    if not isinstance(feedback_id, str):
        return

    try:
        feedback_uuid = UUID(feedback_id)
    except ValueError:
        return

    feedback = await db.get(FeedbackRequest, feedback_uuid)
    if not feedback or not feedback.attachment_data:
        return

    filename = feedback.attachment_filename or "attachment"
    await bot.send_document(
        notification.telegram_chat_id,
        BufferedInputFile(feedback.attachment_data, filename=filename),
    )


async def main() -> None:
    settings = get_settings()
    if not settings.telegram_bot_enabled:
        logger.info("Telegram bot disabled")
        await asyncio.Event().wait()
    if not settings.telegram_bot_token:
        raise RuntimeError("TELEGRAM_BOT_TOKEN is required when TELEGRAM_BOT_ENABLED=true")

    session = AiohttpSession(proxy=settings.telegram_proxy_url) if settings.telegram_proxy_url else None
    bot = Bot(settings.telegram_bot_token, session=session)
    dispatcher = Dispatcher()
    dispatcher.include_router(router)
    sender_task = asyncio.create_task(run_sender_loop(bot))
    try:
        await dispatcher.start_polling(bot)
    finally:
        sender_task.cancel()
        try:
            await sender_task
        except asyncio.CancelledError:
            pass
        await bot.session.close()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(main())
