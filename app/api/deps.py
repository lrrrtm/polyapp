from fastapi import Request

from app.clients.ruz import RuzClient
from app.services.client import SpbstuPayClient


def get_ruz_client(request: Request) -> RuzClient:
    return request.app.state.ruz_client


def get_spbstu_pay_client(request: Request) -> SpbstuPayClient:
    return request.app.state.spbstu_pay_client
