"""Application configuration settings."""

import os
from typing import Optional
from dotenv import load_dotenv
from pydantic import BaseModel, Field, model_validator


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
    }

    # Filter out None values so Pydantic model defaults apply
    clean_values = {k: v for k, v in raw_values.items() if v is not None}
    clean_values.update(overrides)

    return Settings(**clean_values)
