"""FastAPI application for DocuMind AI."""

from contextlib import asynccontextmanager
import inspect
from pathlib import Path
from typing import Annotated, Optional
import uuid

import httpx
from fastapi import Depends, FastAPI, File, HTTPException, Request, UploadFile, status
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from starlette.concurrency import run_in_threadpool

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
    async_client: Optional[httpx.AsyncClient] = None,
) -> FastAPI:
    """Create and configure the FastAPI application instance.

    Allows injecting isolated store, retriever, QA service, and async client instances for testing.
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
    if async_client is not None:
        app_qa_service.set_async_client(async_client)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        # Manage reusable persistent httpx.AsyncClient across the application lifespan
        client_to_close = None
        if not getattr(app.state.qa_service, "_async_client", None):
            managed_client = httpx.AsyncClient(
                timeout=httpx.Timeout(app.state.settings.gemini_timeout_seconds, connect=5.0),
                limits=httpx.Limits(
                    max_keepalive_connections=10,
                    max_connections=20,
                    keepalive_expiry=30.0,
                ),
            )
            app.state.qa_service.set_async_client(managed_client)
            client_to_close = managed_client
            app.state.http_client = managed_client
        else:
            app.state.http_client = app.state.qa_service._async_client

        try:
            yield
        finally:
            if client_to_close is not None:
                await client_to_close.aclose()
            if hasattr(app.state.qa_service, "aclose"):
                await app.state.qa_service.aclose()

    application = FastAPI(
        title="DocuMind AI",
        description="PDF ingestion, retrieval, and document-grounded question answering",
        version="0.1.0",
        lifespan=lifespan,
    )

    # Attach predictable instances to application state
    application.state.settings = app_settings
    application.state.store = app_store
    application.state.retriever = app_retriever
    application.state.qa_service = app_qa_service

    # --------------------------------------------------------------------------
    # Frontend Static Files and Root Route
    # --------------------------------------------------------------------------
    # Legacy / fallback vanilla static assets directory
    legacy_static_dir = Path(__file__).resolve().parent / "static"
    if legacy_static_dir.is_dir():
        application.mount(
            "/static",
            StaticFiles(directory=legacy_static_dir),
            name="static",
        )

    # Built React production assets directory
    dist_dir = Path(__file__).resolve().parent.parent / "frontend" / "dist"
    dist_assets_dir = dist_dir / "assets"
    if dist_assets_dir.is_dir():
        application.mount(
            "/assets",
            StaticFiles(directory=dist_assets_dir),
            name="assets",
        )

    @application.get("/", response_class=FileResponse)
    def serve_frontend() -> FileResponse:
        """Serve the single-page HTML frontend.

        Prioritizes the compiled React production bundle from frontend/dist/index.html
        when available, gracefully falling back to the vanilla app/static/index.html.
        """
        react_index = dist_dir / "index.html"
        if react_index.is_file():
            return FileResponse(react_index, media_type="text/html")

        vanilla_index = legacy_static_dir / "index.html"
        if vanilla_index.is_file():
            return FileResponse(vanilla_index, media_type="text/html")

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Frontend index.html not found.",
        )

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
                        status_code=status.HTTP_413_CONTENT_TOO_LARGE,
                        detail=(
                            f"File exceeds maximum allowed limit of "
                            f"{active_settings.max_file_size_bytes} bytes."
                        ),
                    )
                chunks_data.append(chunk)
        finally:
            await file.close()

        file_bytes = b"".join(chunks_data)

        # Offload CPU-bound PDF extraction to threadpool to keep event loop responsive
        try:
            pages = await run_in_threadpool(
                extract_pdf_pages,
                file_bytes=file_bytes,
                filename=filename,
                max_size_bytes=active_settings.max_file_size_bytes,
            )
        except PDFSizeLimitExceededError as err:
            raise HTTPException(
                status_code=status.HTTP_413_CONTENT_TOO_LARGE,
                detail=str(err),
            ) from err
        except (InvalidPDFError, NoExtractableTextError) as err:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(err),
            ) from err

        # Generate unique document ID and offload chunking to threadpool
        doc_id = str(uuid.uuid4())
        doc_chunks = await run_in_threadpool(
            chunk_document_pages,
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
    async def ask_document_question(
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

        # Determine execution path: support custom mocked generate_answer (from sync tests)
        # while using asynchronous agenerate_answer for production
        is_generate_mocked = (
            getattr(current_qa.generate_answer, "__func__", current_qa.generate_answer)
            != GeminiQAService.generate_answer
        )

        if is_generate_mocked:
            res = current_qa.generate_answer(
                question=ask_req.question,
                passages=passages,
            )
            if inspect.isawaitable(res):
                answer_text, fallback_used, fallback_reason = await res
            else:
                answer_text, fallback_used, fallback_reason = res
        elif hasattr(current_qa, "agenerate_answer"):
            answer_text, fallback_used, fallback_reason = await current_qa.agenerate_answer(
                question=ask_req.question,
                passages=passages,
            )
        else:
            res = current_qa.generate_answer(
                question=ask_req.question,
                passages=passages,
            )
            if inspect.isawaitable(res):
                answer_text, fallback_used, fallback_reason = await res
            else:
                answer_text, fallback_used, fallback_reason = res

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
