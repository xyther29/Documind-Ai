"""Unit tests for TfidfRetriever service."""

import pytest
from app.models.schemas import Chunk, DocumentMeta, SearchResult
from app.services.retrieval_service import (
    TfidfRetriever,
    expand_query,
    extract_acronyms_from_text,
)
from app.services.storage_service import InMemoryDocumentStore


def _create_chunk(
    doc_id: str,
    chunk_id: str,
    text: str,
    filename: str = "ai_paper.pdf",
    start_page: int = 1,
    end_page: int = 1,
) -> Chunk:
    pages = list(range(start_page, end_page + 1))
    citation = f"p. {start_page}" if start_page == end_page else f"pp. {start_page}-{end_page}"
    return Chunk(
        chunk_id=chunk_id,
        doc_id=doc_id,
        filename=filename,
        text=text,
        start_page=start_page,
        end_page=end_page,
        pages=pages,
        page_citation=citation,
    )


def _setup_store_with_chunks() -> InMemoryDocumentStore:
    store = InMemoryDocumentStore()
    doc1 = DocumentMeta(
        doc_id="doc1",
        filename="ai_paper.pdf",
        page_count=3,
        chunk_count=2,
        file_size_bytes=4096,
    )
    chunks1 = [
        _create_chunk(
            "doc1",
            "c1",
            "Artificial intelligence and deep machine learning algorithms optimize computational pipelines.",
            start_page=1,
            end_page=1,
        ),
        _create_chunk(
            "doc1",
            "c2",
            "Photosynthesis in green plants converts solar energy into biochemical glucose molecules.",
            start_page=2,
            end_page=3,
        ),
    ]
    store.add_document(doc1, chunks1)
    return store


def test_ranking_relevance():
    """Verify that the chunk with highest lexical relevance ranks first."""
    store = _setup_store_with_chunks()
    retriever = TfidfRetriever(store)

    results = retriever.search("machine learning artificial intelligence")
    assert len(results) >= 1
    assert results[0].chunk_id == "c1"
    assert results[0].score > 0.0
    assert isinstance(results[0], SearchResult)


def test_top_k_limits():
    """Verify top-k limits the number of returned results."""
    store = InMemoryDocumentStore()
    doc = DocumentMeta(doc_id="d1", filename="d1.pdf", page_count=5, chunk_count=4, file_size_bytes=1000)
    chunks = [
        _create_chunk("d1", f"c{i}", f"Quantum computing qubit superposition research paper section {i}")
        for i in range(1, 5)
    ]
    store.add_document(doc, chunks)

    retriever = TfidfRetriever(store, default_top_k=2)
    # Default top_k should return 2
    default_results = retriever.search("quantum computing qubit")
    assert len(default_results) == 2

    # Explicit top_k=1
    top1_results = retriever.search("quantum computing qubit", top_k=1)
    assert len(top1_results) == 1

    # Explicit top_k=3
    top3_results = retriever.search("quantum computing qubit", top_k=3)
    assert len(top3_results) == 3


def test_invalid_top_k_rejected():
    """Verify non-positive or >50 top_k raises ValueError."""
    store = _setup_store_with_chunks()
    retriever = TfidfRetriever(store)

    with pytest.raises(ValueError) as exc1:
        retriever.search("ai", top_k=0)
    assert "top_k (0)" in str(exc1.value)

    with pytest.raises(ValueError) as exc2:
        retriever.search("ai", top_k=51)
    assert "top_k (51)" in str(exc2.value)


def test_citation_preservation():
    """Verify retrieved SearchResult preserves exact page attribution metadata."""
    store = _setup_store_with_chunks()
    retriever = TfidfRetriever(store)

    results = retriever.search("photosynthesis glucose plants")
    assert len(results) == 1
    result = results[0]
    assert result.chunk_id == "c2"
    assert result.start_page == 2
    assert result.end_page == 3
    assert result.pages == [2, 3]
    assert result.page_citation == "pp. 2-3"
    assert result.doc_id == "doc1"
    assert result.filename == "ai_paper.pdf"


def test_doc_id_filter_search():
    """Verify search restricted to doc_id excludes matching chunks from other documents."""
    store = InMemoryDocumentStore()
    store.add_document(
        DocumentMeta(doc_id="d1", filename="d1.pdf", page_count=1, chunk_count=1, file_size_bytes=100),
        [_create_chunk("d1", "c1", "Neural networks architecture in computer vision.")],
    )
    store.add_document(
        DocumentMeta(doc_id="d2", filename="d2.pdf", page_count=1, chunk_count=1, file_size_bytes=100),
        [_create_chunk("d2", "c2", "Neural networks performance in audio processing.")],
    )
    retriever = TfidfRetriever(store)

    # Search all documents
    all_results = retriever.search("neural networks")
    assert len(all_results) == 2

    # Filter to d1
    d1_results = retriever.search("neural networks", doc_id="d1")
    assert len(d1_results) == 1
    assert d1_results[0].doc_id == "d1"

    # Filter to non-existent doc
    missing_results = retriever.search("neural networks", doc_id="missing")
    assert missing_results == []


def test_empty_query_returns_empty():
    """Verify empty or whitespace-only queries safely return empty list."""
    store = _setup_store_with_chunks()
    retriever = TfidfRetriever(store)

    assert retriever.search("") == []
    assert retriever.search("   \t  \n  ") == []


def test_empty_store_returns_empty():
    """Verify searching an empty store returns empty list without errors."""
    empty_store = InMemoryDocumentStore()
    retriever = TfidfRetriever(empty_store)

    assert retriever.search("artificial intelligence") == []


def test_zero_similarity_returns_empty():
    """Verify query with no overlapping terms returns empty list."""
    store = _setup_store_with_chunks()
    retriever = TfidfRetriever(store)

    results = retriever.search("aerospace rocket propulsion astronaut")
    assert results == []


def test_stop_words_only_query():
    """Verify query with only English stop words returns empty list safely."""
    store = _setup_store_with_chunks()
    retriever = TfidfRetriever(store)

    assert retriever.search("the of and to in is") == []


def test_non_informative_corpus_handled_safely():
    """Verify corpus with only stop words does not crash on vectorizer empty vocabulary."""
    store = InMemoryDocumentStore()
    doc = DocumentMeta(doc_id="d1", filename="d1.pdf", page_count=1, chunk_count=1, file_size_bytes=50)
    # Chunk with only stop words
    store.add_document(doc, [_create_chunk("d1", "c1", "the of and in to is at")])
    retriever = TfidfRetriever(store)

    assert retriever.search("search term") == []


def test_deterministic_ordering_on_score_ties():
    """Verify equal-scoring chunks are deterministically sorted by chunk_id ascending."""
    store = InMemoryDocumentStore()
    doc = DocumentMeta(doc_id="d1", filename="d1.pdf", page_count=1, chunk_count=3, file_size_bytes=100)
    # Three identical texts will produce identical TF-IDF scores for the query
    chunks = [
        _create_chunk("d1", "chunk-c", "Database indexing mechanisms."),
        _create_chunk("d1", "chunk-a", "Database indexing mechanisms."),
        _create_chunk("d1", "chunk-b", "Database indexing mechanisms."),
    ]
    store.add_document(doc, chunks)
    retriever = TfidfRetriever(store)

    results = retriever.search("database indexing")
    assert len(results) == 3
    # Check deterministic tie-break by chunk_id ascending
    assert [r.chunk_id for r in results] == ["chunk-a", "chunk-b", "chunk-c"]


def test_retrieval_after_deletion():
    """Verify deleting a document immediately updates search results."""
    store = _setup_store_with_chunks()
    retriever = TfidfRetriever(store)

    assert len(retriever.search("artificial intelligence")) == 1

    store.delete_document("doc1")
    assert retriever.search("artificial intelligence") == []


def test_acronym_expansion_definition_over_roadmap_ranking():
    """Regression test: verify 'What is RAG?' ranks substantive definition above repetitive roadmap."""
    store = InMemoryDocumentStore()
    doc = DocumentMeta(
        doc_id="sdlc-doc",
        filename="SDLC Document DocuMind AI – RAG Document Q&A Platform.pdf",
        page_count=17,
        chunk_count=2,
        file_size_bytes=50000,
    )
    chunk_def = _create_chunk(
        "sdlc-doc",
        "c-def",
        "DocuMind AI is a Retrieval-Augmented Generation (RAG) platform. "
        "Retrieval-Augmented Generation is an architecture that retrieves relevant "
        "document passages from a knowledge base to answer user queries with verifiable citations and grounded facts.",
        filename="SDLC Document DocuMind AI – RAG Document Q&A Platform.pdf",
        start_page=1,
        end_page=1,
    )
    chunk_roadmap = _create_chunk(
        "sdlc-doc",
        "c-roadmap",
        "Phase 4: Future Roadmap. Priority items: RAG evaluation framework, "
        "RAG benchmark metrics, RAG latency optimization, and automated RAG test suite.",
        filename="SDLC Document DocuMind AI – RAG Document Q&A Platform.pdf",
        start_page=17,
        end_page=17,
    )
    store.add_document(doc, [chunk_def, chunk_roadmap])
    retriever = TfidfRetriever(store)

    for query in ["What is RAG?", "What is RAG"]:
        results = retriever.search(query)
        assert len(results) == 2
        # Crucial ranking assertion: substantive definition on page 1 must rank first
        assert results[0].chunk_id == "c-def"
        assert results[0].start_page == 1
        assert results[0].page_citation == "p. 1"
        assert results[1].chunk_id == "c-roadmap"
        assert results[1].start_page == 17
        assert results[0].score > results[1].score


def test_dynamic_acronym_extraction_from_corpus():
    """Verify that dynamically discovered parenthetical acronyms in documents are expanded."""
    store = InMemoryDocumentStore()
    doc = DocumentMeta(
        doc_id="ai-models",
        filename="models.pdf",
        page_count=5,
        chunk_count=2,
        file_size_bytes=10000,
    )
    chunk_cnn = _create_chunk(
        "ai-models",
        "c-cnn",
        "Convolutional Neural Networks (CNN) are specialized deep learning architectures "
        "used for grid-structured image analysis and feature map representations.",
        start_page=2,
        end_page=2,
    )
    chunk_list = _create_chunk(
        "ai-models",
        "c-list",
        "Model benchmark results: CNN throughput, CNN memory footprint, CNN training time.",
        start_page=5,
        end_page=5,
    )
    store.add_document(doc, [chunk_cnn, chunk_list])
    retriever = TfidfRetriever(store)

    results = retriever.search("What is CNN?")
    assert len(results) == 2
    # Dynamic acronym extraction must prioritize definition chunk
    assert results[0].chunk_id == "c-cnn"
    assert results[0].start_page == 2
    assert results[0].score > results[1].score


def test_acronym_extraction_patterns():
    """Verify extraction of both Full Term (ACRONYM) and ACRONYM (Full Term) with hyphens."""
    # Pattern 1: Title-cased Full Term (ACRONYM) with hyphens
    t1 = "Retrieval-Augmented Generation (RAG) is useful."
    e1 = extract_acronyms_from_text(t1)
    assert e1.get("rag") == "retrieval augmented generation"

    # Pattern 2: ACRONYM (Full Term) with hyphens
    t2 = "We use RAG (Retrieval-Augmented Generation) for accuracy."
    e2 = extract_acronyms_from_text(t2)
    assert e2.get("rag") == "retrieval augmented generation"

    # Pattern 3: Multi-word without hyphens
    t3 = "Software Development Life Cycle (SDLC) process."
    e3 = extract_acronyms_from_text(t3)
    assert e3.get("sdlc") == "software development life cycle"

    # Empty text
    assert extract_acronyms_from_text("") == {}


def test_expand_query_helper():
    """Verify expand_query preserves original query and appends appropriate expansions."""
    # Acronym expansion
    q1 = expand_query("What is RAG?")
    assert q1.startswith("What is RAG?")
    assert "retrieval augmented generation" in q1

    # Reverse expansion (full term -> acronym)
    q2 = expand_query("Overview of retrieval augmented generation")
    assert q2.startswith("Overview of retrieval augmented generation")
    assert "rag" in q2

    # Query with no acronyms is untouched
    assert expand_query("photosynthesis in plants") == "photosynthesis in plants"
    assert expand_query("") == ""
    assert expand_query("   ") == "   "


def test_precomputed_index_cache_reuse_and_invalidation():
    """Verify that TF-IDF index is cached and invalidated on store mutations."""
    store = _setup_store_with_chunks()
    retriever = TfidfRetriever(store)

    # Initial search populates the cache
    _ = retriever.search("machine learning")
    assert None in retriever._cache
    first_index = retriever._cache[None]
    assert first_index.store_version == store.version

    # Subsequent search reuses the exact same precomputed index
    _ = retriever.search("deep computational algorithms")
    assert retriever._cache[None] is first_index

    # Adding a document invalidates the cache on next search
    doc2 = DocumentMeta(
        doc_id="doc2",
        filename="bio.pdf",
        page_count=1,
        chunk_count=1,
        file_size_bytes=1000,
    )
    store.add_document(doc2, [_create_chunk("doc2", "c3", "Botanical genetics and cellular mitosis.")])

    _ = retriever.search("botanical genetics")
    new_index = retriever._cache[None]
    assert new_index is not first_index
    assert new_index.store_version == store.version

    # Deleting a document invalidates the cache on next search
    store.delete_document("doc2")
    _ = retriever.search("machine learning")
    third_index = retriever._cache[None]
    assert third_index is not new_index
    assert third_index.store_version == store.version


def test_retrieval_ranking_parity_cached_vs_uncached():
    """Verify ranking parity between cold (uncached) and warm (cached) retrieval."""
    store = _setup_store_with_chunks()
    retriever = TfidfRetriever(store)

    # Cold query
    cold_results = retriever.search("machine learning artificial intelligence")

    # Warm cached query
    warm_results = retriever.search("machine learning artificial intelligence")

    assert len(cold_results) == len(warm_results)
    for c, w in zip(cold_results, warm_results):
        assert c.chunk_id == w.chunk_id
        assert c.score == w.score
        assert c.page_citation == w.page_citation
        assert c.text == w.text


def test_retrieval_benchmark_recorded():
    """Record performance timings for cold vs warm cached search."""
    import time

    store = _setup_store_with_chunks()
    retriever = TfidfRetriever(store)

    # Cold search (includes initial vectorizer fitting)
    t0 = time.perf_counter()
    cold_results = retriever.search("artificial intelligence computational algorithms")
    cold_duration = time.perf_counter() - t0

    # Warm search (precomputed index reuse)
    t1 = time.perf_counter()
    warm_results = retriever.search("artificial intelligence computational algorithms")
    warm_duration = time.perf_counter() - t1

    assert len(cold_results) == len(warm_results)
    assert warm_duration >= 0.0
    # Warm duration should generally be faster than or comparable to cold duration
    # We record timings for benchmarking
    print(f"\n[BENCHMARK] Cold search: {cold_duration * 1000:.3f}ms | Warm cached: {warm_duration * 1000:.3f}ms")


