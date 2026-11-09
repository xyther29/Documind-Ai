"""Comprehensive unit and concurrency tests for in-memory guest sessions, atomic quotas, and rate limiting."""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
import hashlib
import time
import pytest

from app.config import Settings
from app.services.guest_service import GuestSessionRecord, GuestSessionService


class FakeClock:
    """Injectable controllable clock for deterministic time and expiration testing."""

    def __init__(self, start_time: float = 1700000000.0):
        self.current_time = start_time

    def __call__(self) -> float:
        return self.current_time

    def advance(self, seconds: float) -> None:
        self.current_time += seconds


@pytest.fixture
def guest_settings() -> Settings:
    return Settings(
        guest_session_ttl_minutes=60,
        guest_max_documents=1,
        guest_max_questions=5,
        guest_issuance_rate_limit=5,  # Low limit for testing
    )


# ============================================================================
# 1. Guest Session Token Issuance and Storage Tests
# ============================================================================

def test_guest_session_issuance_format_and_hashing(guest_settings):
    clock = FakeClock()
    service = GuestSessionService(settings=guest_settings, clock=clock)

    resp = service.create_guest_session(client_ip="192.168.1.1")
    assert resp.guest_token.startswith("gstd_")
    assert resp.max_documents == 1
    assert resp.max_questions == 5

    # Verify storage stores only the SHA-256 hash of the token, never raw token
    expected_hash = hashlib.sha256(resp.guest_token.encode("utf-8")).hexdigest()
    assert expected_hash in service._sessions
    assert resp.guest_token not in service._sessions


def test_validate_guest_token_success_and_failures(guest_settings):
    clock = FakeClock()
    service = GuestSessionService(settings=guest_settings, clock=clock)

    session = service.create_guest_session(client_ip="10.0.0.1")
    raw_token = session.guest_token

    # 1. Valid token resolves
    record = service.validate_guest_token(raw_token)
    assert record is not None
    assert str(record.guest_id) != ""

    # 2. Forged / non-existent token rejected
    assert service.validate_guest_token("gstd_forged_secret_token_never_issued") is None

    # 3. Malformed / empty token rejected
    assert service.validate_guest_token("") is None
    assert service.validate_guest_token("random_garbage_without_prefix") is None


def test_guest_session_ttl_expiration(guest_settings):
    clock = FakeClock()
    service = GuestSessionService(settings=guest_settings, clock=clock)

    session = service.create_guest_session(client_ip="10.0.0.2")
    raw_token = session.guest_token

    # Before TTL expires (59 minutes)
    clock.advance(59 * 60)
    assert service.validate_guest_token(raw_token) is not None

    # After TTL expires (61 minutes total)
    clock.advance(2 * 60)
    assert service.validate_guest_token(raw_token) is None


def test_guest_session_revocation(guest_settings):
    clock = FakeClock()
    service = GuestSessionService(settings=guest_settings, clock=clock)

    session = service.create_guest_session(client_ip="10.0.0.3")
    raw_token = session.guest_token

    assert service.validate_guest_token(raw_token) is not None
    revoked = service.revoke_guest_session(raw_token)
    assert revoked is True
    assert service.validate_guest_token(raw_token) is None


# ============================================================================
# 2. Atomic Quota Enforcement Tests
# ============================================================================

def test_atomic_document_quota_enforcement(guest_settings):
    clock = FakeClock()
    service = GuestSessionService(settings=guest_settings, clock=clock)
    session = service.create_guest_session(client_ip="10.0.0.4")
    record = service.validate_guest_token(session.guest_token)
    assert record is not None

    # Limit is 1 document
    assert record.record_document_upload(max_docs=1) is True
    assert record.record_document_upload(max_docs=1) is False
    assert record.record_document_upload(max_docs=1) is False

    status = record.get_quota_status()
    assert status["documents_uploaded"] == 1


def test_atomic_question_quota_enforcement(guest_settings):
    clock = FakeClock()
    service = GuestSessionService(settings=guest_settings, clock=clock)
    session = service.create_guest_session(client_ip="10.0.0.5")
    record = service.validate_guest_token(session.guest_token)
    assert record is not None

    # Limit is 5 questions
    for i in range(5):
        assert record.record_question_ask(max_questions=5) is True, f"Question {i+1} should succeed"

    # 6th question must be denied
    assert record.record_question_ask(max_questions=5) is False
    assert record.record_question_ask(max_questions=5) is False

    status = record.get_quota_status()
    assert status["questions_asked"] == 5


def test_concurrent_document_quota_consumption(guest_settings):
    """Verify concurrent attempts to upload documents cannot bypass quota limit."""
    clock = FakeClock()
    service = GuestSessionService(settings=guest_settings, clock=clock)
    session = service.create_guest_session(client_ip="10.0.0.6")
    record = service.validate_guest_token(session.guest_token)
    assert record is not None

    results: list[bool] = []

    def try_upload():
        return record.record_document_upload(max_docs=1)

    # 20 concurrent threads trying to consume 1 document quota
    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = [executor.submit(try_upload) for _ in range(20)]
        for f in futures:
            results.append(f.result())

    # Exactly one thread must have succeeded
    assert results.count(True) == 1
    assert results.count(False) == 19
    assert record.documents_uploaded == 1


def test_concurrent_question_quota_consumption(guest_settings):
    """Verify concurrent attempts to ask questions cannot bypass quota limit."""
    clock = FakeClock()
    service = GuestSessionService(settings=guest_settings, clock=clock)
    session = service.create_guest_session(client_ip="10.0.0.7")
    record = service.validate_guest_token(session.guest_token)
    assert record is not None

    results: list[bool] = []

    def try_ask():
        return record.record_question_ask(max_questions=5)

    # 30 concurrent threads trying to consume 5 question quotas
    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = [executor.submit(try_ask) for _ in range(30)]
        for f in futures:
            results.append(f.result())

    # Exactly 5 threads must have succeeded
    assert results.count(True) == 5
    assert results.count(False) == 25
    assert record.questions_asked == 5


# ============================================================================
# 3. Issuance Rate Limiting Tests
# ============================================================================

def test_issuance_rate_limiting_per_ip(guest_settings):
    clock = FakeClock()
    service = GuestSessionService(settings=guest_settings, clock=clock)
    client_ip = "192.168.1.100"

    # Limit is 5/min
    for _ in range(5):
        resp = service.create_guest_session(client_ip=client_ip)
        assert resp is not None

    # 6th request within same minute must raise RuntimeError
    with pytest.raises(RuntimeError) as exc_info:
        service.create_guest_session(client_ip=client_ip)
    assert "limit exceeded" in str(exc_info.value).lower()

    # Another IP address is not blocked
    other_ip = "192.168.1.101"
    resp_other = service.create_guest_session(client_ip=other_ip)
    assert resp_other is not None

    # Advance clock by 61 seconds: original IP is unblocked
    clock.advance(61.0)
    resp_unblocked = service.create_guest_session(client_ip=client_ip)
    assert resp_unblocked is not None


def test_concurrent_issuance_rate_limiting(guest_settings):
    """Verify concurrent requests from the same IP cannot exceed the rate limit."""
    clock = FakeClock()
    service = GuestSessionService(settings=guest_settings, clock=clock)
    client_ip = "192.168.1.200"

    successes = 0
    failures = 0

    def try_issue():
        try:
            service.create_guest_session(client_ip=client_ip)
            return True
        except RuntimeError:
            return False

    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = [executor.submit(try_issue) for _ in range(20)]
        for f in futures:
            if f.result():
                successes += 1
            else:
                failures += 1

    # Exactly 5 successes (rate limit = 5) and 15 failures
    assert successes == 5
    assert failures == 15
