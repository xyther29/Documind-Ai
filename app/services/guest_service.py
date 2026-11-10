"""In-memory guest session service with cryptographic tokens, atomic quotas, idempotency, and abuse controls."""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
import hashlib
import secrets
import threading
import time
from typing import Callable, Optional
import uuid

from fastapi import HTTPException, Request, status

from app.config import Settings
from app.models.auth_schemas import GuestSessionResponse, UserIdentity
from app.models.schemas import AskResponse


class IdempotencyState(str, Enum):
    """Lifecycle states of an idempotent question request."""

    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


@dataclass
class QuestionIdempotencyRecord:
    """Async-safe coordination record for an idempotent question submission."""

    request_id: str
    created_at: float
    state: IdempotencyState = IdempotencyState.PROCESSING
    completed_at: Optional[float] = None
    response: Optional[AskResponse] = None
    error_status: Optional[int] = None
    error_detail: Optional[str] = None
    event: threading.Event = field(default_factory=threading.Event, repr=False)

    def mark_completed(self, response: AskResponse, current_time: float) -> None:
        """Mark record as completed, cache response, and notify all async waiters."""
        self.state = IdempotencyState.COMPLETED
        self.response = response
        self.completed_at = current_time
        self.event.set()

    def mark_failed(self, status_code: int, detail: str, current_time: float) -> None:
        """Mark record as failed, record error info, and notify all async waiters."""
        self.state = IdempotencyState.FAILED
        self.error_status = status_code
        self.error_detail = detail
        self.completed_at = current_time
        self.event.set()


class QuestionIdempotencyRegistry:
    """Thread-safe, bounded registry for question idempotency records with async coordination."""

    def __init__(self, max_capacity: int = 50, ttl_seconds: float = 900.0) -> None:
        self._lock = threading.RLock()
        self._records: dict[str, QuestionIdempotencyRecord] = {}
        self.max_capacity = max_capacity
        self.ttl_seconds = ttl_seconds

    def get_existing(self, request_id: str) -> Optional[QuestionIdempotencyRecord]:
        """Check for existing record without modifying state."""
        with self._lock:
            return self._records.get(request_id)

    def register_processing(self, request_id: str, current_time: float) -> QuestionIdempotencyRecord:
        """Register a new request in PROCESSING state."""
        with self._lock:
            self._cleanup_under_lock(current_time)
            # If still over capacity after cleanup, evict oldest completed
            if len(self._records) >= self.max_capacity:
                self._evict_oldest_completed_under_lock()

            record = QuestionIdempotencyRecord(
                request_id=request_id,
                created_at=current_time,
                state=IdempotencyState.PROCESSING,
            )
            self._records[request_id] = record
            return record

    def _cleanup_under_lock(self, current_time: float) -> None:
        """Evict completed/failed records whose retention (completed_at + TTL) has expired.
        
        NEVER evicts in-flight PROCESSING records.
        """
        expired = [
            req_id for req_id, rec in self._records.items()
            if rec.state != IdempotencyState.PROCESSING
            and rec.completed_at is not None
            and (current_time - rec.completed_at > self.ttl_seconds)
        ]
        for req_id in expired:
            del self._records[req_id]

    def _evict_oldest_completed_under_lock(self) -> None:
        """Evict the oldest completed/failed record when capacity limit is reached."""
        candidates = [
            (rec.completed_at or rec.created_at, req_id)
            for req_id, rec in self._records.items()
            if rec.state != IdempotencyState.PROCESSING
        ]
        if candidates:
            candidates.sort()
            del self._records[candidates[0][1]]


class AuthenticatedIdempotencyManager:
    """Separate, bounded question idempotency registries for authenticated user partitions."""

    def __init__(self, max_capacity: int = 50, ttl_seconds: float = 900.0) -> None:
        self._lock = threading.RLock()
        self._registries: dict[str, QuestionIdempotencyRegistry] = {}
        self.max_capacity = max_capacity
        self.ttl_seconds = ttl_seconds

    def coordinate_question_acceptance(
        self,
        partition_id: str,
        request_id: str,
        current_time: float,
    ) -> tuple[Optional[QuestionIdempotencyRecord], Optional[QuestionIdempotencyRecord]]:
        """Coordinate question acceptance for authenticated users.
        
        Returns:
            (existing_record, None) if request_id is duplicate.
            (None, new_record) if new question was registered.
        """
        with self._lock:
            if partition_id not in self._registries:
                self._registries[partition_id] = QuestionIdempotencyRegistry(
                    max_capacity=self.max_capacity,
                    ttl_seconds=self.ttl_seconds,
                )
            registry = self._registries[partition_id]

        with registry._lock:
            existing = registry.get_existing(request_id)
            if existing is not None:
                return existing, None
            new_rec = registry.register_processing(request_id, current_time)
            return None, new_rec


class IPUsageTracker:
    """Strict Level 1 Lock manager tracking multi-tier IP abuse controls and resource budgets.
    
    Tiers:
      1. Burst issuance sliding window (rate limit).
      2. Active concurrent session cap per IP.
      3. Cumulative hourly resource budgets (documents and questions).
    """

    def __init__(self) -> None:
        self._lock = threading.RLock()
        # IP -> list of timestamps for issuance rate limiting
        self._issuance_history: dict[str, list[float]] = {}
        # IP -> set of active token hashes
        self._active_sessions_by_ip: dict[str, set[str]] = {}
        # IP -> {"documents": int, "in_flight": int, "questions": int, "window_start": float}
        self._hourly_usage: dict[str, dict[str, float]] = {}

    def check_and_record_issuance(self, client_ip: str, limit: int, current_time: float) -> bool:
        """Verify and record burst session issuance under 60-second window."""
        with self._lock:
            cutoff = current_time - 60.0
            timestamps = self._issuance_history.setdefault(client_ip, [])
            valid_ts = [ts for ts in timestamps if ts > cutoff]
            self._issuance_history[client_ip] = valid_ts

            if len(valid_ts) >= limit:
                return False

            valid_ts.append(current_time)
            return True

    def check_active_session_cap(self, client_ip: str, max_active: int, current_time: float) -> bool:
        """Verify whether client IP has reached maximum allowed concurrent active sessions."""
        with self._lock:
            active_set = self._active_sessions_by_ip.setdefault(client_ip, set())
            return len(active_set) < max_active

    def register_session(self, client_ip: str, token_hash: str) -> None:
        """Register active session token hash under client IP."""
        with self._lock:
            self._active_sessions_by_ip.setdefault(client_ip, set()).add(token_hash)

    def cleanup_expired_sessions(self, active_token_hashes: set[str]) -> None:
        """Purge expired session hashes from active IP tracking."""
        with self._lock:
            for ip in list(self._active_sessions_by_ip.keys()):
                self._active_sessions_by_ip[ip] &= active_token_hashes
                if not self._active_sessions_by_ip[ip]:
                    del self._active_sessions_by_ip[ip]

    def _get_or_reset_hourly_window(self, client_ip: str, current_time: float) -> dict[str, float]:
        usage = self._hourly_usage.setdefault(
            client_ip,
            {"documents": 0, "in_flight": 0, "questions": 0, "window_start": current_time},
        )
        if current_time - usage["window_start"] >= 3600.0:
            usage["documents"] = 0
            usage["in_flight"] = 0
            usage["questions"] = 0
            usage["window_start"] = current_time
        return usage

    def reserve_upload(self, client_ip: str, max_hourly: int, current_time: float) -> bool:
        """Atomically check and reserve 1 upload slot in the IP's hourly budget."""
        with self._lock:
            usage = self._get_or_reset_hourly_window(client_ip, current_time)
            if usage["documents"] + usage["in_flight"] >= max_hourly:
                return False
            usage["in_flight"] += 1
            return True

    def finalize_upload(self, client_ip: str, success: bool) -> None:
        """Finalize upload reservation into permanent count if successful, or release if failed."""
        with self._lock:
            usage = self._hourly_usage.get(client_ip)
            if usage:
                usage["in_flight"] = max(0, usage["in_flight"] - 1)
                if success:
                    usage["documents"] += 1

    def release_upload_reservation(self, client_ip: str) -> None:
        """Immediately release an upload reservation on failure."""
        with self._lock:
            usage = self._hourly_usage.get(client_ip)
            if usage:
                usage["in_flight"] = max(0, usage["in_flight"] - 1)

    def reserve_question(self, client_ip: str, max_hourly: int, current_time: float) -> bool:
        """Atomically check and reserve 1 question slot in the IP's hourly budget."""
        with self._lock:
            usage = self._get_or_reset_hourly_window(client_ip, current_time)
            if usage["questions"] >= max_hourly:
                return False
            usage["questions"] += 1
            return True

    def release_question_reservation(self, client_ip: str) -> None:
        """Release a question reservation if downstream session check fails."""
        with self._lock:
            usage = self._hourly_usage.get(client_ip)
            if usage:
                usage["questions"] = max(0, usage["questions"] - 1)


@dataclass
class GuestSessionRecord:
    """Internal server-side representation of an active guest session."""

    guest_id: uuid.UUID
    created_at: float
    expires_at: float
    documents_uploaded: int = 0
    in_flight_uploads: int = 0
    questions_asked: int = 0
    revoked: bool = False
    idempotency: QuestionIdempotencyRegistry = field(
        default_factory=QuestionIdempotencyRegistry, repr=False
    )
    _lock: threading.RLock = field(default_factory=threading.RLock, repr=False)

    def is_expired(self, current_time: float) -> bool:
        """Check whether the session has passed its expiration time or was revoked."""
        return self.revoked or (current_time >= self.expires_at)

    def record_document_upload(self, max_docs: int) -> bool:
        """Atomically record document upload if within quota (alias for tests)."""
        with self._lock:
            if self.documents_uploaded + self.in_flight_uploads >= max_docs:
                return False
            self.documents_uploaded += 1
            return True

    def record_question_ask(self, max_questions: int) -> bool:
        """Atomically record question ask if within quota (alias for tests)."""
        return self.record_question(max_questions)

    def reserve_upload(self, max_docs: int) -> bool:
        """Atomically check and reserve 1 upload slot if within guest session cap."""
        with self._lock:
            if self.documents_uploaded + self.in_flight_uploads >= max_docs:
                return False
            self.in_flight_uploads += 1
            return True

    def finalize_upload(self, success: bool) -> None:
        """Finalize reservation: decrement in-flight; if success increment documents_uploaded."""
        with self._lock:
            self.in_flight_uploads = max(0, self.in_flight_uploads - 1)
            if success:
                self.documents_uploaded += 1

    def record_document_delete(self) -> None:
        """Decrement active document count when a document is deleted from partition."""
        with self._lock:
            self.documents_uploaded = max(0, self.documents_uploaded - 1)

    def record_question(self, max_questions: int) -> bool:
        """Atomically record question ask if within guest session cap."""
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
                "in_flight_uploads": self.in_flight_uploads,
                "questions_asked": self.questions_asked,
            }


class GuestSessionService:
    """Thread-safe manager for ephemeral guest sessions, quotas, and multi-tier abuse controls.
    
    Enforces strict lock acquisition hierarchy:
      Level 1: IPUsageTracker._lock
      Level 2: GuestSessionRecord._lock
    """

    def __init__(
        self,
        settings: Settings,
        clock: Optional[Callable[[], float]] = None,
    ):
        self.settings = settings
        self.clock = clock or time.time
        self._lock = threading.RLock()
        self.ip_tracker = IPUsageTracker()
        # Maps token SHA-256 hash -> GuestSessionRecord
        self._sessions: dict[str, GuestSessionRecord] = {}
        # Maps guest_id UUID -> GuestSessionRecord
        self._sessions_by_id: dict[uuid.UUID, GuestSessionRecord] = {}
        self._last_cleanup: float = self.clock()

    @staticmethod
    def hash_token(raw_token: str) -> str:
        """Generate SHA-256 hex digest of the raw guest token."""
        return hashlib.sha256(raw_token.strip().encode("utf-8")).hexdigest()

    def _cleanup_expired_under_lock(self, current_time: float) -> None:
        """Remove expired sessions from internal dictionaries and sync IP tracker."""
        expired_hashes = [
            th for th, rec in self._sessions.items()
            if rec.is_expired(current_time)
        ]
        for th in expired_hashes:
            rec = self._sessions.pop(th, None)
            if rec:
                self._sessions_by_id.pop(rec.guest_id, None)

        active_hashes = set(self._sessions.keys())
        self.ip_tracker.cleanup_expired_sessions(active_hashes)
        self._last_cleanup = current_time

    def create_guest_session(self, client_ip: str = "unknown") -> GuestSessionResponse:
        """Create a new ephemeral guest session enforcing burst limit and active session cap.
        
        Never recovers or returns raw tokens on active cap collision; raises RuntimeError(429).
        """
        now = self.clock()

        # Enforce Level 1 Lock (IP tracker)
        with self.ip_tracker._lock:
            # 1. Burst issuance rate limit
            if not self.ip_tracker.check_and_record_issuance(
                client_ip, self.settings.guest_issuance_rate_limit, now
            ):
                raise RuntimeError(
                    f"Guest session issuance limit exceeded ({self.settings.guest_issuance_rate_limit}/min). "
                    f"Please wait before requesting a new session."
                )

            # Cleanup expired sessions periodically
            if now - self._last_cleanup > 60.0:
                with self._lock:
                    self._cleanup_expired_under_lock(now)
            else:
                active_hashes = set(self._sessions.keys())
                self.ip_tracker.cleanup_expired_sessions(active_hashes)

            # 2. Active concurrent session cap
            if not self.ip_tracker.check_active_session_cap(
                client_ip, self.settings.guest_max_active_sessions_per_ip, now
            ):
                raise RuntimeError(
                    f"Active guest session limit reached for this network ({self.settings.guest_max_active_sessions_per_ip} max). "
                    f"Please use your existing session in this browser or wait for it to expire."
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
                self._sessions_by_id[guest_id] = record

            # Register under Level 1 lock
            self.ip_tracker.register_session(client_ip, token_hash)

        dt_expires = datetime.fromtimestamp(expires_at, tz=timezone.utc)
        return GuestSessionResponse(
            guest_token=raw_token,
            expires_at=dt_expires,
            max_documents=self.settings.guest_max_documents,
            max_questions=self.settings.guest_max_questions,
        )

    def validate_guest_token(self, raw_token: str) -> Optional[GuestSessionRecord]:
        """Validate raw guest token against in-memory session store."""
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
                del self._sessions[token_hash]
                self._sessions_by_id.pop(record.guest_id, None)
                return None

            return record

    def get_session_by_id(self, guest_id: uuid.UUID) -> Optional[GuestSessionRecord]:
        """Lookup guest session record by its guest UUID."""
        with self._lock:
            return self._sessions_by_id.get(guest_id)

    def coordinate_upload_reservation(
        self,
        guest_id: uuid.UUID,
        client_ip: str,
        current_time: float,
    ) -> None:
        """Atomically reserve IP (Level 1) and Session (Level 2) upload capacity."""
        with self.ip_tracker._lock:
            record = self.get_session_by_id(guest_id)
            if record is None or record.is_expired(current_time):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Guest session is invalid or expired.",
                )

            with record._lock:
                if not self.ip_tracker.reserve_upload(
                    client_ip, self.settings.guest_hourly_max_documents, current_time
                ):
                    raise HTTPException(
                        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                        detail=(
                            f"Hourly document upload limit exceeded for this network "
                            f"({self.settings.guest_hourly_max_documents}/hr). "
                            f"Please sign up to continue."
                        ),
                    )

                if not record.reserve_upload(self.settings.guest_max_documents):
                    self.ip_tracker.release_upload_reservation(client_ip)
                    raise HTTPException(
                        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                        detail=(
                            f"Guest document limit exceeded ({self.settings.guest_max_documents} max). "
                            f"Please sign up to upload more documents."
                        ),
                    )

    def finalize_upload(
        self,
        guest_id: uuid.UUID,
        client_ip: str,
        success: bool,
    ) -> None:
        """Finalize or release upload reservations enforcing Level 1 -> Level 2 hierarchy."""
        with self.ip_tracker._lock:
            self.ip_tracker.finalize_upload(client_ip, success=success)
            record = self.get_session_by_id(guest_id)
            if record is not None:
                with record._lock:
                    record.finalize_upload(success=success)

    def record_document_delete(self, guest_id: uuid.UUID) -> None:
        """Record document deletion under session lock to decrement active document count."""
        record = self.get_session_by_id(guest_id)
        if record is not None:
            with record._lock:
                record.record_document_delete()

    def coordinate_question_acceptance(
        self,
        guest_id: uuid.UUID,
        client_ip: str,
        request_id: str,
        current_time: float,
    ) -> tuple[Optional[QuestionIdempotencyRecord], Optional[QuestionIdempotencyRecord]]:
        """Atomically check idempotency and reserve quotas under Level 1 -> Level 2 locks.
        
        Returns:
            (existing_record, None) if request_id is duplicate (zero quota consumed).
            (None, new_record) if new question was accepted and quotas reserved.
        """
        with self.ip_tracker._lock:
            record = self.get_session_by_id(guest_id)
            if record is None or record.is_expired(current_time):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Guest session is invalid or expired.",
                )

            with record._lock:
                # 1. Check if request_id already exists in idempotency registry
                existing = record.idempotency.get_existing(request_id)
                if existing is not None:
                    return existing, None

                # 2. Check IP hourly question quota
                if not self.ip_tracker.reserve_question(
                    client_ip, self.settings.guest_hourly_max_questions, current_time
                ):
                    raise HTTPException(
                        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                        detail=(
                            f"Hourly question limit exceeded for this network "
                            f"({self.settings.guest_hourly_max_questions}/hr). "
                            f"Please sign up to continue."
                        ),
                    )

                # 3. Check guest session question quota
                if not record.record_question(self.settings.guest_max_questions):
                    self.ip_tracker.release_question_reservation(client_ip)
                    raise HTTPException(
                        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                        detail=(
                            f"Guest question limit exceeded ({self.settings.guest_max_questions}/{self.settings.guest_max_questions}). "
                            f"Please sign up to continue asking questions."
                        ),
                    )

                # 4. Both quotas accepted! Register PROCESSING record
                new_rec = record.idempotency.register_processing(request_id, current_time)
                return None, new_rec

    def revoke_guest_session(self, raw_token: str) -> bool:
        """Revoke an active guest session."""
        token_hash = self.hash_token(raw_token)
        with self._lock:
            record = self._sessions.pop(token_hash, None)
            if record is not None:
                self._sessions_by_id.pop(record.guest_id, None)
                record.revoked = True
                return True
            return False

    def session_count(self) -> int:
        """Return total active session count."""
        now = self.clock()
        with self._lock:
            return sum(1 for rec in self._sessions.values() if not rec.is_expired(now))


def extract_client_ip(request: Request, settings: Settings) -> str:
    """Extract client IP respecting trusted reverse proxies to prevent X-Forwarded-For spoofing.
    
    If request.client.host is in settings.trusted_proxies, reads original client IP
    from X-Forwarded-For. Otherwise, strictly uses direct peer host.
    """
    direct_peer = "unknown"
    if request.client and request.client.host:
        direct_peer = request.client.host

    trusted = set(settings.trusted_proxies or [])
    if direct_peer in trusted:
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            parts = [ip.strip() for ip in forwarded_for.split(",") if ip.strip()]
            if parts:
                return parts[0]
    return direct_peer
