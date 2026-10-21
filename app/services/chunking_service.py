"""Text chunking service with page attribution preservation."""

from typing import Sequence
from app.models.schemas import Chunk
from app.services.pdf_service import ExtractedPage


def chunk_document_pages(
    doc_id: str,
    filename: str,
    pages: Sequence[ExtractedPage],
    target_chunk_words: int = 120,
    chunk_overlap_words: int = 30,
) -> list[Chunk]:
    """Split extracted document pages into sliding-window text chunks.

    Preserves exact source-page attribution for every chunk, including chunks
    spanning page boundaries.

    Args:
        doc_id: Unique identifier of the document.
        filename: Original file name.
        pages: Sequence of ExtractedPage dictionaries with page_number and text.
        target_chunk_words: Desired maximum word count per chunk.
        chunk_overlap_words: Number of overlapping words between consecutive chunks.

    Returns:
        List of validated Chunk schema instances.

    Raises:
        ValueError: If parameters violate target_chunk_words > chunk_overlap_words >= 0.
    """
    if target_chunk_words <= 0:
        raise ValueError(
            f"target_chunk_words ({target_chunk_words}) must be greater than 0."
        )
    if chunk_overlap_words < 0:
        raise ValueError(
            f"chunk_overlap_words ({chunk_overlap_words}) must be non-negative."
        )
    if chunk_overlap_words >= target_chunk_words:
        raise ValueError(
            f"chunk_overlap_words ({chunk_overlap_words}) must be strictly less than "
            f"target_chunk_words ({target_chunk_words})."
        )

    # Flatten words while maintaining 1-indexed source page attribution
    tagged_words: list[tuple[str, int]] = []
    for page in pages:
        page_num = page["page_number"]
        words = page["text"].split()
        for word in words:
            tagged_words.append((word, page_num))

    total_words = len(tagged_words)
    if total_words == 0:
        return []

    step = target_chunk_words - chunk_overlap_words
    chunks: list[Chunk] = []
    start_idx = 0
    chunk_counter = 1

    while start_idx < total_words:
        end_idx = min(start_idx + target_chunk_words, total_words)
        window = tagged_words[start_idx:end_idx]

        chunk_text = " ".join(w[0] for w in window)
        start_page = window[0][1]
        end_page = window[-1][1]
        pages_in_chunk = sorted(set(w[1] for w in window))
        citation = (
            f"p. {start_page}"
            if start_page == end_page
            else f"pp. {start_page}-{end_page}"
        )

        chunk = Chunk(
            chunk_id=f"{doc_id}-c{chunk_counter}",
            doc_id=doc_id,
            filename=filename,
            text=chunk_text,
            start_page=start_page,
            end_page=end_page,
            pages=pages_in_chunk,
            page_citation=citation,
        )
        chunks.append(chunk)
        chunk_counter += 1

        # If this window reached the end of the document, stop to avoid duplicate chunks
        if end_idx == total_words:
            break

        start_idx += step

    return chunks
