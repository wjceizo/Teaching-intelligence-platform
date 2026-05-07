from __future__ import annotations

from httpx import ASGITransport, AsyncClient

from app.main import app


async def test_health_check_returns_ok() -> None:
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.get("/health")

    assert response.status_code == 200
    payload = response.json()
    assert "data" in payload
    assert payload["data"]["status"] == "ok"
    assert "version" in payload["data"]
