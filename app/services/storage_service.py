"""In-memory document and chunk storage service with thread safety and atomic snapshots."""

import threading
from typing import Optional
from app.models.schemas import Chunk, DocumentMeta


class InMemoryDocumentStore:
    """Thread-safe, minimal in-memory storage for documents and their chunks."""

    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._documents: dict[str, DocumentMeta] = {}
        self._chunks: dict[str, list[Chunk]] = {}
        self._version: int = 0

    @property
    def version(self) -> int:
        """Monotonically increasing version counter for cache invalidation."""
        with self._lock:
            return self._version

    def add_document(self, document: DocumentMeta, chunks: list[Chunk]) -> DocumentMeta:
        """Store document metadata and associated chunks in memory.

        Validates that all chunks belong to the document's doc_id before mutating state.
        Never partially stores a document on validation failure.

        Args:
            document: DocumentMeta instance.
            chunks: List of Chunk instances belonging to this document.

        Returns:
            The stored DocumentMeta instance.

        Raises:
            ValueError: If doc_id already exists or if any chunk has a mismatched doc_id.
        """
        with self._lock:
            if document.doc_id in self._documents:
                raise ValueError(
                    f"Document with doc_id '{document.doc_id}' already exists."
                )

            # Validate that every chunk matches the document ID before mutating internal state
            for i, chunk in enumerate(chunks):
                if chunk.doc_id != document.doc_id:
                    raise ValueError(
                        f"Chunk at index {i} (chunk_id='{chunk.chunk_id}') has doc_id "
                        f"'{chunk.doc_id}' which does not match document doc_id '{document.doc_id}'."
                    )

            # Mutate storage atomically; store a copy of the list to avoid external mutation
            self._documents[document.doc_id] = document
            self._chunks[document.doc_id] = list(chunks)
            self._version += 1
            return document

    def get_document(self, doc_id: str) -> Optional[DocumentMeta]:
        """Retrieve document metadata by doc_id."""
        with self._lock:
            return self._documents.get(doc_id)

    def list_documents(self) -> list[DocumentMeta]:
        """List all stored documents sorted by created_at descending."""
        with self._lock:
            docs = list(self._documents.values())
            docs.sort(key=lambda d: d.created_at, reverse=True)
            return docs

    def delete_document(self, doc_id: str) -> bool:
        """Delete a document and all its chunks from memory.

        Returns:
            True if document was found and deleted, False otherwise.
        """
        with self._lock:
            if doc_id in self._documents:
                del self._documents[doc_id]
                self._chunks.pop(doc_id, None)
                self._version += 1
                return True
            return False

    def get_chunks(self, doc_id: Optional[str] = None) -> list[Chunk]:
        """Retrieve chunks, optionally filtered by doc_id.

        Returns a new list to prevent external mutation of internal storage.
        """
        with self._lock:
            if doc_id is not None:
                return list(self._chunks.get(doc_id, []))

            all_chunks: list[Chunk] = []
            for chunk_list in self._chunks.values():
                all_chunks.extend(chunk_list)
            return all_chunks

    def get_snapshot(self, doc_id: Optional[str] = None) -> tuple[list[Chunk], int]:
        """Atomically retrieve document chunks and the current store version under one lock.

        Allows consumers to build expensive indexes outside the lock and verify the
        version before publishing to cache.

        Returns:
            tuple of (list_of_chunks, store_version)
        """
        with self._lock:
            chunks = self.get_chunks(doc_id=doc_id)
            return chunks, self._version

    def clear(self) -> None:
        """Clear all stored documents and chunks."""
        with self._lock:
            self._documents.clear()
            self._chunks.clear()
            self._version += 1

    @property
    def document_count(self) -> int:
        """Total number of documents currently stored."""
        with self._lock:
            return len(self._documents)

    @property
    def chunk_count(self) -> int:
        """Total number of chunks currently stored."""
        with self._lock:
            return sum(len(c) for c in self._chunks.values())

