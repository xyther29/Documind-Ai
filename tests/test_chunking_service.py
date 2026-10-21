"""Unit tests for text chunking service and page attribution."""

import pytest
from app.models.schemas import Chunk
from app.services.chunking_service import chunk_document_pages
from app.services.pdf_service import ExtractedPage


def _make_words(count: int, prefix: str = "w") -> str:
    """Generate space-separated words for deterministic testing."""
    return " ".join(f"{prefix}{i}" for i in range(count))


def test_chunking_empty_pages():
    """Verify chunking returns empty list when pages have no text."""
    pages = [ExtractedPage(page_number=1, text="")]
    chunks = chunk_document_pages("doc-1", "doc.pdf", pages)
    assert chunks == []


def test_chunking_short_document():
    """Verify document shorter than target chunk words produces exactly one chunk."""
    text = _make_words(50)
    pages = [ExtractedPage(page_number=1, text=text)]
    chunks = chunk_document_pages("doc-1", "doc.pdf", pages)

    assert len(chunks) == 1
    assert isinstance(chunks[0], Chunk)
    assert chunks[0].start_page == 1
    assert chunks[0].end_page == 1
    assert chunks[0].pages == [1]
    assert chunks[0].page_citation == "p. 1"
    assert len(chunks[0].text.split()) == 50
    assert chunks[0].text.split()[-1] == "w49"


def test_chunking_exact_target_boundary_120_words():
    """Verify document with exactly 120 words produces one chunk with all words."""
    text = _make_words(120)
    pages = [ExtractedPage(page_number=1, text=text)]
    chunks = chunk_document_pages("doc-1", "doc.pdf", pages)

    assert len(chunks) == 1
    assert len(chunks[0].text.split()) == 120
    assert chunks[0].text.split()[0] == "w0"
    assert chunks[0].text.split()[-1] == "w119"


def test_chunking_boundary_121_words():
    """Verify document with 121 words produces 2 chunks covering all words."""
    text = _make_words(121)
    pages = [ExtractedPage(page_number=1, text=text)]
    chunks = chunk_document_pages("doc-1", "doc.pdf", pages)

    assert len(chunks) == 2
    # Chunk 1: words 0..119 (120 words)
    assert len(chunks[0].text.split()) == 120
    assert chunks[0].text.split()[0] == "w0"
    assert chunks[0].text.split()[-1] == "w119"

    # Chunk 2: words 90..120 (31 words)
    assert len(chunks[1].text.split()) == 31
    assert chunks[1].text.split()[0] == "w90"
    assert chunks[1].text.split()[-1] == "w120"

    # Verify overlap: Chunk 1 and Chunk 2 share words 90..119 (30 words)
    assert chunks[0].text.split()[90:] == chunks[1].text.split()[:30]


def test_chunking_boundary_180_words():
    """Verify document with 180 words produces 2 chunks covering all words."""
    text = _make_words(180)
    pages = [ExtractedPage(page_number=1, text=text)]
    chunks = chunk_document_pages("doc-1", "doc.pdf", pages)

    assert len(chunks) == 2
    # Chunk 1: words 0..119 (120 words)
    assert len(chunks[0].text.split()) == 120
    assert chunks[0].text.split()[0] == "w0"
    assert chunks[0].text.split()[-1] == "w119"

    # Chunk 2: words 90..179 (90 words)
    assert len(chunks[1].text.split()) == 90
    assert chunks[1].text.split()[0] == "w90"
    assert chunks[1].text.split()[-1] == "w179"

    # Verify overlap: exactly 30 words (90..119)
    assert chunks[0].text.split()[90:] == chunks[1].text.split()[:30]


def test_chunking_boundary_181_words():
    """Verify document with 181 words produces 2 chunks covering all words."""
    text = _make_words(181)
    pages = [ExtractedPage(page_number=1, text=text)]
    chunks = chunk_document_pages("doc-1", "doc.pdf", pages)

    assert len(chunks) == 2
    # Chunk 1: words 0..119 (120 words)
    assert len(chunks[0].text.split()) == 120

    # Chunk 2: words 90..180 (91 words)
    assert len(chunks[1].text.split()) == 91
    assert chunks[1].text.split()[0] == "w90"
    assert chunks[1].text.split()[-1] == "w180"

    # Overlap remains 30 words
    assert chunks[0].text.split()[90:] == chunks[1].text.split()[:30]


def test_chunking_boundary_250_words():
    """Verify document with 250 words produces 3 chunks covering all words."""
    text = _make_words(250)
    pages = [ExtractedPage(page_number=1, text=text)]
    chunks = chunk_document_pages("doc-1", "doc.pdf", pages)

    assert len(chunks) == 3
    # Chunk 1: words 0..119 (120 words)
    assert len(chunks[0].text.split()) == 120
    assert chunks[0].text.split()[0] == "w0"
    assert chunks[0].text.split()[-1] == "w119"

    # Chunk 2: words 90..209 (120 words)
    assert len(chunks[1].text.split()) == 120
    assert chunks[1].text.split()[0] == "w90"
    assert chunks[1].text.split()[-1] == "w209"

    # Chunk 3: words 180..249 (70 words)
    assert len(chunks[2].text.split()) == 70
    assert chunks[2].text.split()[0] == "w180"
    assert chunks[2].text.split()[-1] == "w249"

    # Verify overlaps
    assert chunks[0].text.split()[90:120] == chunks[1].text.split()[:30]
    assert chunks[1].text.split()[90:120] == chunks[2].text.split()[:30]


def test_chunking_page_boundary_attribution():
    """Verify accurate multi-page citation when a chunk spans page boundaries."""
    # Page 1 has 60 words; Page 2 has 60 words
    pages = [
        ExtractedPage(page_number=1, text=_make_words(60, prefix="p1_")),
        ExtractedPage(page_number=2, text=_make_words(60, prefix="p2_")),
    ]
    chunks = chunk_document_pages("doc-1", "multi.pdf", pages)

    assert len(chunks) == 1
    chunk = chunks[0]
    assert chunk.start_page == 1
    assert chunk.end_page == 2
    assert chunk.pages == [1, 2]
    assert chunk.page_citation == "pp. 1-2"
    assert chunk.text.startswith("p1_0")
    assert chunk.text.endswith("p2_59")


def test_chunking_three_page_span():
    """Verify chunk spanning 3 pages attributes all pages correctly."""
    pages = [
        ExtractedPage(page_number=1, text=_make_words(40, prefix="p1_")),
        ExtractedPage(page_number=2, text=_make_words(40, prefix="p2_")),
        ExtractedPage(page_number=3, text=_make_words(40, prefix="p3_")),
    ]
    chunks = chunk_document_pages("doc-1", "three_pages.pdf", pages)

    assert len(chunks) == 1
    chunk = chunks[0]
    assert chunk.start_page == 1
    assert chunk.end_page == 3
    assert chunk.pages == [1, 2, 3]
    assert chunk.page_citation == "pp. 1-3"


def test_chunking_invalid_parameters():
    """Verify ValueError is raised when parameters are invalid."""
    pages = [ExtractedPage(page_number=1, text="Hello world")]

    with pytest.raises(ValueError):
        chunk_document_pages("d1", "f.pdf", pages, target_chunk_words=0)

    with pytest.raises(ValueError):
        chunk_document_pages("d1", "f.pdf", pages, chunk_overlap_words=-1)

    with pytest.raises(ValueError):
        chunk_document_pages(
            "d1", "f.pdf", pages, target_chunk_words=100, chunk_overlap_words=100
        )
