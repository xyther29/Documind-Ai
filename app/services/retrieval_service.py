"""TF-IDF and cosine-similarity retrieval service with acronym-aware query expansion."""

import re
from typing import Optional
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from app.config import get_settings
from app.models.schemas import SearchResult
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


class TfidfRetriever:
    """TF-IDF retrieval engine over in-memory document chunks."""

    def __init__(
        self,
        store: InMemoryDocumentStore,
        default_top_k: Optional[int] = None,
    ) -> None:
        self.store = store
        # Use configured default_top_k from Settings rather than a hardcoded duplicate
        self.default_top_k = (
            default_top_k
            if default_top_k is not None
            else get_settings().default_top_k
        )

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

        # 2. Retrieve chunks from storage (optionally filtered by doc_id)
        chunks = self.store.get_chunks(doc_id=doc_id)
        if not chunks:
            return []

        chunk_texts = [c.text for c in chunks]

        # Discover dynamic acronyms defined across indexed chunks
        discovered_acronyms: dict[str, str] = {}
        for text in chunk_texts:
            discovered_acronyms.update(extract_acronyms_from_text(text))

        # Expand query using curated and dynamically discovered acronyms
        effective_query = expand_query(cleaned_query, corpus_acronyms=discovered_acronyms)

        # 3. Fit TF-IDF Vectorizer with sublinear term-frequency scaling and (1, 2) n-grams
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
            # Catch ONLY expected empty vocabulary error (e.g. all stop words or symbols in corpus)
            # Re-raise any unrelated ValueError or programming error
            if "empty vocabulary" in str(exc).lower():
                return []
            raise

        # 4. Transform query vector
        query_vector = vectorizer.transform([effective_query])

        # If query contains no vocabulary words recognized by the vectorizer, norm is 0
        if query_vector.nnz == 0:
            return []

        # 5. Compute cosine similarity
        similarity_scores = cosine_similarity(query_vector, chunk_matrix)[0]

        # 6. Candidate selection and ranking
        # NOTE on score > 0.0:
        # In non-negative TF-IDF vector space, cosine similarity ranges strictly between 0.0 and 1.0.
        # A score > 0.0 indicates that at least one non-stopword query token matched the chunk.
        # This rule serves strictly as a lexical-overlap filter to exclude completely unmentioned
        # passages; it is NOT a guarantee of true semantic relevance.
        candidates: list[tuple[float, str, int]] = []
        for idx, (score, chunk) in enumerate(zip(similarity_scores, chunks)):
            if score > 0.0:
                # Store (score, chunk_id, idx) for sorting
                candidates.append((float(score), chunk.chunk_id, idx))

        if not candidates:
            return []

        # Sort primarily by score descending (-score), breaking ties deterministically
        # by chunk_id ascending
        candidates.sort(key=lambda item: (-item[0], item[1]))

        # 7. Build validated SearchResult objects preserving exact citation metadata
        results: list[SearchResult] = []
        for score, _, idx in candidates[:effective_top_k]:
            source_chunk = chunks[idx]
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
