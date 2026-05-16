import asyncio
import httpx
from urllib.parse import urlencode

OVERPASS_ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://lz4.overpass-api.de/api/interpreter",
]

_HEADERS = {
    "Content-Type": "application/x-www-form-urlencoded",
    "Accept": "application/json",
    "User-Agent": "IG2HexMap/1.0",
}


async def post_overpass(query: str, timeout: float = 60.0) -> dict:
    """Try each Overpass mirror in turn; return parsed JSON on first success."""
    last_err: Exception = RuntimeError("No endpoints tried")
    async with httpx.AsyncClient(timeout=timeout) as client:
        for attempt, url in enumerate(OVERPASS_ENDPOINTS):
            try:
                resp = await client.post(
                    url,
                    content=urlencode({"data": query}).encode(),
                    headers=_HEADERS,
                )
                resp.raise_for_status()
                return resp.json()
            except Exception as exc:
                last_err = exc
                if attempt < len(OVERPASS_ENDPOINTS) - 1:
                    await asyncio.sleep(1.5)
    raise last_err
