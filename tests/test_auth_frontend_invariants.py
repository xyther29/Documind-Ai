"""Integration tests for frontend-backend authentication invariants and security boundaries."""

import time
import uuid
import jwt
import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from app.services.guest_service import GuestSessionService
from app.services.storage_service import UserPartitionedStore


TEST_SECRET = "super-secret-key-32-chars-minimum-safe!!"
TEST_SETTINGS = Settings(
    supabase_jwt_secret=TEST_SECRET,
    supabase_jwt_algorithm="HS256",
    supabase_jwt_audience="authenticated",
    guest_max_documents=1,
    guest_max_questions=2,
)


@pytest.fixture
def auth_app():
    store = UserPartitionedStore()
    guest_svc = GuestSessionService(settings=TEST_SETTINGS)
    return create_app(store=store, guest_service=guest_svc, settings=TEST_SETTINGS)


def test_invalid_bearer_never_downgrades_to_guest(auth_app):
    """Verify that providing an invalid Bearer token strictly fails with 401 Unauthorized,
    even if a valid X-Guest-Session header is concurrently provided.
    """
    client = TestClient(auth_app)

    # 1. Issue a valid guest session
    guest_resp = client.post("/api/auth/guest-session")
    assert guest_resp.status_code == 201
    guest_token = guest_resp.json()["guest_token"]

    # 2. Call document endpoint with invalid Bearer AND valid guest token
    invalid_bearer = "Bearer invalid.jwt.token"
    resp = client.get(
        "/api/documents",
        headers={
            "Authorization": invalid_bearer,
            "X-Guest-Session": guest_token,
        },
    )
    # Must fail with 401 and never fall back to guest session
    assert resp.status_code == 401
    assert "Invalid Supabase token" in resp.json()["detail"] or "token" in resp.json()["detail"].lower()


def test_expired_bearer_strictly_rejected_with_401(auth_app):
    """Verify that an expired Bearer token strictly returns 401 without guest fallback."""
    client = TestClient(auth_app)
    expired_token = jwt.encode(
        {"sub": str(uuid.uuid4()), "aud": "authenticated", "exp": time.time() - 3600},
        TEST_SECRET,
        algorithm="HS256",
    )
    resp = client.get(
        "/api/documents",
        headers={"Authorization": f"Bearer {expired_token}"},
    )
    assert resp.status_code == 401
    assert "expired" in resp.json()["detail"].lower()


def test_credential_separation_between_app_and_demo_partitions(auth_app, make_pdf):
    """Verify partition isolation between authenticated user (/app) and guest (/demo)."""
    client = TestClient(auth_app)

    # User 1: Authenticated
    user_id = str(uuid.uuid4())
    user_token = jwt.encode(
        {"sub": user_id, "aud": "authenticated", "exp": time.time() + 3600},
        TEST_SECRET,
        algorithm="HS256",
    )
    pdf_user = make_pdf(["Authenticated user confidential data."])
    upload_user = client.post(
        "/api/documents/upload",
        headers={"Authorization": f"Bearer {user_token}"},
        files={"file": ("user_doc.pdf", pdf_user, "application/pdf")},
    )
    assert upload_user.status_code == 201
    user_doc_id = upload_user.json()["doc_id"]

    # User 2: Guest demo
    guest_resp = client.post("/api/auth/guest-session")
    guest_token = guest_resp.json()["guest_token"]
    pdf_guest = make_pdf(["Guest demo public sample data."])
    upload_guest = client.post(
        "/api/documents/upload",
        headers={"X-Guest-Session": guest_token},
        files={"file": ("guest_doc.pdf", pdf_guest, "application/pdf")},
    )
    assert upload_guest.status_code == 201
    guest_doc_id = upload_guest.json()["doc_id"]

    # Guest cannot see authenticated document
    guest_list = client.get("/api/documents", headers={"X-Guest-Session": guest_token}).json()
    assert len(guest_list["documents"]) == 1
    assert guest_list["documents"][0]["doc_id"] == guest_doc_id

    # Authenticated user cannot see guest document
    user_list = client.get("/api/documents", headers={"Authorization": f"Bearer {user_token}"}).json()
    assert len(user_list["documents"]) == 1
    assert user_list["documents"][0]["doc_id"] == user_doc_id

    # Cross-lookup returns 404
    cross_search = client.post(
        "/api/documents/search",
        headers={"X-Guest-Session": guest_token},
        json={"query": "confidential", "doc_id": user_doc_id},
    )
    assert cross_search.status_code == 404


def test_403_quota_and_429_rate_limit_do_not_return_401(auth_app, make_pdf):
    """Verify that quota exhaustion returns 403 Forbidden and rate limits return 429,
    which must never be confused with 401 Unauthorized.
    """
    client = TestClient(auth_app)
    guest_resp = client.post("/api/auth/guest-session")
    guest_token = guest_resp.json()["guest_token"]

    pdf = make_pdf(["First guest document."])
    # First upload succeeds
    r1 = client.post(
        "/api/documents/upload",
        headers={"X-Guest-Session": guest_token},
        files={"file": ("doc1.pdf", pdf, "application/pdf")},
    )
    assert r1.status_code == 201

    # Second upload exceeds guest_max_documents=1, returns 429 (or 403, strictly NOT 401)
    r2 = client.post(
        "/api/documents/upload",
        headers={"X-Guest-Session": guest_token},
        files={"file": ("doc2.pdf", pdf, "application/pdf")},
    )
    assert r2.status_code in (403, 429)
    assert r2.status_code != 401
    assert "limit" in r2.json()["detail"].lower() or "quota" in r2.json()["detail"].lower()
