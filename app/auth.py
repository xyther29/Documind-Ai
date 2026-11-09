"""Core authentication and JWT verification infrastructure for DocuMind AI."""

from __future__ import annotations

import logging
import threading
import time
from typing import Annotated, Any, Callable, Optional
import uuid

from fastapi import Depends, Header, HTTPException, Request, status
import httpx
import jwt
from jwt.algorithms import RSAAlgorithm

from app.config import Settings, get_settings
from app.models.auth_schemas import UserIdentity
from app.services.guest_service import GuestSessionService

logger = logging.getLogger(__name__)


class SupabaseJwksCache:
    """Thread-safe, caching client for Supabase RS256 JWKS public signing keys."""

    def __init__(
        self,
        jwks_url: str,
        ttl_seconds: float = 3600.0,
        http_client: Optional[httpx.Client] = None,
        clock: Optional[Callable[[], float]] = None,
    ):
        self.jwks_url = jwks_url
        self.ttl_seconds = ttl_seconds
        self._http_client = http_client
        self._clock = clock or time.time
        self._lock = threading.Lock()
        self._keys_by_kid: dict[str, Any] = {}
        self._last_fetched: float = 0.0

    def _fetch_keys(self) -> dict[str, Any]:
        """Fetch and parse JWKS keys from remote endpoint."""
        client = self._http_client or httpx.Client(timeout=10.0)
        close_client = self._http_client is None
        try:
            response = client.get(self.jwks_url)
            response.raise_for_status()
            data = response.json()
        finally:
            if close_client:
                client.close()

        keys_dict: dict[str, Any] = {}
        for key_data in data.get("keys", []):
            kid = key_data.get("kid")
            kty = key_data.get("kty")
            use = key_data.get("use", "sig")
            if kid and kty == "RSA" and use == "sig":
                try:
                    public_key = RSAAlgorithm.from_jwk(key_data)
                    keys_dict[kid] = public_key
                except Exception:
                    continue
        return keys_dict

    def get_signing_key(self, kid: str) -> Any:
        """Retrieve RSA public key by kid, refreshing cache when necessary."""
        now = self._clock()
        with self._lock:
            # Check if key is already cached and cache is still fresh
            if kid in self._keys_by_kid and (now - self._last_fetched < self.ttl_seconds):
                return self._keys_by_kid[kid]

            # Refresh cache
            try:
                refreshed_keys = self._fetch_keys()
                self._keys_by_kid = refreshed_keys
                self._last_fetched = now
            except Exception as exc:
                # If network fails but key exists in stale cache, allow fallback
                if kid in self._keys_by_kid:
                    return self._keys_by_kid[kid]
                raise RuntimeError("Failed to fetch public signing keys from Supabase JWKS endpoint.") from exc

            if kid not in self._keys_by_kid:
                raise KeyError(f"Key ID '{kid}' not found in active JWKS key set.")

            return self._keys_by_kid[kid]


# Global cache registry for JWKS endpoints
_JWKS_CACHES: dict[str, SupabaseJwksCache] = {}
_JWKS_LOCK = threading.Lock()


def get_jwks_cache(jwks_url: str, http_client: Optional[httpx.Client] = None) -> SupabaseJwksCache:
    """Get or create singleton SupabaseJwksCache for a JWKS URL."""
    with _JWKS_LOCK:
        if jwks_url not in _JWKS_CACHES:
            _JWKS_CACHES[jwks_url] = SupabaseJwksCache(jwks_url=jwks_url, http_client=http_client)
        return _JWKS_CACHES[jwks_url]


def get_current_guest_service(request: Request) -> GuestSessionService:
    """Dependency provider for the application guest session service."""
    if not hasattr(request.app.state, "guest_service"):
        # Lazily initialize if not pre-attached
        settings = getattr(request.app.state, "settings", None) or get_settings()
        request.app.state.guest_service = GuestSessionService(settings=settings)
    return request.app.state.guest_service


def verify_supabase_jwt(
    raw_jwt: str,
    settings: Settings,
    jwks_cache: Optional[SupabaseJwksCache] = None,
) -> dict[str, Any]:
    """Strictly verify a Supabase access token according to configured algorithm and security rules.
    
    Validates:
      - Enforced algorithm (HS256 or RS256, NEVER trusting header 'alg')
      - Signature verification
      - Audience (defaults to 'authenticated')
      - Issuer (if configured, matches exact URL)
      - Expiration (exp)
      - Not-before (nbf, if present)
      - UUID subject (sub)
      - Rejection of alg 'none' or algorithm confusion

    Returns:
        Decoded claims payload dictionary.

    Raises:
        HTTPException: 401 Unauthorized with consistent, safe error message.
    """
    if not raw_jwt or not isinstance(raw_jwt, str):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or malformed credentials.",
            headers={"WWW-Authenticate": "Bearer error=\"invalid_token\""},
        )

    configured_alg = settings.supabase_jwt_algorithm.upper()
    expected_aud = settings.supabase_jwt_audience
    expected_iss = settings.supabase_jwt_issuer
    if not expected_iss and settings.supabase_url:
        expected_iss = f"{settings.supabase_url.rstrip('/')}/auth/v1"

    options: dict[str, Any] = {
        "verify_signature": True,
        "verify_exp": True,
        "verify_nbf": True,
        "verify_aud": True,
        "require": ["exp", "sub", "aud"],
    }
    if expected_iss:
        options["verify_iss"] = True
        options["require"].append("iss")
    else:
        options["verify_iss"] = False

    # Extract unverified header strictly to obtain kid (for RS256)
    try:
        unverified_header = jwt.get_unverified_header(raw_jwt)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Malformed token header.",
            headers={"WWW-Authenticate": "Bearer error=\"invalid_token\""},
        ) from exc

    header_alg = unverified_header.get("alg")
    if not header_alg or header_alg.lower() == "none":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Insecure or missing token algorithm.",
            headers={"WWW-Authenticate": "Bearer error=\"invalid_token\""},
        )

    if header_alg.upper() != configured_alg:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token algorithm does not match configured verification policy.",
            headers={"WWW-Authenticate": "Bearer error=\"invalid_token\""},
        )

    # Resolve signing key based strictly on configured algorithm
    if configured_alg == "HS256":
        secret = settings.supabase_jwt_secret
        if not secret or not secret.strip():
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication service secret is unconfigured.",
                headers={"WWW-Authenticate": "Bearer error=\"invalid_token\""},
            )
        signing_key = secret.strip()
    elif configured_alg == "RS256":
        kid = unverified_header.get("kid")
        if not kid:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token header missing key ID (kid) required for RS256 verification.",
                headers={"WWW-Authenticate": "Bearer error=\"invalid_token\""},
            )
        if jwks_cache is None:
            if not settings.supabase_url:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Supabase URL must be configured for RS256 JWKS verification.",
                    headers={"WWW-Authenticate": "Bearer error=\"invalid_token\""},
                )
            jwks_url = f"{settings.supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json"
            jwks_cache = get_jwks_cache(jwks_url)

        try:
            signing_key = jwks_cache.get_signing_key(kid)
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Signing key could not be verified.",
                headers={"WWW-Authenticate": "Bearer error=\"invalid_token\""},
            ) from exc
    else:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Unsupported token algorithm: {configured_alg}",
            headers={"WWW-Authenticate": "Bearer error=\"invalid_token\""},
        )

    # Decode and verify token
    try:
        decode_kwargs: dict[str, Any] = {
            "algorithms": [configured_alg],  # NEVER trust token header to allow other algs
            "options": options,
            "audience": expected_aud,
        }
        if expected_iss:
            decode_kwargs["issuer"] = expected_iss

        payload = jwt.decode(raw_jwt, signing_key, **decode_kwargs)
    except jwt.ExpiredSignatureError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired.",
            headers={"WWW-Authenticate": "Bearer error=\"invalid_token\", error_description=\"The token has expired\""},
        ) from exc
    except jwt.ImmatureSignatureError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token is not yet valid.",
            headers={"WWW-Authenticate": "Bearer error=\"invalid_token\""},
        ) from exc
    except jwt.InvalidAudienceError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token audience.",
            headers={"WWW-Authenticate": "Bearer error=\"invalid_token\""},
        ) from exc
    except jwt.InvalidIssuerError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token issuer.",
            headers={"WWW-Authenticate": "Bearer error=\"invalid_token\""},
        ) from exc
    except (jwt.InvalidSignatureError, jwt.InvalidAlgorithmError, jwt.DecodeError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token signature or encoding.",
            headers={"WWW-Authenticate": "Bearer error=\"invalid_token\""},
        ) from exc
    except jwt.MissingRequiredClaimError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token is missing required claims.",
            headers={"WWW-Authenticate": "Bearer error=\"invalid_token\""},
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials.",
            headers={"WWW-Authenticate": "Bearer error=\"invalid_token\""},
        ) from exc

    # Validate subject (sub) is a valid UUID
    sub = payload.get("sub")
    if not sub:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing subject identifier.",
            headers={"WWW-Authenticate": "Bearer error=\"invalid_token\""},
        )
    try:
        uuid.UUID(str(sub))
    except (ValueError, TypeError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token subject must be a valid UUID.",
            headers={"WWW-Authenticate": "Bearer error=\"invalid_token\""},
        ) from exc

    return payload


def get_current_identity(
    request: Request,
    authorization: Annotated[Optional[str], Header(alias="Authorization")] = None,
    x_guest_session: Annotated[Optional[str], Header(alias="X-Guest-Session")] = None,
) -> UserIdentity:
    """FastAPI dependency resolving and verifying the caller identity.
    
    Resolution hierarchy:
    1. Authorization: Bearer <jwt> -> Authenticated Supabase User (UserIdentity with is_guest=False)
    2. X-Guest-Session: <token>     -> Verified Guest Session (UserIdentity with is_guest=True)
    3. Missing / Invalid            -> HTTP 401 Unauthorized
    """
    active_settings = getattr(request.app.state, "settings", None) or get_settings()
    active_guest_service = get_current_guest_service(request)

    # 1. Check Authenticated User JWT Bearer Token
    if authorization:
        parts = authorization.strip().split()
        if len(parts) != 2 or parts[0].lower() != "bearer":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authorization header must follow 'Bearer <token>' format.",
                headers={"WWW-Authenticate": "Bearer error=\"invalid_request\""},
            )
        token = parts[1]
        payload = verify_supabase_jwt(token, settings=active_settings)
        return UserIdentity(
            user_id=str(payload["sub"]),
            email=payload.get("email"),
            is_guest=False,
            guest_session_id=None,
        )

    # 2. Check Guest Session Token
    if x_guest_session:
        record = active_guest_service.validate_guest_token(x_guest_session)
        if record is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Guest session is invalid or expired.",
                headers={"WWW-Authenticate": "GuestSession error=\"invalid_token\""},
            )
        return UserIdentity(
            user_id=str(record.guest_id),
            email=None,
            is_guest=True,
            guest_session_id=x_guest_session.strip(),
        )

    # 3. Neither authentication method provided
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication required. Please provide a Bearer token or guest session.",
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_optional_identity(
    request: Request,
    authorization: Annotated[Optional[str], Header(alias="Authorization")] = None,
    x_guest_session: Annotated[Optional[str], Header(alias="X-Guest-Session")] = None,
) -> Optional[UserIdentity]:
    """Dependency that resolves identity if credentials are provided, returning None if unauthenticated."""
    if not authorization and not x_guest_session:
        return None
    return get_current_identity(
        request=request,
        authorization=authorization,
        x_guest_session=x_guest_session,
    )
