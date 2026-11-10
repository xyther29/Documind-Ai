"""Unit and integration tests for UserPartitionedStore and retriever partition isolation."""

import pytest

from app.models.schemas import Chunk, DocumentMeta
from app.services.retrieval_service import TfidfRetriever
from app.services.storage_service import InMemoryDocumentStore, UserPartitionedStore


def _create_chunk(doc_id: str, chunk_id: str, text: str, filename: str = "doc.pdf") -> Chunk:
    return Chunk(
        chunk_id=chunk_id,
        doc_id=doc_id,
        filename=filename,
        text=text,
        start_page=1,
        end_page=1,
        pages=[1],
        page_citation="p. 1",
    )


def test_partitioned_store_rejects_missing_or_empty_partition_id():
    """Verify that UserPartitionedStore fails closed on invalid, empty, or missing partition IDs."""
    store = UserPartitionedStore()
    meta = DocumentMeta(
        doc_id="d1",
        filename="d1.pdf",
        page_count=1,
        chunk_count=1,
        file_size_bytes=100,
    )
    chunks = [_create_chunk("d1", "c1", "Sample text.")]

    with pytest.raises(ValueError, match="partition_id must be a non-empty string"):
        store.add_document("", meta, chunks)

    with pytest.raises(ValueError, match="partition_id must be a non-empty string"):
        store.get_document("   ", "d1")

    with pytest.raises(ValueError, match="partition_id must be a non-empty string"):
        store.list_documents(None)  # type: ignore

    with pytest.raises(ValueError, match="partition_id must be a non-empty string"):
        store.delete_document("", "d1")

    with pytest.raises(ValueError, match="partition_id must be a non-empty string"):
        store.get_snapshot(" ")


def test_partitioned_store_crud_and_cross_partition_isolation():
    """Verify that documents in Partition A are completely isolated from Partition B."""
    store = UserPartitionedStore()
    meta_a = DocumentMeta(doc_id="doc_a", filename="a.pdf", page_count=1, chunk_count=1, file_size_bytes=100)
    chunks_a = [_create_chunk("doc_a", "c_a", "Partition A secret contents.")]

    meta_b = DocumentMeta(doc_id="doc_b", filename="b.pdf", page_count=1, chunk_count=1, file_size_bytes=200)
    chunks_b = [_create_chunk("doc_b", "c_b", "Partition B public info.")]

    store.add_document("user_alice", meta_a, chunks_a)
    store.add_document("user_bob", meta_b, chunks_b)

    # 1. Lookups
    assert store.get_document("user_alice", "doc_a") is not None
    assert store.get_document("user_alice", "doc_b") is None  # Cross-partition lookup returns None
    assert store.get_document("user_bob", "doc_b") is not None
    assert store.get_document("user_bob", "doc_a") is None

    # Nonexistent partition lookup returns None
    assert store.get_document("user_charlie", "doc_a") is None

    # 2. List documents
    alice_docs = store.list_documents("user_alice")
    assert len(alice_docs) == 1
    assert alice_docs[0].doc_id == "doc_a"

    bob_docs = store.list_documents("user_bob")
    assert len(bob_docs) == 1
    assert bob_docs[0].doc_id == "doc_b"

    charlie_docs = store.list_documents("user_charlie")
    assert len(charlie_docs) == 0

    # 3. Cross-partition delete
    assert store.delete_document("user_alice", "doc_b") is False  # Cannot delete Bob's document
    assert store.get_document("user_bob", "doc_b") is not None  # Bob's document remains intact

    # 4. Valid delete
    assert store.delete_document("user_alice", "doc_a") is True
    assert store.get_document("user_alice", "doc_a") is None
    assert store.partition_document_count("user_alice") == 0


def test_partitioned_store_aggregate_counts_and_clear():
    """Verify aggregate health metrics and partition-scoped clearing."""
    store = UserPartitionedStore()
    meta1 = DocumentMeta(doc_id="d1", filename="d1.pdf", page_count=1, chunk_count=1, file_size_bytes=100)
    meta2 = DocumentMeta(doc_id="d2", filename="d2.pdf", page_count=1, chunk_count=2, file_size_bytes=200)

    store.add_document("part_1", meta1, [_create_chunk("d1", "c1", "text 1")])
    store.add_document("part_2", meta2, [_create_chunk("d2", "c2", "text 2"), _create_chunk("d2", "c3", "text 3")])

    assert store.document_count == 2
    assert store.chunk_count == 3
    assert store.partition_document_count("part_1") == 1
    assert store.partition_chunk_count("part_1") == 1

    # Clear partition 1
    store.clear_partition("part_1")
    assert store.partition_document_count("part_1") == 0
    assert store.document_count == 1
    assert store.chunk_count == 2
    assert store.partition_document_count("part_2") == 1

    # Testing clear all
    store.clear_all_for_testing()
    assert store.document_count == 0
    assert store.chunk_count == 0


def test_for_testing_from_single_store_isolation():
    """Verify that from_single_store explicitly mounts under test partition and does not leak to other partitions."""
    single = InMemoryDocumentStore()
    meta = DocumentMeta(doc_id="d_legacy", filename="leg.pdf", page_count=1, chunk_count=1, file_size_bytes=50)
    single.add_document(meta, [_create_chunk("d_legacy", "c1", "Legacy content")])

    wrapped = UserPartitionedStore.for_testing_from_single_store(single, test_partition_id="test_legacy")

    # Document visible strictly under test_legacy
    assert wrapped.get_document("test_legacy", "d_legacy") is not None
    assert len(wrapped.list_documents("test_legacy")) == 1

    # Inaccessible from real tenant partitions
    assert wrapped.get_document("user_real", "d_legacy") is None
    assert len(wrapped.list_documents("user_real")) == 0
    assert wrapped.delete_document("user_real", "d_legacy") is False


def test_retriever_partition_isolation_and_cache_keys():
    """Verify that TfidfRetriever search and precomputed index cache are strictly partition-isolated."""
    store = UserPartitionedStore()
    retriever = TfidfRetriever(store)

    meta_a = DocumentMeta(doc_id="doc_a", filename="quantum.pdf", page_count=1, chunk_count=1, file_size_bytes=100)
    chunks_a = [_create_chunk("doc_a", "c1", "Quantum computing algorithms utilize qubits and superposition.")]
    store.add_document("user_alice", meta_a, chunks_a)

    meta_b = DocumentMeta(doc_id="doc_b", filename="biology.pdf", page_count=1, chunk_count=1, file_size_bytes=100)
    chunks_b = [_create_chunk("doc_b", "c2", "Photosynthesis in plants produces chemical glucose and oxygen.", filename="biology.pdf")]
    store.add_document("user_bob", meta_b, chunks_b)

    # Alice searches with doc_id=None (search her entire partition library)
    alice_results = retriever.search("photosynthesis plants", doc_id=None, partition_id="user_alice")
    # Alice's library contains only quantum computing; biology must NOT be retrieved
    assert len(alice_results) == 0

    # Bob searches with doc_id=None
    bob_results = retriever.search("photosynthesis plants", doc_id=None, partition_id="user_bob")
    assert len(bob_results) == 1
    assert bob_results[0].filename == "biology.pdf"

    # Verify cache keys cannot collide:
    # Alice's cache key is ("part::user_alice", None)
    # Bob's cache key is ("part::user_bob", None)
    assert ("part::user_alice", None) in retriever._cache
    assert ("part::user_bob", None) in retriever._cache
    assert retriever._cache[("part::user_alice", None)] is not retriever._cache[("part::user_bob", None)]
