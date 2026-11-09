"""Authentication and identity models and schemas for DocuMind AI."""

from __future__ import annotations

from datetime import datetime
from typing import Optional
import uuid
from pydantic import BaseModel, Field, field_validator


class UserIdentity(BaseModel):
    """Represents a verified caller identity (authenticated user or guest session)."""

    user_id: str = Field(..., description="Unique UUID identifier for the user or guest session.")
    email: Optional[str] = Field(default=None, description="Email address of the authenticated user, or None for guests.")
    is_guest: bool = Field(default=False, description="True if caller is a temporary guest session.")
    guest_session_id: Optional[str] = Field(default=None, description="Server-side session ID if caller is a guest.")

    @field_validator("user_id")
    @classmethod
    def validate_user_id_is_uuid(cls, v: str) -> str:
        """Enforce that user_id is a valid UUID string."""
        try:
            uuid.UUID(str(v))
        except (ValueError, AttributeError, TypeError) as exc:
            raise ValueError(f"user_id must be a valid UUID string, got: {v}") from exc
        return str(v)

    @property
    def partition_id(self) -> str:
        """Derived storage partition key guaranteeing namespace isolation."""
        if self.is_guest:
            return f"guest_{self.user_id}"
        return f"user_{self.user_id}"


class GuestSessionResponse(BaseModel):
    """Response payload returned when a temporary guest session is issued."""

    guest_token: str = Field(..., description="Raw secret guest session token returned only once.")
    expires_at: datetime = Field(..., description="UTC ISO-8601 timestamp when the session expires.")
    max_documents: int = Field(default=1, description="Maximum documents allowed for this guest session.")
    max_questions: int = Field(default=5, description="Maximum questions allowed for this guest session.")


class AuthMeResponse(BaseModel):
    """Response payload for current identity verification."""

    user_id: str
    email: Optional[str] = None
    is_guest: bool
    display_name: Optional[str] = None
