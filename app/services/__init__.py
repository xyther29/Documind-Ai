"""Domain services for PDF processing, chunking, storage, retrieval, and QA."""

from app.services.chunking_service import chunk_document_pages
from app.services.pdf_service import (
    InvalidPDFError,
    NoExtractableTextError,
    PDFSizeLimitExceededError,
    PDFValidationError,
    extract_pdf_pages,
)
from app.services.qa_service import UNSUPPORTED_ANSWER, GeminiQAService
from app.services.retrieval_service import TfidfRetriever
from app.services.storage_service import InMemoryDocumentStore

__all__ = [
    "PDFValidationError",
    "PDFSizeLimitExceededError",
    "InvalidPDFError",
    "NoExtractableTextError",
    "extract_pdf_pages",
    "chunk_document_pages",
    "InMemoryDocumentStore",
    "TfidfRetriever",
    "GeminiQAService",
    "UNSUPPORTED_ANSWER",
]
