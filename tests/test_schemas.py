"""Unit tests for Pydantic schemas and page attribution validation."""

from datetime import datetime, timezone, timedelta
import pytest
from pydantic import ValidationError

from app.models.schemas import (
    Chunk,
    DocumentMeta,
    SearchRequest,
    SearchResponse,
    SearchResult,
)


def test_document_meta_defaults_and_timezone():
    """Verify DocumentMeta creation with default UTC datetime."""
    meta = DocumentMeta(
        doc_id="doc-123",
        filename="sample.pdf",
        page_count=5,
        chunk_count=10,
        file_size_bytes=1024,
    )
    assert meta.doc_id == "doc-123"
    assert meta.filename == "sample.pdf"
    assert meta.page_count == 5
    assert meta.chunk_count == 10
    assert meta.created_at.tzinfo is not None
    assert meta.created_at.tzinfo == timezone.utc


def test_document_meta_rejects_naive_datetime():
    """Verify DocumentMeta rejects naive (timezone-unaware) datetime."""
    naive_dt = datetime(2026, 1, 1, 12, 0, 0)
    with pytest.raises(ValidationError):
        DocumentMeta(
            doc_id="doc-123",
            filename="sample.pdf",
            page_count=5,
            chunk_count=10,
            file_size_bytes=1024,
            created_at=naive_dt,
        )


def test_document_meta_converts_non_utc_tz_to_utc():
    """Verify DocumentMeta converts timezone-aware datetime with offset to UTC."""
    eastern_tz = timezone(timedelta(hours=-5))
    dt_with_tz = datetime(2026, 1, 1, 12, 0, 0, tzinfo=eastern_tz)
    meta = DocumentMeta(
        doc_id="doc-123",
        filename="sample.pdf",
        page_count=5,
        chunk_count=10,
        file_size_bytes=1024,
        created_at=dt_with_tz,
    )
    assert meta.created_at.tzinfo == timezone.utc
    assert meta.created_at.hour == 17  # 12:00 EST is 17:00 UTC


def test_chunk_valid_single_page():
    """Verify single page chunk creation and citation."""
    chunk = Chunk(
        chunk_id="chunk-1",
        doc_id="doc-1",
        filename="doc.pdf",
        text="Introduction text here.",
        start_page=1,
        end_page=1,
        pages=[1],
        page_citation="p. 1",
    )
    assert chunk.page_citation == "p. 1"
    assert chunk.pages == [1]


def test_chunk_valid_multi_page():
    """Verify multi-page chunk creation and citation across boundary."""
    chunk = Chunk(
        chunk_id="chunk-2",
        doc_id="doc-1",
        filename="doc.pdf",
        text="Text spanning pages one, two, and three.",
        start_page=1,
        end_page=3,
        pages=[1, 2, 3],
        page_citation="pp. 1-3",
    )
    assert chunk.page_citation == "pp. 1-3"
    assert chunk.start_page == 1
    assert chunk.end_page == 3
    assert chunk.pages == [1, 2, 3]


def test_chunk_rejects_reversed_page_range():
    """Verify Chunk rejects end_page < start_page."""
    with pytest.raises(ValidationError):
        Chunk(
            chunk_id="c1",
            doc_id="d1",
            filename="doc.pdf",
            text="Invalid range",
            start_page=3,
            end_page=1,
            pages=[1, 2, 3],
            page_citation="pp. 3-1",
        )


def test_chunk_rejects_unsorted_or_duplicate_pages():
    """Verify Chunk rejects unsorted or non-unique page lists."""
    with pytest.raises(ValidationError):
        Chunk(
            chunk_id="c1",
            doc_id="d1",
            filename="doc.pdf",
            text="Unsorted pages",
            start_page=1,
            end_page=2,
            pages=[2, 1],
            page_citation="pp. 1-2",
        )

    with pytest.raises(ValidationError):
        Chunk(
            chunk_id="c1",
            doc_id="d1",
            filename="doc.pdf",
            text="Duplicate pages",
            start_page=1,
            end_page=2,
            pages=[1, 1, 2],
            page_citation="pp. 1-2",
        )


def test_chunk_rejects_mismatched_boundary_pages():
    """Verify Chunk rejects pages whose start/end does not match start_page/end_page."""
    with pytest.raises(ValidationError):
        Chunk(
            chunk_id="c1",
            doc_id="d1",
            filename="doc.pdf",
            text="Mismatched boundary",
            start_page=1,
            end_page=3,
            pages=[2, 3],  # Missing start_page 1
            page_citation="pp. 1-3",
        )


def test_chunk_rejects_incorrect_citation_format():
    """Verify Chunk rejects malformed or incorrect citation strings."""
    # Single page should be "p. 1", not "pp. 1"
    with pytest.raises(ValidationError):
        Chunk(
            chunk_id="c1",
            doc_id="d1",
            filename="doc.pdf",
            text="Wrong citation format",
            start_page=1,
            end_page=1,
            pages=[1],
            page_citation="pp. 1",
        )

    # Multi page should be "pp. 1-2", not "p. 1-2"
    with pytest.raises(ValidationError):
        Chunk(
            chunk_id="c1",
            doc_id="d1",
            filename="doc.pdf",
            text="Wrong citation format",
            start_page=1,
            end_page=2,
            pages=[1, 2],
            page_citation="p. 1-2",
        )


def test_search_request_validation():
    """Verify SearchRequest strips whitespace and rejects empty queries."""
    req = SearchRequest(query="  machine learning  ", top_k=5)
    assert req.query == "machine learning"
    assert req.top_k == 5

    # Empty / whitespace-only query
    with pytest.raises(ValidationError):
        SearchRequest(query="   ")

    # Non-positive top_k
    with pytest.raises(ValidationError):
        SearchRequest(query="test", top_k=0)

    # Exceeding maximum top_k (50)
    with pytest.raises(ValidationError):
        SearchRequest(query="test", top_k=51)


def test_search_result_and_response_validation():
    """Verify SearchResult and SearchResponse consistency."""
    result = SearchResult(
        chunk_id="c1",
        doc_id="d1",
        filename="paper.pdf",
        text="Deep learning findings",
        start_page=4,
        end_page=5,
        pages=[4, 5],
        page_citation="pp. 4-5",
        score=0.88,
    )
    assert result.score == 0.88

    response = SearchResponse(
        query="deep learning",
        results=[result],
        total_results=1,
    )
    assert response.total_results == 1
    assert len(response.results) == 1

    # Mismatched total_results
    with pytest.raises(ValidationError):
        SearchResponse(
            query="deep learning",
            results=[result],
            total_results=2,
        )
