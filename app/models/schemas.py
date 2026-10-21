"""Pydantic schemas for documents, chunks, and search."""

from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel, Field, field_validator, model_validator


def _validate_page_metadata(
    start_page: int,
    end_page: int,
    pages: list[int],
    page_citation: str,
) -> None:
    """Validate that page numbers, ranges, and citation strings are consistent."""
    if end_page < start_page:
        raise ValueError(
            f"end_page ({end_page}) cannot be less than start_page ({start_page})"
        )

    if not pages:
        raise ValueError("pages list cannot be empty")

    if any(p < 1 for p in pages):
        raise ValueError("All page numbers in pages must be >= 1")

    # Verify uniqueness and sorted order
    if pages != sorted(set(pages)):
        raise ValueError("pages must be a sorted, unique list of page numbers")

    if pages[0] != start_page:
        raise ValueError(
            f"First page in pages ({pages[0]}) must match start_page ({start_page})"
        )

    if pages[-1] != end_page:
        raise ValueError(
            f"Last page in pages ({pages[-1]}) must match end_page ({end_page})"
        )

    expected_citation = (
        f"p. {start_page}" if start_page == end_page else f"pp. {start_page}-{end_page}"
    )
    if page_citation != expected_citation:
        raise ValueError(
            f"page_citation '{page_citation}' does not match expected '{expected_citation}'"
        )


class DocumentMeta(BaseModel):
    """Metadata for an ingested PDF document stored in memory."""

    doc_id: str = Field(..., min_length=1)
    filename: str = Field(..., min_length=1)
    page_count: int = Field(..., ge=1)
    chunk_count: int = Field(..., ge=0)
    file_size_bytes: int = Field(..., gt=0)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )

    @field_validator("created_at")
    @classmethod
    def validate_timezone_aware(cls, v: datetime) -> datetime:
        """Ensure created_at is timezone-aware and converted to UTC."""
        if v.tzinfo is None:
            raise ValueError("created_at must be a timezone-aware datetime")
        return v.astimezone(timezone.utc)


class Chunk(BaseModel):
    """A single page-aware text chunk with source attribution."""

    chunk_id: str = Field(..., min_length=1)
    doc_id: str = Field(..., min_length=1)
    filename: str = Field(..., min_length=1)
    text: str = Field(..., min_length=1)
    start_page: int = Field(..., ge=1)
    end_page: int = Field(..., ge=1)
    pages: list[int] = Field(..., min_length=1)
    page_citation: str = Field(..., min_length=1)

    @model_validator(mode="after")
    def validate_pages_and_citation(self) -> "Chunk":
        """Validate consistency of pages, range, and citation."""
        _validate_page_metadata(
            start_page=self.start_page,
            end_page=self.end_page,
            pages=self.pages,
            page_citation=self.page_citation,
        )
        return self


class SearchRequest(BaseModel):
    """Query payload for TF-IDF retrieval."""

    query: str = Field(..., min_length=1)
    doc_id: Optional[str] = None
    top_k: Optional[int] = Field(default=None, gt=0, le=50)

    @field_validator("query")
    @classmethod
    def validate_query(cls, v: str) -> str:
        """Ensure query is non-empty after stripping leading/trailing whitespace."""
        stripped = v.strip()
        if not stripped:
            raise ValueError("query cannot be empty or whitespace only")
        return stripped


class SearchResult(BaseModel):
    """An individual ranked search result."""

    chunk_id: str = Field(..., min_length=1)
    doc_id: str = Field(..., min_length=1)
    filename: str = Field(..., min_length=1)
    text: str = Field(..., min_length=1)
    start_page: int = Field(..., ge=1)
    end_page: int = Field(..., ge=1)
    pages: list[int] = Field(..., min_length=1)
    page_citation: str = Field(..., min_length=1)
    score: float = Field(..., ge=0.0)

    @model_validator(mode="after")
    def validate_pages_and_citation(self) -> "SearchResult":
        """Validate consistency of pages, range, and citation."""
        _validate_page_metadata(
            start_page=self.start_page,
            end_page=self.end_page,
            pages=self.pages,
            page_citation=self.page_citation,
        )
        return self


class SearchResponse(BaseModel):
    """Response payload for retrieval searches."""

    query: str
    results: list[SearchResult]
    total_results: int = Field(..., ge=0)

    @model_validator(mode="after")
    def validate_total_results(self) -> "SearchResponse":
        """Ensure total_results accurately reflects length of results."""
        if self.total_results != len(self.results):
            raise ValueError(
                f"total_results ({self.total_results}) does not match len(results) ({len(self.results)})"
            )
        return self


class AskRequest(BaseModel):
    """Query payload for document-grounded question answering."""

    question: str = Field(..., min_length=1)
    doc_id: Optional[str] = None
    top_k: Optional[int] = Field(default=None, gt=0, le=50)

    @field_validator("question")
    @classmethod
    def validate_question(cls, v: str) -> str:
        """Ensure question is non-empty after stripping whitespace."""
        stripped = v.strip()
        if not stripped:
            raise ValueError("question cannot be empty or whitespace only")
        return stripped


class AskResponse(BaseModel):
    """Response payload for document-grounded question answering."""

    question: str
    answer: str
    sources: list[SearchResult]
    fallback_used: bool = False
    fallback_reason: Optional[str] = None

