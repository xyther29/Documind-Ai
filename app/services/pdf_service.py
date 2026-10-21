"""PDF validation and page text extraction service."""

import io
from typing import TypedDict
import pypdf
from pypdf.errors import PyPdfError


class ExtractedPage(TypedDict):
    """Dictionary representation of an extracted PDF page."""

    page_number: int
    text: str


class PDFValidationError(Exception):
    """Base exception for PDF validation and extraction errors."""


class PDFSizeLimitExceededError(PDFValidationError):
    """Raised when uploaded PDF exceeds maximum allowed byte size."""


class InvalidPDFError(PDFValidationError):
    """Raised when file is not a valid PDF or is corrupted."""


class NoExtractableTextError(PDFValidationError):
    """Raised when PDF contains no extractable text (e.g. blank or image-only)."""


def extract_pdf_pages(
    file_bytes: bytes,
    filename: str,
    max_size_bytes: int = 10 * 1024 * 1024,
) -> list[ExtractedPage]:
    """Validate and extract text per page from raw PDF bytes.

    Args:
        file_bytes: The raw bytes of the uploaded PDF file.
        filename: Original file name.
        max_size_bytes: Maximum allowed file size in bytes (defaults to 10 MiB).

    Returns:
        List of ExtractedPage dicts with 1-indexed page_number and extracted text.

    Raises:
        PDFSizeLimitExceededError: If file_bytes exceeds max_size_bytes.
        InvalidPDFError: If filename does not end in .pdf, file lacks %PDF- header,
                         or file is corrupt/unreadable by pypdf.
        NoExtractableTextError: If no extractable text exists across all pages.
    """
    # 1. Enforce size limit
    if len(file_bytes) > max_size_bytes:
        raise PDFSizeLimitExceededError(
            f"File size ({len(file_bytes)} bytes) exceeds maximum allowed limit of {max_size_bytes} bytes."
        )

    # 2. Validate filename extension (case-insensitive)
    if not filename.lower().endswith(".pdf"):
        raise InvalidPDFError(f"Filename '{filename}' does not have a .pdf extension.")

    # 3. Validate magic bytes (PDF header)
    if not file_bytes.startswith(b"%PDF-"):
        raise InvalidPDFError(
            "File content does not start with standard PDF magic bytes (%PDF-)."
        )

    # 4. Parse PDF using pypdf
    try:
        reader = pypdf.PdfReader(io.BytesIO(file_bytes))
    except (PyPdfError, ValueError, KeyError, IndexError, io.BlockingIOError) as e:
        raise InvalidPDFError(f"Failed to parse PDF document: {e}") from e

    # 5. Check page count
    try:
        page_count = len(reader.pages)
    except (PyPdfError, ValueError, TypeError) as e:
        raise InvalidPDFError(f"Failed to read PDF page structure: {e}") from e

    if page_count == 0:
        raise InvalidPDFError("PDF document contains 0 pages.")

    # 6. Extract text per page
    extracted_pages: list[ExtractedPage] = []
    total_text = ""

    for page_idx in range(page_count):
        page_num = page_idx + 1
        try:
            page = reader.pages[page_idx]
            page_text = page.extract_text() or ""
        except (PyPdfError, ValueError, KeyError) as e:
            raise InvalidPDFError(
                f"Failed to extract text from page {page_num}: {e}"
            ) from e

        cleaned_text = page_text.strip()
        extracted_pages.append(
            ExtractedPage(page_number=page_num, text=cleaned_text)
        )
        total_text += cleaned_text

    # 7. Check for non-extractable text
    if not total_text.strip():
        raise NoExtractableTextError(
            "The PDF document does not contain any extractable text."
        )

    return extracted_pages
