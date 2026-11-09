"""Comprehensive unit and integration tests for JWT authentication and identity resolution."""

from __future__ import annotations

from datetime import datetime, timezone
import json
import time
from typing import Annotated, Any
import uuid

from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi import Depends, FastAPI, status
from fastapi.testclient import TestClient
import httpx
import jwt
import pytest

from app.auth import (
    SupabaseJwksCache,
    get_current_identity,
    get_optional_identity,
    verify_supabase_jwt,
)
from app.config import Settings
from app.models.auth_schemas import UserIdentity
from app.services.guest_service import GuestSessionService

TEST_SECRET = "test-super-secure-jwt-secret-minimum-32-chars-long!"
TEST_ISSUER = "https://test-project.supabase.co/auth/v1"
TEST_AUDIENCE = "authenticated"


@pytest.fixture
def base_settings() -> Settings:
    return Settings(
        supabase_url="https://test-project.supabase.co",
        supabase_anon_key="test-anon-key",
        supabase_jwt_secret=TEST_SECRET,
        supabase_jwt_algorithm="HS256",
        supabase_jwt_audience=TEST_AUDIENCE,
        supabase_jwt_issuer=TEST_ISSUER,
    )


def make_jwt(
    payload: dict[str, Any] | None = None,
    secret: str = TEST_SECRET,
    algorithm: str = "HS256",
    headers: dict[str, Any] | None = None,
) -> str:
    """Helper to generate JWTs with sensible test defaults."""
    now = int(time.time())
    default_payload = {
        "sub": str(uuid.uuid4()),
        "aud": TEST_AUDIENCE,
        "iss": TEST_ISSUER,
        "exp": now + 3600,
        "iat": now,
        "email": "researcher@documind.test",
        "role": "authenticated",
    }
    if payload:
        default_payload.update(payload)
    return jwt.encode(default_payload, secret, algorithm=algorithm, headers=headers)


# ============================================================================
# 1. HS256 Token Verification Tests
# ============================================================================

def test_verify_valid_hs256_token(base_settings):
    user_id = str(uuid.uuid4())
    token = make_jwt({"sub": user_id, "email": "test@documind.test"}, secret=TEST_SECRET)
    claims = verify_supabase_jwt(token, settings=base_settings)
    assert claims["sub"] == user_id
    assert claims["email"] == "test@documind.test"
    assert claims["aud"] == TEST_AUDIENCE
    assert claims["iss"] == TEST_ISSUER


def test_verify_expired_token_rejected(base_settings):
    now = int(time.time())
    token = make_jwt({"exp": now - 60}, secret=TEST_SECRET)
    with pytest.raises(Exception) as exc_info:
        verify_supabase_jwt(token, settings=base_settings)
    assert exc_info.value.status_code == 401
    assert "expired" in exc_info.value.detail.lower()


def test_verify_immature_token_nbf_rejected(base_settings):
    now = int(time.time())
    token = make_jwt({"nbf": now + 600}, secret=TEST_SECRET)
    with pytest.raises(Exception) as exc_info:
        verify_supabase_jwt(token, settings=base_settings)
    assert exc_info.value.status_code == 401
    assert "not yet valid" in exc_info.value.detail.lower()


def test_verify_wrong_secret_rejected(base_settings):
    token = make_jwt(secret="wrong-secret-that-does-not-match-at-all!")
    with pytest.raises(Exception) as exc_info:
        verify_supabase_jwt(token, settings=base_settings)
    assert exc_info.value.status_code == 401
    assert "invalid" in exc_info.value.detail.lower()


def test_verify_wrong_audience_rejected(base_settings):
    token = make_jwt({"aud": "anon"}, secret=TEST_SECRET)
    with pytest.raises(Exception) as exc_info:
        verify_supabase_jwt(token, settings=base_settings)
    assert exc_info.value.status_code == 401
    assert "audience" in exc_info.value.detail.lower()


def test_verify_wrong_issuer_rejected(base_settings):
    token = make_jwt({"iss": "https://evil-spoof.supabase.co/auth/v1"}, secret=TEST_SECRET)
    with pytest.raises(Exception) as exc_info:
        verify_supabase_jwt(token, settings=base_settings)
    assert exc_info.value.status_code == 401
    assert "issuer" in exc_info.value.detail.lower()


def test_verify_missing_required_claims(base_settings):
    now = int(time.time())
    # Missing sub
    token_no_sub = jwt.encode(
        {"aud": TEST_AUDIENCE, "iss": TEST_ISSUER, "exp": now + 3600},
        TEST_SECRET,
        algorithm="HS256",
    )
    with pytest.raises(Exception) as exc1:
        verify_supabase_jwt(token_no_sub, settings=base_settings)
    assert exc1.value.status_code == 401

    # Missing exp
    token_no_exp = jwt.encode(
        {"sub": str(uuid.uuid4()), "aud": TEST_AUDIENCE, "iss": TEST_ISSUER},
        TEST_SECRET,
        algorithm="HS256",
    )
    with pytest.raises(Exception) as exc2:
        verify_supabase_jwt(token_no_exp, settings=base_settings)
    assert exc2.value.status_code == 401


def test_verify_non_uuid_subject_rejected(base_settings):
    token = make_jwt({"sub": "not-a-valid-uuid-identifier"}, secret=TEST_SECRET)
    with pytest.raises(Exception) as exc_info:
        verify_supabase_jwt(token, settings=base_settings)
    assert exc_info.value.status_code == 401
    assert "uuid" in exc_info.value.detail.lower()


def test_verify_alg_none_strictly_rejected(base_settings):
    now = int(time.time())
    payload = {
        "sub": str(uuid.uuid4()),
        "aud": TEST_AUDIENCE,
        "iss": TEST_ISSUER,
        "exp": now + 3600,
    }
    # Forge token with alg none
    token_none = jwt.encode(payload, key="", algorithm="none")
    with pytest.raises(Exception) as exc_info:
        verify_supabase_jwt(token_none, settings=base_settings)
    assert exc_info.value.status_code == 401


def test_verify_unconfigured_secret_rejected():
    settings = Settings(
        supabase_url="https://test-project.supabase.co",
        supabase_jwt_secret=None,
        supabase_jwt_algorithm="HS256",
    )
    token = make_jwt(secret=TEST_SECRET)
    with pytest.raises(Exception) as exc_info:
        verify_supabase_jwt(token, settings=settings)
    assert exc_info.value.status_code == 401
    assert "unconfigured" in exc_info.value.detail.lower()


def test_verify_error_does_not_leak_secrets(base_settings):
    token = "invalid.token.structure"
    with pytest.raises(Exception) as exc_info:
        verify_supabase_jwt(token, settings=base_settings)
    assert exc_info.value.status_code == 401
    error_str = str(exc_info.value.detail) + str(exc_info.value.headers)
    assert TEST_SECRET not in error_str


# ============================================================================
# 2. RS256 Token Verification and JWKS Cache Tests
# ============================================================================

@pytest.fixture
def rsa_key_pair():
    """Generate ephemeral RSA key pair for testing RS256 verification."""
    private_key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048,
    )
    public_key = private_key.public_key()
    return private_key, public_key


def test_verify_valid_rs256_token_with_jwks(rsa_key_pair):
    private_key, public_key = rsa_key_pair
    kid = "test-key-id-2026"

    # Export public key to JWK
    jwk_dict = json.loads(jwt.algorithms.RSAAlgorithm.to_jwk(public_key))
    jwk_dict["kid"] = kid
    jwk_dict["use"] = "sig"

    jwks_data = {"keys": [jwk_dict]}

    # Mock HTTP transport returning JWKS
    def handler(request: httpx.Request):
        return httpx.Response(200, json=jwks_data)

    mock_client = httpx.Client(transport=httpx.MockTransport(handler))
    cache = SupabaseJwksCache(
        jwks_url="https://test-project.supabase.co/auth/v1/.well-known/jwks.json",
        ttl_seconds=3600.0,
        http_client=mock_client,
    )

    rs256_settings = Settings(
        supabase_url="https://test-project.supabase.co",
        supabase_jwt_algorithm="RS256",
        supabase_jwt_audience=TEST_AUDIENCE,
        supabase_jwt_issuer=TEST_ISSUER,
    )

    user_id = str(uuid.uuid4())
    token = make_jwt(
        {"sub": user_id, "email": "curie@documind.test"},
        secret=private_key,
        algorithm="RS256",
        headers={"kid": kid},
    )

    claims = verify_supabase_jwt(token, settings=rs256_settings, jwks_cache=cache)
    assert claims["sub"] == user_id
    assert claims["email"] == "curie@documind.test"


def test_verify_rs256_missing_kid_rejected(rsa_key_pair):
    private_key, _ = rsa_key_pair
    rs256_settings = Settings(
        supabase_url="https://test-project.supabase.co",
        supabase_jwt_algorithm="RS256",
        supabase_jwt_audience=TEST_AUDIENCE,
        supabase_jwt_issuer=TEST_ISSUER,
    )

    token = make_jwt(secret=private_key, algorithm="RS256", headers={})  # no kid
    with pytest.raises(Exception) as exc_info:
        verify_supabase_jwt(token, settings=rs256_settings)
    assert exc_info.value.status_code == 401
    assert "kid" in exc_info.value.detail.lower()


def test_verify_algorithm_confusion_rs256_vs_hs256_rejected(rsa_key_pair):
    """When configured for RS256, an HS256 token must be strictly rejected."""
    rs256_settings = Settings(
        supabase_url="https://test-project.supabase.co",
        supabase_jwt_algorithm="RS256",
        supabase_jwt_audience=TEST_AUDIENCE,
        supabase_jwt_issuer=TEST_ISSUER,
    )
    # Generate token with HS256
    hs256_token = make_jwt(secret=TEST_SECRET, algorithm="HS256")
    with pytest.raises(Exception) as exc_info:
        verify_supabase_jwt(hs256_token, settings=rs256_settings)
    assert exc_info.value.status_code == 401
    assert "algorithm" in exc_info.value.detail.lower()


def test_verify_algorithm_confusion_hs256_vs_rs256_rejected(rsa_key_pair, base_settings):
    """When configured for HS256, an RS256 token must be strictly rejected."""
    private_key, _ = rsa_key_pair
    rs256_token = make_jwt(secret=private_key, algorithm="RS256", headers={"kid": "key-1"})
    with pytest.raises(Exception) as exc_info:
        verify_supabase_jwt(rs256_token, settings=base_settings)
    assert exc_info.value.status_code == 401
    assert "algorithm" in exc_info.value.detail.lower()


# ============================================================================
# 3. FastAPI Dependency & Identity Resolution Tests
# ============================================================================

@pytest.fixture
def auth_test_app(base_settings):
    """Minimal FastAPI test application exercising get_current_identity dependency."""
    app = FastAPI()
    app.state.settings = base_settings
    guest_service = GuestSessionService(settings=base_settings)
    app.state.guest_service = guest_service

    @app.get("/api/test-protected")
    def protected_endpoint(identity: Annotated[UserIdentity, Depends(get_current_identity)]):
        return {
            "user_id": identity.user_id,
            "email": identity.email,
            "is_guest": identity.is_guest,
            "partition_id": identity.partition_id,
        }

    @app.get("/api/test-optional")
    def optional_endpoint(identity: Annotated[UserIdentity | None, Depends(get_optional_identity)]):
        if identity is None:
            return {"authenticated": False}
        return {"authenticated": True, "user_id": identity.user_id, "is_guest": identity.is_guest}

    return app


def test_get_current_identity_with_valid_bearer(auth_test_app):
    client = TestClient(auth_test_app)
    user_id = str(uuid.uuid4())
    token = make_jwt({"sub": user_id, "email": "user@documind.test"})

    response = client.get(
        "/api/test-protected",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["user_id"] == user_id
    assert data["email"] == "user@documind.test"
    assert data["is_guest"] is False
    assert data["partition_id"] == f"user_{user_id}"


def test_get_current_identity_with_valid_guest_session(auth_test_app):
    client = TestClient(auth_test_app)
    guest_service: GuestSessionService = auth_test_app.state.guest_service
    session = guest_service.create_guest_session(client_ip="127.0.0.1")

    response = client.get(
        "/api/test-protected",
        headers={"X-Guest-Session": session.guest_token},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["is_guest"] is True
    assert data["email"] is None
    assert data["partition_id"].startswith("guest_")


def test_get_current_identity_bearer_precedence_over_guest(auth_test_app):
    client = TestClient(auth_test_app)
    guest_service: GuestSessionService = auth_test_app.state.guest_service
    session = guest_service.create_guest_session(client_ip="127.0.0.1")

    user_id = str(uuid.uuid4())
    token = make_jwt({"sub": user_id, "email": "priority@documind.test"})

    # Send both headers: Bearer must take precedence
    response = client.get(
        "/api/test-protected",
        headers={
            "Authorization": f"Bearer {token}",
            "X-Guest-Session": session.guest_token,
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["user_id"] == user_id
    assert data["is_guest"] is False


def test_get_current_identity_missing_credentials_returns_401(auth_test_app):
    client = TestClient(auth_test_app)
    response = client.get("/api/test-protected")
    assert response.status_code == 401
    assert "WWW-Authenticate" in response.headers
    assert "Bearer" in response.headers["WWW-Authenticate"]


def test_get_current_identity_malformed_auth_header_returns_401(auth_test_app):
    client = TestClient(auth_test_app)
    # Not Bearer
    response = client.get("/api/test-protected", headers={"Authorization": "Basic dXNlcjpwYXNz"})
    assert response.status_code == 401
    assert "Bearer" in response.json()["detail"]


def test_get_current_identity_invalid_guest_token_returns_401(auth_test_app):
    client = TestClient(auth_test_app)
    response = client.get("/api/test-protected", headers={"X-Guest-Session": "gstd_forged_invalid_token"})
    assert response.status_code == 401
    assert "Guest session is invalid or expired" in response.json()["detail"]


def test_get_optional_identity_behavior(auth_test_app):
    client = TestClient(auth_test_app)

    # 1. Unauthenticated -> returns authenticated: False
    res1 = client.get("/api/test-optional")
    assert res1.status_code == 200
    assert res1.json() == {"authenticated": False}

    # 2. Authenticated -> returns authenticated: True
    user_id = str(uuid.uuid4())
    token = make_jwt({"sub": user_id})
    res2 = client.get("/api/test-optional", headers={"Authorization": f"Bearer {token}"})
    assert res2.status_code == 200
    assert res2.json()["authenticated"] is True
    assert res2.json()["user_id"] == user_id
