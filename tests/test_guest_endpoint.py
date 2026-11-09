"""Tests for the guest session HTTP endpoint (POST /api/auth/guest-session)."""

from __future__ import annotations

from datetime import datetime, timezone
from fastapi.testclient import TestClient
import pytest

from app.config import Settings
from app.main import create_app
from app.services.guest_service import GuestSessionService


@pytest.fixture
def guest_app():
    """Create a test application instance with custom guest settings."""
    settings = Settings(
        guest_session_ttl_minutes=60,
        guest_max_documents=1,
        guest_max_questions=5,
        guest_issuance_rate_limit=3,  # Strict limit for testing 429
    )
    guest_service = GuestSessionService(settings=settings)
    app = create_app(settings=settings, guest_service=guest_service)
    return app


def test_create_guest_session_endpoint_success(guest_app):
    """Verify POST /api/auth/guest-session returns 201 and valid response structure."""
    client = TestClient(guest_app)
    response = client.post("/api/auth/guest-session")
    assert response.status_code == 201

    data = response.json()
    assert "guest_token" in data
    assert data["guest_token"].startswith("gstd_")
    assert data["max_documents"] == 1
    assert data["max_questions"] == 5

    # Verify expires_at is ISO string and in the future
    expires_at = datetime.fromisoformat(data["expires_at"].replace("Z", "+00:00"))
    now = datetime.now(timezone.utc)
    assert expires_at > now


def test_create_guest_session_with_forwarded_for(guest_app):
    """Verify client IP extraction from X-Forwarded-For header."""
    client = TestClient(guest_app)
    response = client.post(
        "/api/auth/guest-session",
        headers={"X-Forwarded-For": "203.0.113.195, 70.41.3.18"},
    )
    assert response.status_code == 201
    assert response.json()["guest_token"].startswith("gstd_")


def test_create_guest_session_rate_limit_exceeded(guest_app):
    """Verify endpoint returns 429 Too Many Requests when rate limit is exceeded."""
    client = TestClient(guest_app)
    headers = {"X-Forwarded-For": "198.51.100.42"}

    # Limit is 3 per minute
    for _ in range(3):
        res = client.post("/api/auth/guest-session", headers=headers)
        assert res.status_code == 201

    # 4th request must return 429
    res_limited = client.post("/api/auth/guest-session", headers=headers)
    assert res_limited.status_code == 429
    assert "limit exceeded" in res_limited.json()["detail"].lower()

    # Different IP should not be blocked
    res_other = client.post(
        "/api/auth/guest-session",
        headers={"X-Forwarded-For": "198.51.100.43"},
    )
    assert res_other.status_code == 201
