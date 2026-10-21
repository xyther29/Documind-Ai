"""Unit tests for InMemoryDocumentStore."""

from datetime import datetime, timezone, timedelta
import pytest
from app.models.schemas import Chunk, DocumentMeta
from app.services.storage_service import InMemoryDocumentStore


def _make_sample_doc(doc_id: str, minutes_ago: int = 0) -> DocumentMeta:
    """Helper to create DocumentMeta with specific timestamp."""
    dt = datetime.now(timezone.utc) - timedelta(minutes=minutes_ago)
    return DocumentMeta(
        doc_id=doc_id,
        filename=f"{doc_id}.pdf",
        page_count=2,
        chunk_count=1,
        file_size_bytes=2048,
        created_at=dt,
    )


def _make_sample_chunk(doc_id: str, chunk_id: str, text: str = "Sample chunk text") -> Chunk:
    """Helper to create valid Chunk."""
    return Chunk(
        chunk_id=chunk_id,
        doc_id=doc_id,
        filename=f"{doc_id}.pdf",
        text=text,
        start_page=1,
        end_page=1,
        pages=[1],
        page_citation="p. 1",
    )


def test_add_and_get_document():
    """Verify storing and retrieving a document and its chunks."""
    store = InMemoryDocumentStore()
    doc = _make_sample_doc("doc-1")
    chunk = _make_sample_chunk("doc-1", "c1")

    store.add_document(doc, [chunk])

    assert store.document_count == 1
    assert store.chunk_count == 1
    assert store.get_document("doc-1") == doc
    assert store.get_chunks("doc-1") == [chunk]
    assert store.get_document("non-existent") is None


def test_add_duplicate_doc_id_raises():
    """Verify adding duplicate doc_id raises ValueError."""
    store = InMemoryDocumentStore()
    doc = _make_sample_doc("doc-1")
    chunk = _make_sample_chunk("doc-1", "c1")

    store.add_document(doc, [chunk])

    with pytest.raises(ValueError) as exc_info:
        store.add_document(doc, [chunk])
    assert "already exists" in str(exc_info.value)


def test_add_mismatched_chunk_doc_id_raises():
    """Verify adding chunks with mismatched doc_id raises ValueError and leaves store unchanged."""
    store = InMemoryDocumentStore()
    doc = _make_sample_doc("doc-1")
    bad_chunk = _make_sample_chunk("mismatched-doc", "c1")

    with pytest.raises(ValueError) as exc_info:
        store.add_document(doc, [bad_chunk])

    assert "does not match document doc_id" in str(exc_info.value)
    # Store must not have partially stored the document
    assert store.document_count == 0
    assert store.chunk_count == 0
    assert store.get_document("doc-1") is None


def test_list_documents_ordering():
    """Verify documents are returned in reverse chronological order."""
    store = InMemoryDocumentStore()
    doc_old = _make_sample_doc("doc-old", minutes_ago=10)
    doc_mid = _make_sample_doc("doc-mid", minutes_ago=5)
    doc_new = _make_sample_doc("doc-new", minutes_ago=1)

    store.add_document(doc_mid, [_make_sample_chunk("doc-mid", "c2")])
    store.add_document(doc_old, [_make_sample_chunk("doc-old", "c1")])
    store.add_document(doc_new, [_make_sample_chunk("doc-new", "c3")])

    listed = store.list_documents()
    assert [d.doc_id for d in listed] == ["doc-new", "doc-mid", "doc-old"]


def test_delete_document_success_and_missing():
    """Verify deleting a document removes both metadata and chunks."""
    store = InMemoryDocumentStore()
    doc = _make_sample_doc("doc-1")
    chunk = _make_sample_chunk("doc-1", "c1")
    store.add_document(doc, [chunk])

    assert store.delete_document("doc-1") is True
    assert store.get_document("doc-1") is None
    assert store.get_chunks("doc-1") == []
    assert store.document_count == 0
    assert store.chunk_count == 0

    # Second delete should return False
    assert store.delete_document("doc-1") is False
    assert store.delete_document("unknown-id") is False


def test_get_chunks_filtering():
    """Verify filtering chunks by doc_id versus retrieving all chunks."""
    store = InMemoryDocumentStore()
    store.add_document(_make_sample_doc("d1"), [_make_sample_chunk("d1", "c1")])
    store.add_document(_make_sample_doc("d2"), [_make_sample_chunk("d2", "c2")])

    d1_chunks = store.get_chunks("d1")
    assert len(d1_chunks) == 1
    assert d1_chunks[0].chunk_id == "c1"

    all_chunks = store.get_chunks()
    assert len(all_chunks) == 2
    assert {c.chunk_id for c in all_chunks} == {"c1", "c2"}


def test_internal_lists_protected_from_mutation():
    """Verify returned chunk list cannot mutate store's internal list."""
    store = InMemoryDocumentStore()
    doc = _make_sample_doc("d1")
    chunk = _make_sample_chunk("d1", "c1")
    store.add_document(doc, [chunk])

    chunks = store.get_chunks("d1")
    chunks.clear()

    # Internal list must still have the chunk
    assert store.chunk_count == 1
    assert len(store.get_chunks("d1")) == 1


def test_clear_store():
    """Verify clear empties all documents and chunks."""
    store = InMemoryDocumentStore()
    store.add_document(_make_sample_doc("d1"), [_make_sample_chunk("d1", "c1")])
    assert store.document_count == 1

    store.clear()
    assert store.document_count == 0
    assert store.chunk_count == 0
    assert store.list_documents() == []
