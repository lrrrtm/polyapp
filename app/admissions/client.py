from __future__ import annotations

import asyncio
import logging
import ssl
from typing import Any

import httpx
import truststore


logger = logging.getLogger(__name__)


class SpbstuAdmissionsClient:
    def __init__(
        self,
        *,
        base_url: str,
        timeout: float,
        sessionid: str | None = None,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self.sessionid = sessionid
        self._client: httpx.AsyncClient | None = None

    async def __aenter__(self) -> "SpbstuAdmissionsClient":
        self._client = self._make_client()
        return self

    async def __aexit__(self, *args: object) -> None:
        if self._client:
            await self._client.aclose()
        self._client = None

    async def get_code_list(self, level: str, form: str, condition: str) -> list[dict[str, Any]]:
        data = await self._post(
            "/home/get-code-list",
            {"id_1": form, "id_2": condition, "education_level": level},
        )
        return data.get("code_list", [])

    async def get_direction_info(self, level: str, program_id: int, condition: str) -> dict[str, Any]:
        data = await self._post(
            "/home/get-direction-info",
            {"id_3": str(program_id), "education_level": level, "condition": condition},
        )
        return data[0] if data else {}

    async def get_applicant_list(
        self,
        level: str,
        form: str,
        condition: str,
        program_id: int,
    ) -> list[dict[str, Any]]:
        data = await self._get(
            "/home/get-abit-list",
            params={
                "filter_1": form,
                "filter_2": condition,
                "filter_3": str(program_id),
                "education_level": level,
            },
        )
        return data.get("results", [])

    async def _post(self, path: str, json: dict[str, Any]) -> Any:
        async def send() -> httpx.Response:
            if self._client:
                return await self._client.post(path, json=json)
            async with self._make_client() as client:
                return await client.post(path, json=json)

        response = await self._request_with_retries("POST", path, send)
        return response.json()

    async def _get(self, path: str, params: dict[str, str]) -> Any:
        async def send() -> httpx.Response:
            if self._client:
                return await self._client.get(path, params=params)
            async with self._make_client() as client:
                return await client.get(path, params=params)

        response = await self._request_with_retries("GET", path, send)
        return response.json()

    async def _request_with_retries(self, method: str, path: str, send) -> httpx.Response:
        last_error: Exception | None = None
        for attempt in range(1, 4):
            try:
                response = await send()
                response.raise_for_status()
                return response
            except httpx.HTTPError as exc:
                last_error = exc
                if attempt == 3:
                    break
                logger.warning("%s %s failed attempt=%s; retrying: %s", method, path, attempt, exc)
                await asyncio.sleep(0.5 * attempt)
        if last_error:
            raise last_error
        raise RuntimeError(f"{method} {path} failed without an exception")

    def _make_client(self) -> httpx.AsyncClient:
        headers = {
            "Accept": "*/*",
            "Content-Type": "application/json",
            "Origin": self.base_url,
            "Referer": f"{self.base_url}/",
            "X-CSRFToken": "undefined",
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/151.0.0.0 Safari/537.36"
            ),
        }
        if self.sessionid:
            headers["Cookie"] = f"sessionid={self.sessionid}"
        return httpx.AsyncClient(
            base_url=self.base_url,
            headers=headers,
            timeout=self.timeout,
            verify=truststore.SSLContext(ssl.PROTOCOL_TLS_CLIENT),
            follow_redirects=True,
        )
