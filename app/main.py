"""FastAPI application for DocuMind AI."""

import uuid
from typing import Annotated, Optional

from fastapi import Depends, FastAPI, File, HTTPException, Request, UploadFile, status

from app.config import Settings, get_settings
from app.models.schemas import (
    AskRequest,
    AskResponse,
    DocumentMeta,
    SearchRequest,
    SearchResponse,
)
from app.services.chunking_service import chunk_document_pages
from app.services.pdf_service import (
    InvalidPDFError,
    NoExtractableTextError,
    PDFSizeLimitExceededError,
    extract_pdf_pages,
)
from app.services.qa_service import UNSUPPORTED_ANSWER, GeminiQAService
from app.services.retrieval_service import TfidfRetriever
from app.services.storage_service import InMemoryDocumentStore


def get_current_store(request: Request) -> InMemoryDocumentStore:
    """Dependency provider for the application document store."""
    return request.app.state.store


def get_current_retriever(request: Request) -> TfidfRetriever:
    """Dependency provider for the application retrieval engine."""
    return request.app.state.retriever


def get_current_qa_service(request: Request) -> GeminiQAService:
    """Dependency provider for the Gemini QA service."""
    return request.app.state.qa_service


def get_current_settings(request: Request) -> Settings:
    """Dependency provider for application settings."""
    return request.app.state.settings


def create_app(
    store: Optional[InMemoryDocumentStore] = None,
    retriever: Optional[TfidfRetriever] = None,
    qa_service: Optional[GeminiQAService] = None,
    settings: Optional[Settings] = None,
) -> FastAPI:
    """Create and configure the FastAPI application instance.

    Allows injecting isolated store, retriever, and QA service instances for testing.
    """
    app_settings = settings or get_settings()
    app_store = store if store is not None else InMemoryDocumentStore()
    app_retriever = (
        retriever
        if retriever is not None
        else TfidfRetriever(app_store, default_top_k=app_settings.default_top_k)
    )
    app_qa_service = (
        qa_service
        if qa_service is not None
        else GeminiQAService(settings=app_settings)
    )

    application = FastAPI(
        title="DocuMind AI",
        description="PDF ingestion, retrieval, and document-grounded question answering",
        version="0.1.0",
    )

    # Attach predictable instances to application state
    application.state.settings = app_settings
    application.state.store = app_store
    application.state.retriever = app_retriever
    application.state.qa_service = app_qa_service

    # --------------------------------------------------------------------------
    # Health Endpoint
    # --------------------------------------------------------------------------
    @application.get("/api/health")
    def health_check(
        current_store: Annotated[InMemoryDocumentStore, Depends(get_current_store)],
    ) -> dict:
        """Health check endpoint reporting document and chunk metrics."""
        return {
            "status": "ok",
            "documents_count": current_store.document_count,
            "chunks_count": current_store.chunk_count,
        }

    # --------------------------------------------------------------------------
    # Document Upload Endpoint
    # --------------------------------------------------------------------------
    @application.post(
        "/api/documents/upload",
        status_code=status.HTTP_201_CREATED,
        response_model=DocumentMeta,
    )
    async def upload_document(
        file: Annotated[UploadFile, File(...)],
        current_store: Annotated[InMemoryDocumentStore, Depends(get_current_store)],
        active_settings: Annotated[Settings, Depends(get_current_settings)],
    ) -> DocumentMeta:
        """Upload and ingest a PDF document.

        Reads file stream in bounded 64 KiB blocks to enforce size limits,
        validates content, extracts pages, chunks text, and stores in memory.
        """
        filename = file.filename or ""
        block_size = 64 * 1024  # 64 KiB
        chunks_data: list[bytes] = []
        total_bytes = 0

        # Read upload stream in bounded blocks
        try:
            while True:
                chunk = await file.read(block_size)
                if not chunk:
                    break
                total_bytes += len(chunk)
                if total_bytes > active_settings.max_file_size_bytes:
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail=(
                            f"File exceeds maximum allowed limit of "
                            f"{active_settings.max_file_size_bytes} bytes."
                        ),
                    )
                chunks_data.append(chunk)
        finally:
            await file.close()

        file_bytes = b"".join(chunks_data)

        # Validate and extract pages
        try:
            pages = extract_pdf_pages(
                file_bytes=file_bytes,
                filename=filename,
                max_size_bytes=active_settings.max_file_size_bytes,
            )
        except PDFSizeLimitExceededError as err:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=str(err),
            ) from err
        except (InvalidPDFError, NoExtractableTextError) as err:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(err),
            ) from err

        # Generate unique document ID and chunk pages
        doc_id = str(uuid.uuid4())
        doc_chunks = chunk_document_pages(
            doc_id=doc_id,
            filename=filename,
            pages=pages,
            target_chunk_words=active_settings.target_chunk_words,
            chunk_overlap_words=active_settings.chunk_overlap_words,
        )

        meta = DocumentMeta(
            doc_id=doc_id,
            filename=filename,
            page_count=len(pages),
            chunk_count=len(doc_chunks),
            file_size_bytes=len(file_bytes),
        )

        current_store.add_document(meta, doc_chunks)
        return meta

    # --------------------------------------------------------------------------
    # Document List Endpoint
    # --------------------------------------------------------------------------
    @application.get("/api/documents")
    def list_documents(
        current_store: Annotated[InMemoryDocumentStore, Depends(get_current_store)],
    ) -> dict:
        """List all uploaded documents in memory."""
        docs = current_store.list_documents()
        return {
            "documents": [d.model_dump(mode="json") for d in docs],
            "total": current_store.document_count,
        }

    # --------------------------------------------------------------------------
    # Document Delete Endpoint
    # --------------------------------------------------------------------------
    @application.delete("/api/documents/{doc_id}")
    def delete_document(
        doc_id: str,
        current_store: Annotated[InMemoryDocumentStore, Depends(get_current_store)],
    ) -> dict:
        """Delete an uploaded document and its chunks from memory."""
        deleted = current_store.delete_document(doc_id)
        if not deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Document '{doc_id}' not found.",
            )
        return {
            "message": f"Document '{doc_id}' deleted successfully.",
            "doc_id": doc_id,
        }

    # --------------------------------------------------------------------------
    # Document Search Endpoint
    # --------------------------------------------------------------------------
    @application.post("/api/documents/search", response_model=SearchResponse)
    def search_documents(
        search_req: SearchRequest,
        current_store: Annotated[InMemoryDocumentStore, Depends(get_current_store)],
        current_retriever: Annotated[TfidfRetriever, Depends(get_current_retriever)],
    ) -> SearchResponse:
        """Query ingested documents using TF-IDF and return matching passages with citations."""
        # If doc_id filter is specified, verify it exists
        if search_req.doc_id is not None:
            doc = current_store.get_document(search_req.doc_id)
            if doc is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Document '{search_req.doc_id}' not found.",
                )

        results = current_retriever.search(
            query=search_req.query,
            doc_id=search_req.doc_id,
            top_k=search_req.top_k,
        )

        return SearchResponse(
            query=search_req.query,
            results=results,
            total_results=len(results),
        )

    # --------------------------------------------------------------------------
    # Document Question Answering (Ask) Endpoint
    # --------------------------------------------------------------------------
    @application.post("/api/documents/ask", response_model=AskResponse)
    def ask_document_question(
        ask_req: AskRequest,
        current_store: Annotated[InMemoryDocumentStore, Depends(get_current_store)],
        current_retriever: Annotated[TfidfRetriever, Depends(get_current_retriever)],
        current_qa: Annotated[GeminiQAService, Depends(get_current_qa_service)],
    ) -> AskResponse:
        """Answer questions grounded strictly in retrieved document passages."""
        # If doc_id filter is specified, verify it exists
        if ask_req.doc_id is not None:
            doc = current_store.get_document(ask_req.doc_id)
            if doc is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Document '{ask_req.doc_id}' not found.",
                )

        # Retrieve relevant passages
        passages = current_retriever.search(
            query=ask_req.question,
            doc_id=ask_req.doc_id,
            top_k=ask_req.top_k,
        )

        # If retrieval returns no passages, return exact unsupported answer without calling Gemini
        if not passages:
            return AskResponse(
                question=ask_req.question,
                answer=UNSUPPORTED_ANSWER,
                sources=[],
                fallback_used=False,
                fallback_reason=None,
            )

        # Generate answer via Gemini or safe fallback
        answer_text, fallback_used, fallback_reason = current_qa.generate_answer(
            question=ask_req.question,
            passages=passages,
        )

        return AskResponse(
            question=ask_req.question,
            answer=answer_text,
            sources=passages,
            fallback_used=fallback_used,
            fallback_reason=fallback_reason,
        )

    return application


# Default module-level application instance for ASGI servers
app = create_app()
