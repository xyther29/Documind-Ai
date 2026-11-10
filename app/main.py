"""FastAPI application for DocuMind AI."""

import asyncio
from contextlib import asynccontextmanager
import inspect
from pathlib import Path
import time
from typing import Annotated, Optional, Union
import uuid

import httpx
from fastapi import Depends, FastAPI, File, Header, HTTPException, Request, UploadFile, status
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from starlette.concurrency import run_in_threadpool

from app.auth import get_current_identity
from app.config import Settings, get_settings
from app.models.auth_schemas import UserIdentity
from app.models.schemas import (
    AskRequest,
    AskResponse,
    DocumentMeta,
    SearchRequest,
    SearchResponse,
)
from app.routers import auth as auth_router
from app.services.chunking_service import chunk_document_pages
from app.services.guest_service import (
    AuthenticatedIdempotencyManager,
    GuestSessionService,
    IdempotencyState,
    extract_client_ip,
)
from app.services.pdf_service import (
    InvalidPDFError,
    NoExtractableTextError,
    PDFSizeLimitExceededError,
    extract_pdf_pages,
)
from app.services.qa_service import UNSUPPORTED_ANSWER, GeminiQAService
from app.services.retrieval_service import TfidfRetriever
from app.services.storage_service import InMemoryDocumentStore, UserPartitionedStore


def get_current_store(request: Request) -> UserPartitionedStore:
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


def get_current_guest_service(request: Request) -> GuestSessionService:
    """Dependency provider for the guest session service."""
    return request.app.state.guest_service


def get_current_auth_idempotency_mgr(request: Request) -> AuthenticatedIdempotencyManager:
    """Dependency provider for authenticated question idempotency manager."""
    return request.app.state.auth_idempotency_mgr


def create_app(
    store: Optional[Union[UserPartitionedStore, InMemoryDocumentStore]] = None,
    retriever: Optional[TfidfRetriever] = None,
    qa_service: Optional[GeminiQAService] = None,
    settings: Optional[Settings] = None,
    async_client: Optional[httpx.AsyncClient] = None,
    guest_service: Optional[GuestSessionService] = None,
) -> FastAPI:
    """Create and configure the FastAPI application instance.

    Defaults store to UserPartitionedStore in production. If a legacy InMemoryDocumentStore
    is supplied (for test compatibility), wraps it explicitly via for_testing_from_single_store.
    """
    app_settings = settings or get_settings()

    if store is None:
        app_store = UserPartitionedStore()
    elif isinstance(store, InMemoryDocumentStore):
        app_store = UserPartitionedStore.for_testing_from_single_store(store, test_partition_id="test_legacy")
    else:
        app_store = store

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
    app_guest_service = (
        guest_service
        if guest_service is not None
        else GuestSessionService(settings=app_settings)
    )
    app_auth_idempotency_mgr = AuthenticatedIdempotencyManager()

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
    application.state.guest_service = app_guest_service
    application.state.auth_idempotency_mgr = app_auth_idempotency_mgr

    # Include authentication and guest session router
    application.include_router(auth_router.router)

    # --------------------------------------------------------------------------
    # Frontend Static Files and Root Route
    # --------------------------------------------------------------------------
    legacy_static_dir = Path(__file__).resolve().parent / "static"
    if legacy_static_dir.is_dir():
        application.mount(
            "/static",
            StaticFiles(directory=legacy_static_dir),
            name="static",
        )

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
        """Serve the single-page HTML frontend."""
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
    # Health Endpoint (Public - Zero Auth Dependency)
    # --------------------------------------------------------------------------
    @application.get("/api/health")
    def health_check(
        current_store: Annotated[UserPartitionedStore, Depends(get_current_store)],
    ) -> dict:
        """Health check endpoint reporting aggregate document and chunk metrics."""
        return {
            "status": "ok",
            "documents_count": current_store.document_count,
            "chunks_count": current_store.chunk_count,
        }

    # --------------------------------------------------------------------------
    # Document Upload Endpoint (Secured & Partition-Scoped)
    # --------------------------------------------------------------------------
    @application.post(
        "/api/documents/upload",
        status_code=status.HTTP_201_CREATED,
        response_model=DocumentMeta,
    )
    async def upload_document(
        file: Annotated[UploadFile, File(...)],
        current_store: Annotated[UserPartitionedStore, Depends(get_current_store)],
        active_settings: Annotated[Settings, Depends(get_current_settings)],
        identity: Annotated[UserIdentity, Depends(get_current_identity)],
        guest_service: Annotated[GuestSessionService, Depends(get_current_guest_service)],
        request: Request,
    ) -> DocumentMeta:
        """Upload and ingest a PDF document strictly within the caller's verified partition.

        Enforces atomic quota reservations prior to expensive PDF processing,
        ensuring concurrent requests cannot exceed limits and failed uploads release reservations.
        """
        client_ip = extract_client_ip(request, active_settings)

        # 1. Coordinated quota reservation under strict Level 1 -> Level 2 hierarchy
        if identity.is_guest:
            now = time.time()
            guest_service.coordinate_upload_reservation(
                guest_id=uuid.UUID(identity.user_id),
                client_ip=client_ip,
                current_time=now,
            )

        upload_succeeded = False
        try:
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

            # Offload CPU-bound PDF extraction to threadpool
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

            # Store strictly in caller's verified partition
            current_store.add_document(identity.partition_id, meta, doc_chunks)
            upload_succeeded = True
            return meta
        finally:
            if identity.is_guest:
                guest_service.finalize_upload(
                    guest_id=uuid.UUID(identity.user_id),
                    client_ip=client_ip,
                    success=upload_succeeded,
                )

    # --------------------------------------------------------------------------
    # Document List Endpoint (Secured & Partition-Scoped)
    # --------------------------------------------------------------------------
    @application.get("/api/documents")
    def list_documents(
        current_store: Annotated[UserPartitionedStore, Depends(get_current_store)],
        identity: Annotated[UserIdentity, Depends(get_current_identity)],
    ) -> dict:
        """List documents belonging exclusively to the caller's verified partition."""
        docs = current_store.list_documents(identity.partition_id)
        return {
            "documents": [d.model_dump(mode="json") for d in docs],
            "total": len(docs),
        }

    # --------------------------------------------------------------------------
    # Document Delete Endpoint (Secured & Partition-Scoped)
    # --------------------------------------------------------------------------
    @application.delete("/api/documents/{doc_id}")
    def delete_document(
        doc_id: str,
        current_store: Annotated[UserPartitionedStore, Depends(get_current_store)],
        identity: Annotated[UserIdentity, Depends(get_current_identity)],
        guest_service: Annotated[GuestSessionService, Depends(get_current_guest_service)],
    ) -> dict:
        """Delete an uploaded document and its chunks from caller's partition."""
        deleted = current_store.delete_document(identity.partition_id, doc_id)
        if not deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Document '{doc_id}' not found.",
            )
        if identity.is_guest:
            guest_service.record_document_delete(uuid.UUID(identity.user_id))

        return {
            "message": f"Document '{doc_id}' deleted successfully.",
            "doc_id": doc_id,
        }

    # --------------------------------------------------------------------------
    # Document Search Endpoint (Secured & Partition-Scoped)
    # --------------------------------------------------------------------------
    @application.post("/api/documents/search", response_model=SearchResponse)
    def search_documents(
        search_req: SearchRequest,
        current_store: Annotated[UserPartitionedStore, Depends(get_current_store)],
        current_retriever: Annotated[TfidfRetriever, Depends(get_current_retriever)],
        identity: Annotated[UserIdentity, Depends(get_current_identity)],
    ) -> SearchResponse:
        """Query ingested documents using TF-IDF strictly within caller's partition."""
        if search_req.doc_id is not None:
            doc = current_store.get_document(identity.partition_id, search_req.doc_id)
            if doc is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Document '{search_req.doc_id}' not found.",
                )

        results = current_retriever.search(
            query=search_req.query,
            doc_id=search_req.doc_id,
            top_k=search_req.top_k,
            partition_id=identity.partition_id,
        )

        return SearchResponse(
            query=search_req.query,
            results=results,
            total_results=len(results),
        )

    # --------------------------------------------------------------------------
    # Document Question Answering (Ask) Endpoint (Secured, Partition-Scoped & Idempotent)
    # --------------------------------------------------------------------------
    @application.post("/api/documents/ask", response_model=AskResponse)
    async def ask_document_question(
        ask_req: AskRequest,
        current_store: Annotated[UserPartitionedStore, Depends(get_current_store)],
        current_retriever: Annotated[TfidfRetriever, Depends(get_current_retriever)],
        current_qa: Annotated[GeminiQAService, Depends(get_current_qa_service)],
        identity: Annotated[UserIdentity, Depends(get_current_identity)],
        guest_service: Annotated[GuestSessionService, Depends(get_current_guest_service)],
        auth_idempotency_mgr: Annotated[AuthenticatedIdempotencyManager, Depends(get_current_auth_idempotency_mgr)],
        active_settings: Annotated[Settings, Depends(get_current_settings)],
        request: Request,
        x_request_id: Annotated[Optional[str], Header(alias="X-Request-Id")] = None,
    ) -> AskResponse:
        """Answer questions grounded strictly in retrieved passages within caller's partition.

        Enforces UUID request idempotency, non-blocking duplicate request coordination,
        and atomic quota acceptance under strict lock ordering.
        """
        # 1. Validate and resolve request_id
        body_req_id = ask_req.request_id
        if x_request_id and body_req_id:
            if x_request_id.strip() != body_req_id.strip():
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="Conflicting request identifiers: 'X-Request-Id' header does not match body 'request_id'.",
                )

        resolved_req_id = x_request_id.strip() if x_request_id else (body_req_id.strip() if body_req_id else None)
        if resolved_req_id:
            try:
                uuid.UUID(resolved_req_id)
            except (ValueError, TypeError) as exc:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"Invalid request ID. Must be a valid UUID string: {resolved_req_id}",
                ) from exc

        effective_request_id = resolved_req_id or str(uuid.uuid4())

        # 2. Document ownership & library validation (Quota NOT consumed if fails)
        if ask_req.doc_id is not None:
            doc = current_store.get_document(identity.partition_id, ask_req.doc_id)
            if doc is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Document '{ask_req.doc_id}' not found.",
                )
        else:
            if current_store.partition_document_count(identity.partition_id) == 0:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="No documents found in your library. Please upload a PDF first.",
                )

        # 3. Coordinated acceptance operation under Level 1 -> Level 2 lock ordering
        client_ip = extract_client_ip(request, active_settings)
        now = time.time()

        if identity.is_guest:
            existing_rec, new_rec = guest_service.coordinate_question_acceptance(
                guest_id=uuid.UUID(identity.user_id),
                client_ip=client_ip,
                request_id=effective_request_id,
                current_time=now,
            )
        else:
            existing_rec, new_rec = auth_idempotency_mgr.coordinate_question_acceptance(
                partition_id=identity.partition_id,
                request_id=effective_request_id,
                current_time=now,
            )

        # 4. Handle duplicate request
        if existing_rec is not None:
            if existing_rec.state == IdempotencyState.COMPLETED and existing_rec.response is not None:
                return existing_rec.response

            if existing_rec.state == IdempotencyState.FAILED:
                raise HTTPException(
                    status_code=existing_rec.error_status or status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=existing_rec.error_detail or "Original request failed.",
                )

            # In-flight duplicate: wait on event without blocking event loop thread
            wait_success = await run_in_threadpool(
                existing_rec.event.wait,
                active_settings.gemini_timeout_seconds,
            )
            if not wait_success:
                raise HTTPException(
                    status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                    detail="Duplicate request timed out waiting for in-flight response.",
                )

            if existing_rec.state == IdempotencyState.COMPLETED and existing_rec.response is not None:
                return existing_rec.response
            else:
                raise HTTPException(
                    status_code=existing_rec.error_status or status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=existing_rec.error_detail or "Original request failed.",
                )

        # 5. Process new accepted question outside locks
        assert new_rec is not None
        try:
            passages = current_retriever.search(
                query=ask_req.question,
                doc_id=ask_req.doc_id,
                top_k=ask_req.top_k,
                partition_id=identity.partition_id,
            )

            # If retrieval returns no passages, return exact unsupported answer
            if not passages:
                resp = AskResponse(
                    question=ask_req.question,
                    answer=UNSUPPORTED_ANSWER,
                    sources=[],
                    fallback_used=False,
                    fallback_reason=None,
                )
                new_rec.mark_completed(resp, time.time())
                return resp

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

            resp = AskResponse(
                question=ask_req.question,
                answer=answer_text,
                sources=passages,
                fallback_used=fallback_used,
                fallback_reason=fallback_reason,
            )
            new_rec.mark_completed(resp, time.time())
            return resp
        except HTTPException as exc:
            new_rec.mark_failed(exc.status_code, exc.detail, time.time())
            raise
        except Exception as exc:
            new_rec.mark_failed(status.HTTP_500_INTERNAL_SERVER_ERROR, "Failed to generate answer.", time.time())
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to generate answer.",
            ) from exc

    return application


# Default module-level application instance for ASGI servers
app = create_app()
