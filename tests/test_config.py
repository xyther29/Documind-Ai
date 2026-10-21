"""Unit tests for application configuration settings."""

import pytest
from pydantic import ValidationError
from app.config import Settings, get_settings


def test_default_settings(monkeypatch):
    """Verify default configuration values match project specifications."""
    monkeypatch.delenv("GEMINI_MODEL", raising=False)
    monkeypatch.delenv("GEMINI_TIMEOUT_SECONDS", raising=False)
    settings = Settings()
    assert settings.max_file_size_bytes == 10 * 1024 * 1024  # 10 MB
    assert settings.target_chunk_words == 120
    assert settings.chunk_overlap_words == 30
    assert settings.default_top_k == 4
    assert settings.host == "127.0.0.1"
    assert settings.port == 8000
    assert settings.gemini_model == "gemini-3.5-flash-lite"
    assert settings.gemini_timeout_seconds == 30.0
    assert settings.gemini_api_key is None


def test_custom_valid_settings():
    """Verify custom valid settings instantiate properly."""
    settings = Settings(
        max_file_size_bytes=5 * 1024 * 1024,
        target_chunk_words=100,
        chunk_overlap_words=20,
        default_top_k=5,
        host="0.0.0.0",
        port=9000,
    )
    assert settings.max_file_size_bytes == 5 * 1024 * 1024
    assert settings.target_chunk_words == 100
    assert settings.chunk_overlap_words == 20
    assert settings.default_top_k == 5
    assert settings.host == "0.0.0.0"
    assert settings.port == 9000


def test_invalid_overlap_equal_or_greater():
    """Verify that chunk overlap cannot be equal to or greater than target chunk words."""
    with pytest.raises(ValidationError):
        Settings(target_chunk_words=100, chunk_overlap_words=100)

    with pytest.raises(ValidationError):
        Settings(target_chunk_words=100, chunk_overlap_words=120)


def test_non_positive_values_rejected():
    """Verify that file size, chunk targets, and top_k must be positive."""
    with pytest.raises(ValidationError):
        Settings(max_file_size_bytes=0)

    with pytest.raises(ValidationError):
        Settings(target_chunk_words=0)

    with pytest.raises(ValidationError):
        Settings(default_top_k=0)

    with pytest.raises(ValidationError):
        Settings(chunk_overlap_words=-1)


def test_get_settings_env_override(monkeypatch):
    """Verify get_settings correctly respects environment variables."""
    monkeypatch.setenv("MAX_FILE_SIZE_BYTES", "2097152")  # 2 MB
    monkeypatch.setenv("TARGET_CHUNK_WORDS", "150")
    monkeypatch.setenv("CHUNK_OVERLAP_WORDS", "25")
    monkeypatch.setenv("DEFAULT_TOP_K", "6")

    settings = get_settings()
    assert settings.max_file_size_bytes == 2097152
    assert settings.target_chunk_words == 150
    assert settings.chunk_overlap_words == 25
    assert settings.default_top_k == 6


def test_get_settings_with_env_file(tmp_path):
    """Verify get_settings reads from a specified env file."""
    env_file = tmp_path / "custom.env"
    env_file.write_text("TARGET_CHUNK_WORDS=80\nCHUNK_OVERLAP_WORDS=15\n")

    settings = get_settings(env_file=str(env_file))
    assert settings.target_chunk_words == 80
    assert settings.chunk_overlap_words == 15
