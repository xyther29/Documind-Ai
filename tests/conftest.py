"""Pytest fixtures and test helpers for DocuMind AI."""

import io
from typing import Sequence
import pytest


def create_test_pdf(pages_text: Sequence[str]) -> bytes:
    """Generate a standard, valid PDF 1.4 byte stream with page text.

    Uses pure Python without external dependencies. Compatible with pypdf.

    Args:
        pages_text: List of text strings to place on each page. An empty or
                    whitespace-only string creates a page with no text stream.

    Returns:
        Raw bytes representing a valid PDF file.
    """
    buf = io.BytesIO()
    objects: list[bytes] = []
    num_pages = len(pages_text)

    # 1: Catalog
    objects.append(b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n")

    # 2: Pages tree
    page_ids = [5 + i * 2 for i in range(num_pages)]
    kids = " ".join(f"{pid} 0 R" for pid in page_ids)
    objects.append(
        f"2 0 obj\n<< /Type /Pages /Kids [{kids}] /Count {num_pages} >>\nendobj\n".encode(
            "latin1"
        )
    )

    # 3: ProcSet
    objects.append(b"3 0 obj\n[/PDF /Text]\nendobj\n")

    # 4: Default Font (Type 1 Helvetica)
    objects.append(
        b"4 0 obj\n<< /Type /Font /Subtype /Type1 /Name /F1 /BaseFont /Helvetica >>\nendobj\n"
    )

    for i, text in enumerate(pages_text):
        page_id = 5 + i * 2
        content_id = page_id + 1

        # Escape special PDF characters: \, (, )
        safe_text = (
            text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
        )

        if safe_text.strip():
            stream_data = (
                f"BT /F1 12 Tf 72 712 Td ({safe_text}) Tj ET".encode("latin1")
            )
        else:
            stream_data = b""

        page_obj = (
            f"{page_id} 0 obj\n"
            f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
            f"/Contents {content_id} 0 R /Resources << /Font << /F1 4 0 R >> >> >>\n"
            f"endobj\n"
        ).encode("latin1")

        content_obj = (
            f"{content_id} 0 obj\n"
            f"<< /Length {len(stream_data)} >>\n"
            f"stream\n"
        ).encode("latin1") + stream_data + b"\nendstream\nendobj\n"

        objects.append(page_obj)
        objects.append(content_obj)

    # Write PDF header
    buf.write(b"%PDF-1.4\n")
    offsets = [0]

    for obj in objects:
        offsets.append(buf.tell())
        buf.write(obj)

    xref_pos = buf.tell()
    buf.write(b"xref\n")
    buf.write(f"0 {len(offsets)}\n".encode("latin1"))
    buf.write(b"0000000000 65535 f \n")
    for off in offsets[1:]:
        buf.write(f"{off:010d} 00000 n \n".encode("latin1"))

    trailer = (
        f"trailer\n<< /Size {len(offsets)} /Root 1 0 R >>\n"
        f"startxref\n{xref_pos}\n%%EOF\n"
    ).encode("latin1")
    buf.write(trailer)

    return buf.getvalue()


@pytest.fixture
def make_pdf():
    """Fixture providing a function to create text-containing or blank PDFs."""
    return create_test_pdf
