"""Unit and integration tests for async-safe question idempotency, deduplication, and retention."""

import asyncio
from concurrent.futures import ThreadPoolExecutor
import time
from unittest.mock import MagicMock
import uuid

from fastapi.testclient import TestClient
import jwt
import pytest

from app.config import Settings
from app.main import create_app
from app.models.schemas import AskResponse
from app.services.guest_service import (
    AuthenticatedIdempotencyManager,
    IdempotencyState,
    QuestionIdempotencyRecord,
    QuestionIdempotencyRegistry,
)
from app.services.qa_service import GeminiQAService
from tests.conftest import create_test_pdf

TEST_JWT_SECRET = "test-secret-key-for-idempotency-32-chars-min!"


def make_auth_headers(user_id: str | None = None) -> dict[str, str]:
    sub = user_id or str(uuid.uuid4())
    token = jwt.encode(
        {"sub": sub, "aud": "authenticated", "exp": time.time() + 3600},
        TEST_JWT_SECRET,
        algorithm="HS256",
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def idem_settings() -> Settings:
    return Settings(
        supabase_jwt_secret=TEST_JWT_SECRET,
        supabase_jwt_algorithm="HS256",
        supabase_jwt_audience="authenticated",
        gemini_api_key="mock-key",
        gemini_timeout_seconds=2.0,
    )


def test_sequential_duplicate_question_deduplicated_and_cached(idem_settings):
    """Verify that sequential duplicate questions return cached response and consume quota once."""
    mock_qa = MagicMock(spec=GeminiQAService)
    mock_qa.generate_answer.return_value = ("Photosynthesis converts light energy [p. 1].", False, None)

    app = create_app(settings=idem_settings, qa_service=mock_qa)
    client = TestClient(app)

    # 1. Create guest session
    token = client.post("/api/auth/guest-session").json()["guest_token"]
    headers = {"X-Guest-Session": token}

    # Upload document
    pdf = create_test_pdf(["Photosynthesis converts light into chemical energy."])
    up_resp = client.post("/api/documents/upload", headers=headers, files={"file": ("bio.pdf", pdf, "application/pdf")})
    assert up_resp.status_code == 201

    # 2. Submit question with unique request_id
    req_id = str(uuid.uuid4())
    payload = {"question": "What does photosynthesis convert?", "request_id": req_id}

    resp1 = client.post("/api/documents/ask", headers=headers, json=payload)
    assert resp1.status_code == 200
    data1 = resp1.json()
    assert "Photosynthesis converts light energy" in data1["answer"]

    # 3. Submit identical question with same request_id
    resp2 = client.post("/api/documents/ask", headers=headers, json=payload)
    assert resp2.status_code == 200
    data2 = resp2.json()
    assert data2["answer"] == data1["answer"]

    # Upstream QA was called strictly once!
    assert mock_qa.generate_answer.call_count == 1

    # Verify guest quota was consumed strictly once: guest still has 4 questions remaining
    session_rec = app.state.guest_service.validate_guest_token(token)
    assert session_rec.questions_asked == 1


def test_concurrent_duplicate_questions_execute_qa_once(idem_settings):
    """Verify concurrent duplicate requests coordinate via asyncio.Event and execute QA once."""
    call_counter = 0

    def slow_qa_answer(question, passages):
        nonlocal call_counter
        call_counter += 1
        time.sleep(0.3)  # simulate LLM latency
        return ("Ground truth answer from passages.", False, None)

    mock_qa = MagicMock(spec=GeminiQAService)
    mock_qa.generate_answer.side_effect = slow_qa_answer

    app = create_app(settings=idem_settings, qa_service=mock_qa)
    client = TestClient(app)

    token = client.post("/api/auth/guest-session").json()["guest_token"]
    headers = {"X-Guest-Session": token}
    pdf = create_test_pdf(["Cellular biology information."])
    client.post("/api/documents/upload", headers=headers, files={"file": ("c.pdf", pdf, "application/pdf")})

    req_id = str(uuid.uuid4())
    payload = {"question": "Explain cellular biology?", "request_id": req_id}

    def ask_worker():
        return client.post("/api/documents/ask", headers=headers, json=payload)

    # 5 concurrent threads submit the exact same request_id
    with ThreadPoolExecutor(max_workers=5) as executor:
        futures = [executor.submit(ask_worker) for _ in range(5)]
        responses = [f.result() for f in futures]

    for r in responses:
        assert r.status_code == 200
        assert r.json()["answer"] == "Ground truth answer from passages."

    # Upstream QA executed strictly once across all 5 concurrent requests
    assert call_counter == 1

    # Quota consumed strictly once
    session_rec = app.state.guest_service.validate_guest_token(token)
    assert session_rec.questions_asked == 1


def test_request_id_uuid_validation_and_conflict_rejection(idem_settings):
    """Verify UUID validation and rejection of conflicting header vs body request IDs with 422."""
    app = create_app(settings=idem_settings)
    client = TestClient(app)

    token = client.post("/api/auth/guest-session").json()["guest_token"]
    headers = {"X-Guest-Session": token}

    # 1. Invalid UUID in body -> 422
    r_bad_uuid = client.post(
        "/api/documents/ask",
        headers=headers,
        json={"question": "Test?", "request_id": "not-a-uuid"},
    )
    assert r_bad_uuid.status_code == 422

    # 2. Invalid UUID in X-Request-Id header -> 422
    r_bad_header = client.post(
        "/api/documents/ask",
        headers={**headers, "X-Request-Id": "invalid-header-uuid"},
        json={"question": "Test?"},
    )
    assert r_bad_header.status_code == 422

    # 3. Conflicting header and body UUIDs -> 422
    uuid_a = str(uuid.uuid4())
    uuid_b = str(uuid.uuid4())
    r_conflict = client.post(
        "/api/documents/ask",
        headers={**headers, "X-Request-Id": uuid_a},
        json={"question": "Test?", "request_id": uuid_b},
    )
    assert r_conflict.status_code == 422
    assert "Conflicting request identifiers" in r_conflict.json()["detail"]


def test_idempotency_lifecycle_retention_and_in_flight_protection():
    """Verify that QuestionIdempotencyRegistry tracks completed_at and never evicts PROCESSING records."""
    registry = QuestionIdempotencyRegistry(max_capacity=3, ttl_seconds=100.0)
    now = 1000.0

    # 1. Register processing
    rec1 = registry.register_processing("req-1", current_time=now)
    assert rec1.state == IdempotencyState.PROCESSING
    assert rec1.completed_at is None

    # Advance time past TTL
    registry._cleanup_under_lock(current_time=now + 500.0)
    # PROCESSING record must NEVER be evicted!
    assert registry.get_existing("req-1") is not None

    # 2. Mark completed
    resp = AskResponse(question="Q", answer="A", sources=[])
    rec1.mark_completed(resp, current_time=now + 50.0)
    assert rec1.completed_at == now + 50.0
    assert rec1.state == IdempotencyState.COMPLETED

    # Within retention (50 + 100 = 150)
    registry._cleanup_under_lock(current_time=now + 120.0)
    assert registry.get_existing("req-1") is not None

    # Past retention (50 + 100 < 160)
    registry._cleanup_under_lock(current_time=now + 160.0)
    assert registry.get_existing("req-1") is None


def test_authenticated_idempotency_registry(idem_settings):
    """Verify separate bounded idempotency registry for authenticated users."""
    mock_qa = MagicMock(spec=GeminiQAService)
    mock_qa.generate_answer.return_value = ("Auth user answer.", False, None)

    app = create_app(settings=idem_settings, qa_service=mock_qa)
    client = TestClient(app)

    auth_headers = make_auth_headers(user_id="11111111-1111-1111-1111-111111111111")
    pdf = create_test_pdf(["Auth user text."])
    client.post("/api/documents/upload", headers=auth_headers, files={"file": ("a.pdf", pdf, "application/pdf")})

    req_id = str(uuid.uuid4())
    payload = {"question": "Question for auth user?", "request_id": req_id}

    # Call 1
    r1 = client.post("/api/documents/ask", headers=auth_headers, json=payload)
    assert r1.status_code == 200

    # Call 2 (Duplicate)
    r2 = client.post("/api/documents/ask", headers=auth_headers, json=payload)
    assert r2.status_code == 200
    assert r2.json()["answer"] == "Auth user answer."

    # QA called strictly once
    assert mock_qa.generate_answer.call_count == 1

    # Verify no fake guest session was created in guest service
    assert app.state.guest_service.session_count() == 0


def test_accepted_question_not_refunded_on_downstream_failure(idem_settings):
    """Verify accepted question quota is not refunded if downstream Gemini QA fails, and duplicate retry returns cached failure."""
    mock_qa = MagicMock(spec=GeminiQAService)
    mock_qa.generate_answer.side_effect = RuntimeError("Upstream Gemini connection crashed.")

    app = create_app(settings=idem_settings, qa_service=mock_qa)
    client = TestClient(app)

    token = client.post("/api/auth/guest-session").json()["guest_token"]
    headers = {"X-Guest-Session": token}
    pdf = create_test_pdf(["Content for downstream failure test."])
    client.post("/api/documents/upload", headers=headers, files={"file": ("f.pdf", pdf, "application/pdf")})

    req_id = str(uuid.uuid4())
    payload = {"question": "What is the content for downstream failure?", "request_id": req_id}

    # Call 1 fails with 500
    r1 = client.post("/api/documents/ask", headers=headers, json=payload)
    assert r1.status_code == 500

    # Quota is NOT refunded (questions_asked is 1)
    session_rec = app.state.guest_service.validate_guest_token(token)
    assert session_rec.questions_asked == 1

    # Retry with same request_id receives cached 500 without calling QA again
    r2 = client.post("/api/documents/ask", headers=headers, json=payload)
    assert r2.status_code == 500
    assert mock_qa.generate_answer.call_count == 1


def test_duplicate_request_timeout_returns_504():
    """Verify that a duplicate request waiting on a stalled in-flight request times out with 504."""
    # Configure tiny 0.1s timeout
    fast_timeout_settings = Settings(
        supabase_jwt_secret=TEST_JWT_SECRET,
        gemini_api_key="mock-key",
        gemini_timeout_seconds=0.1,
    )

    def infinitely_slow_qa(question, passages, **kwargs):
        time.sleep(2.0)
        return ("Late answer", False, None)

    mock_qa = MagicMock(spec=GeminiQAService)
    mock_qa.generate_answer.side_effect = infinitely_slow_qa

    app = create_app(settings=fast_timeout_settings, qa_service=mock_qa)
    client = TestClient(app)

    token = client.post("/api/auth/guest-session").json()["guest_token"]
    headers = {"X-Guest-Session": token}
    pdf = create_test_pdf(["Timeout test contents."])
    client.post("/api/documents/upload", headers=headers, files={"file": ("t.pdf", pdf, "application/pdf")})

    req_id = str(uuid.uuid4())
    payload = {"question": "Timeout test contents?", "request_id": req_id}

    def ask_call():
        return client.post("/api/documents/ask", headers=headers, json=payload)

    with ThreadPoolExecutor(max_workers=2) as executor:
        # Request 1 starts processing
        f1 = executor.submit(ask_call)
        time.sleep(0.05)
        # Request 2 arrives while Request 1 is processing and times out at 0.1s
        f2 = executor.submit(ask_call)

        r2 = f2.result()
        assert r2.status_code == 504
        assert "timed out waiting" in r2.json()["detail"]

