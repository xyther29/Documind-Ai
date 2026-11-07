"""TF-IDF and cosine-similarity retrieval service with acronym-aware query expansion and precomputed index caching."""

from dataclasses import dataclass
import re
import threading
from typing import Any, Optional
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from app.config import get_settings
from app.models.schemas import Chunk, SearchResult
from app.services.storage_service import InMemoryDocumentStore

DEFAULT_ACRONYM_MAP: dict[str, str] = {
    "rag": "retrieval augmented generation",
    "llm": "large language model",
    "llms": "large language models",
    "tfidf": "term frequency inverse document frequency",
    "sdlc": "software development life cycle",
    "api": "application programming interface",
    "apis": "application programming interfaces",
    "nlp": "natural language processing",
}


def extract_acronyms_from_text(text: str) -> dict[str, str]:
    """Extract acronyms and their expanded forms from text.

    Supports both 'Full Term (ACRONYM)' and 'ACRONYM (Full Term)',
    including hyphenated compound phrases.
    """
    acronyms: dict[str, str] = {}
    if not text:
        return acronyms

    # Pattern 1a: Title-cased Full Term (ACRONYM) - e.g. "Retrieval-Augmented Generation (RAG)"
    p1a = re.findall(
        r"\b([A-Z][a-zA-Z]*(?:[- ][A-Z][a-zA-Z]*)+)\s*\(([A-Z][A-Za-z0-9]{1,7})\)",
        text,
    )
    for full, acr in p1a:
        full_clean = full.replace("-", " ").strip().lower()
        acronyms[acr.lower()] = full_clean

    # Pattern 1b: lowercase Full Term (ACRONYM) with initials verification
    p1b = re.findall(
        r"\b([a-z]+(?:[- ][a-z]+){1,5})\s*\(([A-Z][A-Za-z0-9]{1,7})\)",
        text,
    )
    for full, acr in p1b:
        words = re.split(r"[- ]+", full)
        initials = "".join(w[0] for w in words).lower()
        if initials.startswith(acr.lower()) or acr.lower() in initials or initials == acr.lower():
            full_clean = full.replace("-", " ").strip().lower()
            acronyms[acr.lower()] = full_clean

    # Pattern 2: ACRONYM (Full Term) - e.g. "RAG (Retrieval-Augmented Generation)"
    p2 = re.findall(
        r"\b([A-Z][A-Za-z0-9]{1,7})\s*\(([A-Za-z]+(?:[- ][A-Za-z]+)+)\)",
        text,
    )
    for acr, full in p2:
        full_clean = full.replace("-", " ").strip().lower()
        acronyms[acr.lower()] = full_clean

    return acronyms


def expand_query(query: str, corpus_acronyms: Optional[dict[str, str]] = None) -> str:
    """Expand known acronyms and multi-word terms in query to bridge lexical gaps.

    Preserves all original query terms verbatim and appends relevant expansions.
    """
    if not query or not query.strip():
        return query

    acronym_map = dict(DEFAULT_ACRONYM_MAP)
    if corpus_acronyms:
        acronym_map.update(corpus_acronyms)

    query_lower = query.lower()
    tokens = re.findall(r"\b[A-Za-z0-9]+\b", query_lower)
    expansions: list[str] = []

    # Forward expansion: acronym -> full term
    for token in tokens:
        if token in acronym_map:
            expansion = acronym_map[token]
            if expansion not in query_lower and expansion not in expansions:
                expansions.append(expansion)

    # Reverse expansion: full term -> acronym
    for acr, full in acronym_map.items():
        if full in query_lower and acr not in tokens and acr not in expansions:
            expansions.append(acr)

    if expansions:
        return f"{query} {' '.join(expansions)}"
    return query


@dataclass
class PrecomputedIndex:
    """Precomputed TF-IDF index and metadata for a corpus snapshot."""

    store_version: int
    vectorizer: Optional[TfidfVectorizer]
    chunk_matrix: Any
    chunks: list[Chunk]
    discovered_acronyms: dict[str, str]


class TfidfRetriever:
    """TF-IDF retrieval engine over in-memory document chunks with precomputed index caching."""

    def __init__(
        self,
        store: InMemoryDocumentStore,
        default_top_k: Optional[int] = None,
    ) -> None:
        self.store = store
        self._lock = threading.Lock()
        self._cache: dict[Optional[str], PrecomputedIndex] = {}
        # Use configured default_top_k from Settings rather than a hardcoded duplicate
        self.default_top_k = (
            default_top_k
            if default_top_k is not None
            else get_settings().default_top_k
        )

    def clear_cache(self) -> None:
        """Explicitly clear the precomputed index cache."""
        with self._lock:
            self._cache.clear()

    def _get_or_build_index(self, doc_id: Optional[str]) -> Optional[PrecomputedIndex]:
        """Retrieve precomputed index from cache or build outside locks if store mutated.

        Atomically snapshots chunks and version under store's lock, fits vectorizer
        outside any lock to avoid blocking readers, and verifies version before publishing.
        """
        # 1. Atomic snapshot of chunks and store version
        chunks, snapshot_version = self.store.get_snapshot(doc_id=doc_id)
        if not chunks:
            return None

        # 2. Check cache under retriever lock
        with self._lock:
            cached = self._cache.get(doc_id)
            if cached is not None and cached.store_version == snapshot_version:
                return cached

        # 3. Fit vectorizer outside locks
        chunk_texts = [c.text for c in chunks]
        discovered_acronyms: dict[str, str] = {}
        for text in chunk_texts:
            discovered_acronyms.update(extract_acronyms_from_text(text))

        vectorizer = TfidfVectorizer(
            stop_words="english",
            lowercase=True,
            norm="l2",
            sublinear_tf=True,
            ngram_range=(1, 2),
        )

        try:
            chunk_matrix = vectorizer.fit_transform(chunk_texts)
        except ValueError as exc:
            if "empty vocabulary" in str(exc).lower():
                index = PrecomputedIndex(
                    store_version=snapshot_version,
                    vectorizer=None,
                    chunk_matrix=None,
                    chunks=chunks,
                    discovered_acronyms={},
                )
            else:
                raise
        else:
            index = PrecomputedIndex(
                store_version=snapshot_version,
                vectorizer=vectorizer,
                chunk_matrix=chunk_matrix,
                chunks=chunks,
                discovered_acronyms=discovered_acronyms,
            )

        # 4. Verify version has not drifted before publishing to cache
        if self.store.version == snapshot_version:
            with self._lock:
                self._cache[doc_id] = index

        return index

    def search(
        self,
        query: str,
        doc_id: Optional[str] = None,
        top_k: Optional[int] = None,
    ) -> list[SearchResult]:
        """Search in-memory chunks using TF-IDF vectorization and cosine similarity.

        Args:
            query: The user query string.
            doc_id: Optional document ID to restrict search to a single document.
            top_k: Optional number of top results to return (must satisfy 0 < top_k <= 50).

        Returns:
            Ranked list of SearchResult schemas with exact page citations and scores.

        Raises:
            ValueError: If explicit top_k is non-positive or exceeds 50.
        """
        # Validate explicit top_k according to SearchRequest schema contract (0 < top_k <= 50)
        if top_k is not None:
            if top_k <= 0 or top_k > 50:
                raise ValueError(
                    f"top_k ({top_k}) must be greater than 0 and less than or equal to 50."
                )
            effective_top_k = top_k
        else:
            effective_top_k = self.default_top_k

        # 1. Handle empty or whitespace-only queries safely
        cleaned_query = query.strip()
        if not cleaned_query:
            return []

        # 2. Retrieve or build precomputed index
        index = self._get_or_build_index(doc_id=doc_id)
        if index is None or index.vectorizer is None or index.chunk_matrix is None:
            return []

        # 3. Expand query using curated and dynamically discovered acronyms
        effective_query = expand_query(cleaned_query, corpus_acronyms=index.discovered_acronyms)

        # 4. Transform query vector
        query_vector = index.vectorizer.transform([effective_query])

        # If query contains no vocabulary words recognized by the vectorizer, norm is 0
        if query_vector.nnz == 0:
            return []

        # 5. Compute cosine similarity against precomputed chunk matrix
        similarity_scores = cosine_similarity(query_vector, index.chunk_matrix)[0]

        # 6. Candidate selection and ranking
        candidates: list[tuple[float, str, int]] = []
        for idx, (score, chunk) in enumerate(zip(similarity_scores, index.chunks)):
            if score > 0.0:
                candidates.append((float(score), chunk.chunk_id, idx))

        if not candidates:
            return []

        # Sort primarily by score descending (-score), breaking ties deterministically
        # by chunk_id ascending
        candidates.sort(key=lambda item: (-item[0], item[1]))

        # 7. Build validated SearchResult objects preserving exact citation metadata
        results: list[SearchResult] = []
        for score, _, idx in candidates[:effective_top_k]:
            source_chunk = index.chunks[idx]
            results.append(
                SearchResult(
                    chunk_id=source_chunk.chunk_id,
                    doc_id=source_chunk.doc_id,
                    filename=source_chunk.filename,
                    text=source_chunk.text,
                    start_page=source_chunk.start_page,
                    end_page=source_chunk.end_page,
                    pages=source_chunk.pages,
                    page_citation=source_chunk.page_citation,
                    score=round(score, 4),
                )
            )

        return results
