"""Authentication and guest session endpoints."""

from __future__ import annotations

from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.auth import get_current_guest_service
from app.models.auth_schemas import GuestSessionResponse
from app.services.guest_service import GuestSessionService

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post(
    "/guest-session",
    response_model=GuestSessionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Issue a temporary guest demo session",
)
def create_guest_session(
    request: Request,
    guest_service: Annotated[GuestSessionService, Depends(get_current_guest_service)],
) -> GuestSessionResponse:
    """Issue a new ephemeral guest session token.
    
    The raw guest token is returned strictly once in the response.
    Enforces per-IP issuance rate limits and default document/question quotas.
    """
    client_ip = "unknown"
    if request.client and request.client.host:
        client_ip = request.client.host

    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        client_ip = forwarded_for.split(",")[0].strip()

    try:
        session = guest_service.create_guest_session(client_ip=client_ip)
        return session
    except RuntimeError as err:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=str(err),
        ) from err
