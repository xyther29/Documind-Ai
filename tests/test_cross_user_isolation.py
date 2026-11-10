"""Integration tests verifying strict multi-user and multi-guest partition isolation and cross-partition security."""

import time
import uuid
from fastapi.testclient import TestClient
import jwt
import pytest

from app.config import Settings
from app.main import create_app
from tests.conftest import create_test_pdf

TEST_JWT_SECRET = "cross-user-isolation-test-jwt-secret-min-32-chars!"


def make_user_headers(user_uuid: str) -> dict[str, str]:
    token = jwt.encode(
        {"sub": user_uuid, "aud": "authenticated", "exp": time.time() + 3600},
        TEST_JWT_SECRET,
        algorithm="HS256",
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def isolation_settings() -> Settings:
    return Settings(
        supabase_jwt_secret=TEST_JWT_SECRET,
        supabase_jwt_algorithm="HS256",
        supabase_jwt_audience="authenticated",
        gemini_api_key="mock-key",
    )


def test_two_authenticated_users_are_strictly_isolated(isolation_settings):
    """Verify that User 1 and User 2 cannot see, search, ask against, or delete each other's documents."""
    app = create_app(settings=isolation_settings)
    client = TestClient(app)

    user1_id = str(uuid.uuid4())
    user2_id = str(uuid.uuid4())
    h_user1 = make_user_headers(user1_id)
    h_user2 = make_user_headers(user2_id)

    # User 1 uploads quantum.pdf
    pdf1 = create_test_pdf(["Quantum computing algorithms and superposition."])
    up1 = client.post("/api/documents/upload", headers=h_user1, files={"file": ("quantum.pdf", pdf1, "application/pdf")})
    assert up1.status_code == 201
    doc1_id = up1.json()["doc_id"]

    # User 2 uploads biology.pdf
    pdf2 = create_test_pdf(["Photosynthesis converts light into chemical energy."])
    up2 = client.post("/api/documents/upload", headers=h_user2, files={"file": ("biology.pdf", pdf2, "application/pdf")})
    assert up2.status_code == 201
    doc2_id = up2.json()["doc_id"]

    # 1. List isolation: User 1 sees only quantum.pdf; User 2 sees only biology.pdf
    list1 = client.get("/api/documents", headers=h_user1).json()
    assert list1["total"] == 1
    assert list1["documents"][0]["doc_id"] == doc1_id

    list2 = client.get("/api/documents", headers=h_user2).json()
    assert list2["total"] == 1
    assert list2["documents"][0]["doc_id"] == doc2_id

    # 2. Cross-user delete: User 2 attempts to delete User 1's doc1_id -> 404
    del_attempt = client.delete(f"/api/documents/{doc1_id}", headers=h_user2)
    assert del_attempt.status_code == 404

    # Verify doc1_id is still in User 1's library
    assert client.get("/api/documents", headers=h_user1).json()["total"] == 1

    # 3. Cross-user search by doc_id: User 2 queries with doc_id=doc1_id -> 404
    search_cross = client.post(
        "/api/documents/search",
        headers=h_user2,
        json={"query": "quantum computing", "doc_id": doc1_id},
    )
    assert search_cross.status_code == 404

    # 4. Corpus-level search isolation (doc_id=None):
    # User 2 queries with doc_id=None for quantum computing terms
    search_corpus = client.post(
        "/api/documents/search",
        headers=h_user2,
        json={"query": "quantum computing"},
    )
    assert search_corpus.status_code == 200
    # User 2's partition contains only biology.pdf; zero hits must be returned
    assert search_corpus.json()["total_results"] == 0

    # 5. Cross-user question by doc_id: User 2 asks on doc1_id -> 404
    ask_cross = client.post(
        "/api/documents/ask",
        headers=h_user2,
        json={"question": "What is quantum?", "doc_id": doc1_id},
    )
    assert ask_cross.status_code == 404


def test_two_guest_sessions_are_strictly_isolated(isolation_settings):
    """Verify that Guest 1 and Guest 2 cannot see, delete, or search each other's documents."""
    app = create_app(settings=isolation_settings)
    client = TestClient(app)

    token1 = client.post("/api/auth/guest-session").json()["guest_token"]
    token2 = client.post("/api/auth/guest-session").json()["guest_token"]
    h_guest1 = {"X-Guest-Session": token1}
    h_guest2 = {"X-Guest-Session": token2}

    # Guest 1 uploads doc
    pdf1 = create_test_pdf(["Guest one private financial records."])
    up1 = client.post("/api/documents/upload", headers=h_guest1, files={"file": ("g1.pdf", pdf1, "application/pdf")})
    assert up1.status_code == 201
    doc1_id = up1.json()["doc_id"]

    # Guest 2 attempts to delete doc1_id -> 404
    del_resp = client.delete(f"/api/documents/{doc1_id}", headers=h_guest2)
    assert del_resp.status_code == 404

    # Guest 2 list documents is empty
    list2 = client.get("/api/documents", headers=h_guest2).json()
    assert list2["total"] == 0

    # Guest 2 searches with doc_id=None -> 0 hits
    s2 = client.post("/api/documents/search", headers=h_guest2, json={"query": "financial records"})
    assert s2.json()["total_results"] == 0


def test_empty_library_ask_returns_404_without_consuming_quota(isolation_settings):
    """Verify that asking a question with an empty library returns 404 and does not consume quota."""
    app = create_app(settings=isolation_settings)
    client = TestClient(app)

    token = client.post("/api/auth/guest-session").json()["guest_token"]
    headers = {"X-Guest-Session": token}

    # Ask without uploading any documents
    resp = client.post("/api/documents/ask", headers=headers, json={"question": "What is anything?"})
    assert resp.status_code == 404
    assert "No documents found in your library" in resp.json()["detail"]

    # Quota was NOT consumed
    session_rec = app.state.guest_service.validate_guest_token(token)
    assert session_rec.questions_asked == 0
