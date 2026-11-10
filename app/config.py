"""Application configuration settings."""

import os
from typing import Optional
from dotenv import load_dotenv
from pydantic import BaseModel, Field, field_validator, model_validator


class Settings(BaseModel):
    """Configuration settings for DocuMind AI."""

    max_file_size_bytes: int = Field(default=10 * 1024 * 1024, gt=0)
    target_chunk_words: int = Field(default=120, gt=0)
    chunk_overlap_words: int = Field(default=30, ge=0)
    default_top_k: int = Field(default=4, gt=0)
    host: str = Field(default="127.0.0.1")
    port: int = Field(default=8000, gt=0, le=65535)

    # Gemini integration settings
    gemini_api_key: Optional[str] = Field(default=None)
    gemini_model: str = Field(default="gemini-3.5-flash-lite")
    gemini_timeout_seconds: float = Field(default=30.0, gt=0.0)

    # Supabase Auth settings
    supabase_url: Optional[str] = Field(default=None)
    supabase_anon_key: Optional[str] = Field(default=None)
    supabase_jwt_secret: Optional[str] = Field(default=None)
    supabase_jwt_algorithm: str = Field(default="HS256")
    supabase_jwt_audience: str = Field(default="authenticated")
    supabase_jwt_issuer: Optional[str] = Field(default=None)

    # Guest session settings
    guest_session_ttl_minutes: int = Field(default=60, gt=0)
    guest_max_documents: int = Field(default=1, gt=0)
    guest_max_questions: int = Field(default=5, gt=0)
    guest_issuance_rate_limit: int = Field(default=30, gt=0)
    guest_max_active_sessions_per_ip: int = Field(default=10, gt=0)
    guest_hourly_max_documents: int = Field(default=5, gt=0)
    guest_hourly_max_questions: int = Field(default=25, gt=0)
    trusted_proxies: list[str] = Field(default_factory=lambda: ["127.0.0.1", "::1", "testclient"])

    @field_validator("supabase_jwt_algorithm")
    @classmethod
    def validate_jwt_algorithm(cls, v: str) -> str:
        clean = v.strip().upper()
        if clean not in ("HS256", "RS256"):
            raise ValueError(f"supabase_jwt_algorithm must be 'HS256' or 'RS256', got: {v}")
        return clean

    @model_validator(mode="after")
    def validate_overlap(self) -> "Settings":
        """Ensure chunk overlap is strictly smaller than the target chunk word count."""
        if self.chunk_overlap_words >= self.target_chunk_words:
            raise ValueError(
                f"chunk_overlap_words ({self.chunk_overlap_words}) must be less than "
                f"target_chunk_words ({self.target_chunk_words})"
            )
        return self


def get_settings(env_file: Optional[str] = None, **overrides) -> Settings:
    """Load settings from environment variables and optional .env file with safe defaults."""
    if env_file:
        load_dotenv(dotenv_path=env_file, override=True)
    else:
        load_dotenv(override=False)

    api_key = os.getenv("GEMINI_API_KEY")
    # Treat unconfigured, empty, or example placeholder key as None
    if api_key:
        api_key_clean = api_key.strip()
        if not api_key_clean or api_key_clean == "your_gemini_api_key_here":
            api_key = None
        else:
            api_key = api_key_clean
    else:
        api_key = None

    raw_values = {
        "max_file_size_bytes": os.getenv("MAX_FILE_SIZE_BYTES"),
        "target_chunk_words": os.getenv("TARGET_CHUNK_WORDS"),
        "chunk_overlap_words": os.getenv("CHUNK_OVERLAP_WORDS"),
        "default_top_k": os.getenv("DEFAULT_TOP_K"),
        "host": os.getenv("HOST"),
        "port": os.getenv("PORT"),
        "gemini_api_key": api_key,
        "gemini_model": os.getenv("GEMINI_MODEL"),
        "gemini_timeout_seconds": os.getenv("GEMINI_TIMEOUT_SECONDS"),
        "supabase_url": os.getenv("SUPABASE_URL"),
        "supabase_anon_key": os.getenv("SUPABASE_ANON_KEY"),
        "supabase_jwt_secret": os.getenv("SUPABASE_JWT_SECRET"),
        "supabase_jwt_algorithm": os.getenv("SUPABASE_JWT_ALGORITHM"),
        "supabase_jwt_audience": os.getenv("SUPABASE_JWT_AUDIENCE"),
        "supabase_jwt_issuer": os.getenv("SUPABASE_JWT_ISSUER"),
        "guest_session_ttl_minutes": os.getenv("GUEST_SESSION_TTL_MINUTES"),
        "guest_max_documents": os.getenv("GUEST_MAX_DOCUMENTS"),
        "guest_max_questions": os.getenv("GUEST_MAX_QUESTIONS"),
        "guest_issuance_rate_limit": os.getenv("GUEST_ISSUANCE_RATE_LIMIT"),
        "guest_max_active_sessions_per_ip": os.getenv("GUEST_MAX_ACTIVE_SESSIONS_PER_IP"),
        "guest_hourly_max_documents": os.getenv("GUEST_HOURLY_MAX_DOCUMENTS"),
        "guest_hourly_max_questions": os.getenv("GUEST_HOURLY_MAX_QUESTIONS"),
        "trusted_proxies": (
            [p.strip() for p in os.getenv("TRUSTED_PROXIES").split(",") if p.strip()]
            if os.getenv("TRUSTED_PROXIES")
            else None
        ),
    }

    # Filter out None values so Pydantic model defaults apply
    clean_values = {k: v for k, v in raw_values.items() if v is not None}
    clean_values.update(overrides)

    return Settings(**clean_values)
