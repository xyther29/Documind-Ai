"""Integration and unit tests for guest quotas, multi-tier IP abuse controls, and concurrency."""

from concurrent.futures import ThreadPoolExecutor
import time
from fastapi.testclient import TestClient
import pytest

from app.config import Settings
from app.main import create_app
from app.services.guest_service import GuestSessionService
from tests.conftest import create_test_pdf


@pytest.fixture
def quota_settings() -> Settings:
    return Settings(
        guest_max_documents=1,
        guest_max_questions=5,
        guest_max_active_sessions_per_ip=3,
        guest_hourly_max_documents=3,
        guest_hourly_max_questions=10,
        guest_issuance_rate_limit=10,
        trusted_proxies=["127.0.0.1", "::1", "testclient"],
    )


def test_guest_upload_quota_enforced(quota_settings):
    """Verify that a guest session can upload at most 1 document and receives 429 on the second."""
    app = create_app(settings=quota_settings)
    client = TestClient(app)

    session_resp = client.post("/api/auth/guest-session")
    assert session_resp.status_code == 201
    guest_token = session_resp.json()["guest_token"]
    headers = {"X-Guest-Session": guest_token}

    pdf1 = create_test_pdf(["Document 1 content."])
    resp1 = client.post("/api/documents/upload", headers=headers, files={"file": ("doc1.pdf", pdf1, "application/pdf")})
    assert resp1.status_code == 201

    pdf2 = create_test_pdf(["Document 2 content."])
    resp2 = client.post("/api/documents/upload", headers=headers, files={"file": ("doc2.pdf", pdf2, "application/pdf")})
    assert resp2.status_code == 429
    assert "Guest document limit exceeded" in resp2.json()["detail"]


def test_failed_upload_releases_reservation(quota_settings):
    """Verify that a failed upload (bad PDF or oversized) does not consume guest quota."""
    app = create_app(settings=quota_settings)
    client = TestClient(app)

    session_resp = client.post("/api/auth/guest-session")
    token = session_resp.json()["guest_token"]
    headers = {"X-Guest-Session": token}

    # 1. Corrupted PDF upload fails with 400
    corrupt_bytes = b"%PDF-1.4 corrupted stream content"
    bad_resp = client.post("/api/documents/upload", headers=headers, files={"file": ("bad.pdf", corrupt_bytes, "application/pdf")})
    assert bad_resp.status_code == 400

    # 2. Subsequent valid PDF must succeed (quota was not consumed)
    valid_pdf = create_test_pdf(["Valid PDF page content."])
    good_resp = client.post("/api/documents/upload", headers=headers, files={"file": ("valid.pdf", valid_pdf, "application/pdf")})
    assert good_resp.status_code == 201


def test_document_deletion_frees_guest_active_quota(quota_settings):
    """Verify that deleting a document allows a guest to upload a replacement document."""
    app = create_app(settings=quota_settings)
    client = TestClient(app)

    token = client.post("/api/auth/guest-session").json()["guest_token"]
    headers = {"X-Guest-Session": token}

    pdf1 = create_test_pdf(["First document text."])
    up1 = client.post("/api/documents/upload", headers=headers, files={"file": ("first.pdf", pdf1, "application/pdf")})
    assert up1.status_code == 201
    doc_id = up1.json()["doc_id"]

    # Exceeded
    pdf2 = create_test_pdf(["Second document text."])
    up2_fail = client.post("/api/documents/upload", headers=headers, files={"file": ("second.pdf", pdf2, "application/pdf")})
    assert up2_fail.status_code == 429

    # Delete first document
    del_resp = client.delete(f"/api/documents/{doc_id}", headers=headers)
    assert del_resp.status_code == 200

    # Upload replacement document succeeds
    up2_success = client.post("/api/documents/upload", headers=headers, files={"file": ("second.pdf", pdf2, "application/pdf")})
    assert up2_success.status_code == 201


def test_concurrent_uploads_strictly_enforce_cap(quota_settings):
    """Verify that 20 concurrent upload requests for 1 guest result in exactly 1 success and 19 429s."""
    app = create_app(settings=quota_settings)
    client = TestClient(app)

    token = client.post("/api/auth/guest-session").json()["guest_token"]
    headers = {"X-Guest-Session": token}
    pdf_bytes = create_test_pdf(["Concurrent upload test."])

    statuses = []

    def run_upload(idx):
        return client.post(
            "/api/documents/upload",
            headers=headers,
            files={"file": (f"test_{idx}.pdf", pdf_bytes, "application/pdf")},
        ).status_code

    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = [executor.submit(run_upload, i) for i in range(20)]
        statuses = [f.result() for f in futures]

    assert statuses.count(201) == 1
    assert statuses.count(429) == 19


def test_active_session_cap_enforced(quota_settings):
    """Verify Tier 2 active concurrent session cap per IP returns 429 and keeps existing sessions valid."""
    app = create_app(settings=quota_settings)
    client = TestClient(app)

    tokens = []
    # Cap is 3 sessions per IP
    for _ in range(3):
        r = client.post("/api/auth/guest-session")
        assert r.status_code == 201
        tokens.append(r.json()["guest_token"])

    # 4th request from same client exceeds active session cap
    r4 = client.post("/api/auth/guest-session")
    assert r4.status_code == 429
    assert "Active guest session limit reached" in r4.json()["detail"]

    # Verify that the 3 existing sessions stay completely valid
    for token in tokens:
        headers = {"X-Guest-Session": token}
        list_resp = client.get("/api/documents", headers=headers)
        assert list_resp.status_code == 200


def test_hourly_ip_document_budget_enforced():
    """Verify Tier 3 cumulative hourly document limit across distinct guest sessions from same IP."""
    strict_settings = Settings(
        guest_max_documents=1,
        guest_max_active_sessions_per_ip=10,
        guest_hourly_max_documents=2,  # IP budget: max 2 docs per hour
    )
    app = create_app(settings=strict_settings)
    client = TestClient(app)

    pdf = create_test_pdf(["PDF for hourly test."])

    # Session 1 uploads doc 1 -> succeeds
    t1 = client.post("/api/auth/guest-session").json()["guest_token"]
    up1 = client.post("/api/documents/upload", headers={"X-Guest-Session": t1}, files={"file": ("1.pdf", pdf, "application/pdf")})
    assert up1.status_code == 201

    # Session 2 uploads doc 2 -> succeeds
    t2 = client.post("/api/auth/guest-session").json()["guest_token"]
    up2 = client.post("/api/documents/upload", headers={"X-Guest-Session": t2}, files={"file": ("2.pdf", pdf, "application/pdf")})
    assert up2.status_code == 201

    # Session 3 attempts upload -> rejected with 429 (IP hourly document budget exhausted)
    t3 = client.post("/api/auth/guest-session").json()["guest_token"]
    up3 = client.post("/api/documents/upload", headers={"X-Guest-Session": t3}, files={"file": ("3.pdf", pdf, "application/pdf")})
    assert up3.status_code == 429
    assert "Hourly document upload limit exceeded" in up3.json()["detail"]


def test_trusted_proxy_ip_spoofing_defense(quota_settings):
    """Verify that an untrusted client cannot bypass IP rate limits using spoofed X-Forwarded-For."""
    # Configure untrusted proxy list (testclient is not in trusted list)
    untrusted_settings = Settings(
        guest_issuance_rate_limit=3,
        trusted_proxies=["127.0.0.1", "10.0.0.1"],  # 'testclient' is NOT trusted
    )
    app = create_app(settings=untrusted_settings)
    client = TestClient(app)

    # Sending different spoofed X-Forwarded-For headers should NOT trick the server
    for i in range(3):
        resp = client.post("/api/auth/guest-session", headers={"X-Forwarded-For": f"198.51.100.{i}"})
        assert resp.status_code == 201

    # 4th request from same testclient peer host is rejected regardless of new spoofed IP
    resp_blocked = client.post("/api/auth/guest-session", headers={"X-Forwarded-For": "203.0.113.99"})
    assert resp_blocked.status_code == 429
    assert "issuance limit exceeded" in resp_blocked.json()["detail"]


def test_lock_hierarchy_order_no_deadlock(quota_settings):
    """Verify that high-concurrency upload and question calls execute without deadlocks."""
    app = create_app(settings=quota_settings)
    client = TestClient(app)

    token = client.post("/api/auth/guest-session").json()["guest_token"]
    headers = {"X-Guest-Session": token}
    pdf = create_test_pdf(["Lock test document."])
    up_resp = client.post("/api/documents/upload", headers=headers, files={"file": ("l.pdf", pdf, "application/pdf")})
    assert up_resp.status_code == 201

    # 20 concurrent question calls to exercise Level 1 -> Level 2 lock hierarchy
    def ask_call(idx):
        return client.post(
            "/api/documents/ask",
            headers=headers,
            json={"question": f"Question {idx}?"},
        ).status_code

    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = [executor.submit(ask_call, i) for i in range(20)]
        results = [f.result() for f in futures]

    # Quota is 5, so 5 succeed and 15 return 429, with 0 deadlocks or hanging tasks
    assert results.count(200) == 5
    assert results.count(429) == 15
