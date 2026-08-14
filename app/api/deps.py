from fastapi import Request

from app.clients.ruz import RuzClient


def get_ruz_client(request: Request) -> RuzClient:
    return request.app.state.ruz_client

