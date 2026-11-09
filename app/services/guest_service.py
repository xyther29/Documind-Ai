"""In-memory guest session service with cryptographic tokens, atomic quotas, and issuance rate limiting."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
import hashlib
import secrets
import threading
import time
from typing import Callable, Optional
import uuid

from app.config import Settings
from app.models.auth_schemas import GuestSessionResponse, UserIdentity


@dataclass
class GuestSessionRecord:
    """Internal server-side representation of an active guest session."""

    guest_id: uuid.UUID
    created_at: float
    expires_at: float
    documents_uploaded: int = 0
    questions_asked: int = 0
    revoked: bool = False
    _lock: threading.Lock = field(default_factory=threading.Lock, repr=False)

    def is_expired(self, current_time: float) -> bool:
        """Check whether the session has passed its expiration time or was revoked."""
        return self.revoked or (current_time >= self.expires_at)

    def record_document_upload(self, max_docs: int) -> bool:
        """Atomically record document upload if within quota.
        
        Returns:
            True if upload quota was consumed, False if quota was already exceeded.
        """
        with self._lock:
            if self.documents_uploaded >= max_docs:
                return False
            self.documents_uploaded += 1
            return True

    def record_question_ask(self, max_questions: int) -> bool:
        """Atomically record question ask if within quota.
        
        Returns:
            True if question quota was consumed, False if quota was already exceeded.
        """
        with self._lock:
            if self.questions_asked >= max_questions:
                return False
            self.questions_asked += 1
            return True

    def get_quota_status(self) -> dict[str, int]:
        """Return current quota consumption metrics."""
        with self._lock:
            return {
                "documents_uploaded": self.documents_uploaded,
                "questions_asked": self.questions_asked,
            }


class GuestSessionService:
    """Thread-safe manager for ephemeral guest sessions and issuance rate limiting."""

    def __init__(
        self,
        settings: Settings,
        clock: Optional[Callable[[], float]] = None,
    ):
        self.settings = settings
        self.clock = clock or time.time
        self._lock = threading.RLock()
        # Storage maps token SHA-256 hash -> GuestSessionRecord
        self._sessions: dict[str, GuestSessionRecord] = {}
        # Sliding-window rate limit tracker: ip -> list of timestamps
        self._issuance_history: dict[str, list[float]] = {}
        self._last_cleanup: float = self.clock()

    @staticmethod
    def hash_token(raw_token: str) -> str:
        """Generate SHA-256 hex digest of the raw guest token."""
        return hashlib.sha256(raw_token.strip().encode("utf-8")).hexdigest()

    def _cleanup_expired_under_lock(self, current_time: float) -> None:
        """Remove expired sessions and old rate-limit entries."""
        # Clean sessions
        expired_hashes = [
            th for th, rec in self._sessions.items()
            if rec.is_expired(current_time)
        ]
        for th in expired_hashes:
            del self._sessions[th]

        # Clean rate-limit history older than 60 seconds
        cutoff = current_time - 60.0
        for ip in list(self._issuance_history.keys()):
            valid_ts = [ts for ts in self._issuance_history[ip] if ts > cutoff]
            if valid_ts:
                self._issuance_history[ip] = valid_ts
            else:
                del self._issuance_history[ip]

        self._last_cleanup = current_time

    def check_rate_limit(self, client_ip: str) -> bool:
        """Atomically verify and record issuance rate limit for client IP.
        
        Returns:
            True if request is permitted under rate limit, False if limit exceeded.
        """
        now = self.clock()
        cutoff = now - 60.0
        limit = self.settings.guest_issuance_rate_limit

        with self._lock:
            # Periodic cleanup roughly every 60 seconds
            if now - self._last_cleanup > 60.0:
                self._cleanup_expired_under_lock(now)

            timestamps = self._issuance_history.setdefault(client_ip, [])
            valid_timestamps = [ts for ts in timestamps if ts > cutoff]
            self._issuance_history[client_ip] = valid_timestamps

            if len(valid_timestamps) >= limit:
                return False

            valid_timestamps.append(now)
            return True

    def create_guest_session(self, client_ip: str = "unknown") -> GuestSessionResponse:
        """Create a new ephemeral guest session.
        
        Generates a high-entropy secret token, stores only its SHA-256 hash, and
        returns the raw token strictly once in the response.

        Raises:
            RuntimeError: If client IP exceeds issuance rate limit.
        """
        if not self.check_rate_limit(client_ip):
            raise RuntimeError(
                f"Guest session issuance limit exceeded ({self.settings.guest_issuance_rate_limit}/min). "
                f"Please wait before requesting a new session."
            )

        now = self.clock()
        ttl_seconds = self.settings.guest_session_ttl_minutes * 60.0
        expires_at = now + ttl_seconds

        guest_id = uuid.uuid4()
        raw_token = f"gstd_{secrets.token_urlsafe(32)}"
        token_hash = self.hash_token(raw_token)

        record = GuestSessionRecord(
            guest_id=guest_id,
            created_at=now,
            expires_at=expires_at,
        )

        with self._lock:
            self._sessions[token_hash] = record

        dt_expires = datetime.fromtimestamp(expires_at, tz=timezone.utc)
        return GuestSessionResponse(
            guest_token=raw_token,
            expires_at=dt_expires,
            max_documents=self.settings.guest_max_documents,
            max_questions=self.settings.guest_max_questions,
        )

    def validate_guest_token(self, raw_token: str) -> Optional[GuestSessionRecord]:
        """Validate raw guest token against in-memory session store.
        
        Returns:
            GuestSessionRecord if token is valid and unexpired, None otherwise.
        """
        if not raw_token or not isinstance(raw_token, str):
            return None

        clean_token = raw_token.strip()
        if not clean_token.startswith("gstd_"):
            return None

        token_hash = self.hash_token(clean_token)
        now = self.clock()

        with self._lock:
            record = self._sessions.get(token_hash)
            if record is None:
                return None

            if record.is_expired(now):
                # Evict immediately upon detecting expiration
                del self._sessions[token_hash]
                return None

            return record

    def revoke_guest_session(self, raw_token: str) -> bool:
        """Revoke an active guest session."""
        token_hash = self.hash_token(raw_token)
        with self._lock:
            record = self._sessions.pop(token_hash, None)
            if record is not None:
                record.revoked = True
                return True
            return False

    def session_count(self) -> int:
        """Return total active session count."""
        now = self.clock()
        with self._lock:
            return sum(1 for rec in self._sessions.values() if not rec.is_expired(now))
