"""Unit tests for PDF extraction and validation service."""

import pytest
from app.services.pdf_service import (
    PDFSizeLimitExceededError,
    InvalidPDFError,
    NoExtractableTextError,
    extract_pdf_pages,
)


def test_extract_valid_single_page(make_pdf):
    """Verify text extraction from a valid single-page PDF."""
    pdf_bytes = make_pdf(["This is page 1 content."])
    pages = extract_pdf_pages(pdf_bytes, "document.pdf")

    assert len(pages) == 1
    assert pages[0]["page_number"] == 1
    assert pages[0]["text"] == "This is page 1 content."


def test_extract_valid_multi_page(make_pdf):
    """Verify text extraction across multiple pages preserving 1-indexed numbers."""
    pdf_bytes = make_pdf([
        "Chapter one introduction.",
        "Chapter two analysis.",
        "Chapter three conclusions.",
    ])
    pages = extract_pdf_pages(pdf_bytes, "report.pdf")

    assert len(pages) == 3
    assert [p["page_number"] for p in pages] == [1, 2, 3]
    assert pages[0]["text"] == "Chapter one introduction."
    assert pages[1]["text"] == "Chapter two analysis."
    assert pages[2]["text"] == "Chapter three conclusions."


def test_reject_oversized_pdf(make_pdf):
    """Verify rejection when PDF size exceeds maximum allowed byte limit."""
    pdf_bytes = make_pdf(["Sample content"])
    # Pass a low max_size_bytes to test limit enforcement
    with pytest.raises(PDFSizeLimitExceededError) as exc_info:
        extract_pdf_pages(pdf_bytes, "oversized.pdf", max_size_bytes=10)

    assert "exceeds maximum allowed limit" in str(exc_info.value)


def test_reject_invalid_extension(make_pdf):
    """Verify rejection when filename lacks .pdf extension."""
    pdf_bytes = make_pdf(["Valid PDF content"])

    with pytest.raises(InvalidPDFError) as exc_info:
        extract_pdf_pages(pdf_bytes, "document.txt")
    assert "does not have a .pdf extension" in str(exc_info.value)

    with pytest.raises(InvalidPDFError):
        extract_pdf_pages(pdf_bytes, "malicious.pdf.exe")


def test_accept_case_insensitive_extension(make_pdf):
    """Verify .PDF and .Pdf extensions are accepted."""
    pdf_bytes = make_pdf(["Sample content"])
    pages = extract_pdf_pages(pdf_bytes, "DOCUMENT.PDF")
    assert len(pages) == 1


def test_reject_missing_magic_bytes():
    """Verify rejection when file lacks %PDF- header."""
    fake_pdf = b"Plain text disguised as a PDF file."
    with pytest.raises(InvalidPDFError) as exc_info:
        extract_pdf_pages(fake_pdf, "fake.pdf")

    assert "standard PDF magic bytes" in str(exc_info.value)


def test_reject_corrupted_pdf():
    """Verify rejection when PDF stream is malformed or truncated."""
    corrupted_bytes = b"%PDF-1.4\n1 0 obj\n<< /Incomplete"
    with pytest.raises(InvalidPDFError) as exc_info:
        extract_pdf_pages(corrupted_bytes, "corrupt.pdf")

    assert "Failed to parse PDF document" in str(exc_info.value) or "Failed to read" in str(exc_info.value)


def test_reject_pdf_with_no_extractable_text(make_pdf):
    """Verify rejection when PDF has pages but 0 extractable text."""
    blank_pdf = make_pdf(["", "   \n\t  "])
    with pytest.raises(NoExtractableTextError) as exc_info:
        extract_pdf_pages(blank_pdf, "blank.pdf")

    assert "does not contain any extractable text" in str(exc_info.value)
