"""Integration tests for FastAPI application endpoints."""

import httpx
import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from app.services.storage_service import InMemoryDocumentStore


@pytest.fixture
def test_client():
    """Fixture providing a TestClient with a fresh, isolated in-memory store."""
    isolated_store = InMemoryDocumentStore()
    app = create_app(store=isolated_store)
    return TestClient(app)


def test_health_endpoint(test_client):
    """Verify health check returns initial zero metrics."""
    response = test_client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["documents_count"] == 0
    assert data["chunks_count"] == 0


def test_upload_valid_pdf_success(test_client, make_pdf):
    """Verify successful PDF upload, metadata creation, and health update."""
    pdf_bytes = make_pdf([
        "DocuMind artificial intelligence foundation page one.",
        "DocuMind second page information retrieval.",
    ])

    response = test_client.post(
        "/api/documents/upload",
        files={"file": ("documind.pdf", pdf_bytes, "application/pdf")},
    )

    assert response.status_code == 201
    data = response.json()
    assert "doc_id" in data
    assert data["filename"] == "documind.pdf"
    assert data["page_count"] == 2
    assert data["chunk_count"] >= 1
    assert data["file_size_bytes"] == len(pdf_bytes)

    # Verify health endpoint reflects the new document
    health_resp = test_client.get("/api/health")
    assert health_resp.json()["documents_count"] == 1
    assert health_resp.json()["chunks_count"] == data["chunk_count"]


def test_upload_rejects_oversized_file(make_pdf):
    """Verify 413 error when file exceeds configured byte limit."""
    pdf_bytes = make_pdf(["Some PDF text content."])
    # Configure tiny 50 byte max file limit
    low_limit_settings = Settings(max_file_size_bytes=50)
    app = create_app(store=InMemoryDocumentStore(), settings=low_limit_settings)
    client = TestClient(app)

    response = client.post(
        "/api/documents/upload",
        files={"file": ("large.pdf", pdf_bytes, "application/pdf")},
    )

    assert response.status_code == 413
    assert "exceeds maximum allowed limit" in response.json()["detail"]


def test_upload_rejects_non_pdf_extension(test_client):
    """Verify 400 error when uploaded file lacks .pdf extension."""
    response = test_client.post(
        "/api/documents/upload",
        files={"file": ("notes.txt", b"Plain text notes", "text/plain")},
    )

    assert response.status_code == 400
    assert "does not have a .pdf extension" in response.json()["detail"]


def test_upload_rejects_fake_pdf_header(test_client):
    """Verify 400 error when file content lacks %PDF- magic bytes."""
    response = test_client.post(
        "/api/documents/upload",
        files={"file": ("fake.pdf", b"Not a real PDF", "application/pdf")},
    )

    assert response.status_code == 400
    assert "standard PDF magic bytes" in response.json()["detail"]


def test_upload_rejects_corrupted_pdf(test_client):
    """Verify 400 error when PDF stream is corrupt."""
    corrupted_bytes = b"%PDF-1.4\n1 0 obj\n<< /Broken /Stream"
    response = test_client.post(
        "/api/documents/upload",
        files={"file": ("corrupt.pdf", corrupted_bytes, "application/pdf")},
    )

    assert response.status_code == 400
    assert "Failed to parse PDF" in response.json()["detail"] or "Failed to read" in response.json()["detail"]


def test_upload_rejects_blank_pdf(test_client, make_pdf):
    """Verify 400 error when PDF has pages but 0 extractable text."""
    blank_pdf = make_pdf(["", "   \t  "])
    response = test_client.post(
        "/api/documents/upload",
        files={"file": ("blank.pdf", blank_pdf, "application/pdf")},
    )

    assert response.status_code == 400
    assert "does not contain any extractable text" in response.json()["detail"]


def test_list_documents(test_client, make_pdf):
    """Verify listing documents returns uploaded documents in reverse-chronological order."""
    pdf1 = make_pdf(["Document number one content."])
    pdf2 = make_pdf(["Document number two content."])

    test_client.post(
        "/api/documents/upload",
        files={"file": ("doc1.pdf", pdf1, "application/pdf")},
    )
    test_client.post(
        "/api/documents/upload",
        files={"file": ("doc2.pdf", pdf2, "application/pdf")},
    )

    response = test_client.get("/api/documents")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 2
    assert len(data["documents"]) == 2
    # doc2 uploaded second, so it appears first in reverse-chronological list
    assert data["documents"][0]["filename"] == "doc2.pdf"
    assert data["documents"][1]["filename"] == "doc1.pdf"


def test_delete_document_success_and_404(test_client, make_pdf):
    """Verify document deletion removes document and returns 404 for missing IDs."""
    pdf = make_pdf(["Temporary document content."])
    upload_resp = test_client.post(
        "/api/documents/upload",
        files={"file": ("temp.pdf", pdf, "application/pdf")},
    )
    doc_id = upload_resp.json()["doc_id"]

    # Delete existing document
    del_resp = test_client.delete(f"/api/documents/{doc_id}")
    assert del_resp.status_code == 200
    assert del_resp.json()["doc_id"] == doc_id

    # Verify document no longer appears in list
    list_resp = test_client.get("/api/documents")
    assert list_resp.json()["total"] == 0

    # Delete again should return 404
    del_again_resp = test_client.delete(f"/api/documents/{doc_id}")
    assert del_again_resp.status_code == 404
    assert "not found" in del_again_resp.json()["detail"]


def test_search_documents_and_citations(test_client, make_pdf):
    """Verify search returns relevant passage with exact page citations."""
    pdf = make_pdf([
        ("Introduction to photosynthesis biochemical energy conversion in plant cells. " * 15).strip(),
        ("Deep quantum computing mechanisms and qubit superposition research. " * 15).strip(),
    ])

    upload_resp = test_client.post(
        "/api/documents/upload",
        files={"file": ("science.pdf", pdf, "application/pdf")},
    )
    assert upload_resp.status_code == 201

    # Search for photosynthesis
    search_payload = {"query": "photosynthesis energy plant cells"}
    response = test_client.post("/api/documents/search", json=search_payload)

    assert response.status_code == 200
    data = response.json()
    assert data["query"] == "photosynthesis energy plant cells"
    assert data["total_results"] >= 1

    first_result = data["results"][0]
    assert "photosynthesis" in first_result["text"].lower()
    assert first_result["start_page"] == 1
    assert first_result["end_page"] == 1
    assert first_result["pages"] == [1]
    assert first_result["page_citation"] == "p. 1"
    assert first_result["score"] > 0.0


def test_search_filtered_by_doc_id(test_client, make_pdf):
    """Verify search restricted to doc_id only returns matches from that document."""
    pdf1 = make_pdf(["Machine learning models for computer vision algorithms."])
    pdf2 = make_pdf(["Machine learning models for audio processing algorithms."])

    resp1 = test_client.post(
        "/api/documents/upload",
        files={"file": ("vision.pdf", pdf1, "application/pdf")},
    )
    resp2 = test_client.post(
        "/api/documents/upload",
        files={"file": ("audio.pdf", pdf2, "application/pdf")},
    )

    doc1_id = resp1.json()["doc_id"]
    doc2_id = resp2.json()["doc_id"]

    # Filter to doc1
    search_resp1 = test_client.post(
        "/api/documents/search",
        json={"query": "machine learning", "doc_id": doc1_id},
    )
    assert search_resp1.status_code == 200
    assert all(r["doc_id"] == doc1_id for r in search_resp1.json()["results"])

    # Filter to doc2
    search_resp2 = test_client.post(
        "/api/documents/search",
        json={"query": "machine learning", "doc_id": doc2_id},
    )
    assert search_resp2.status_code == 200
    assert all(r["doc_id"] == doc2_id for r in search_resp2.json()["results"])


def test_search_missing_doc_id_returns_404(test_client):
    """Verify searching for a non-existent doc_id returns 404."""
    response = test_client.post(
        "/api/documents/search",
        json={"query": "test query", "doc_id": "non-existent-uuid"},
    )
    assert response.status_code == 404
    assert "not found" in response.json()["detail"]


def test_search_validation_errors(test_client):
    """Verify 422 error on empty queries or invalid top_k."""
    # Empty query
    resp_empty = test_client.post(
        "/api/documents/search",
        json={"query": "   "},
    )
    assert resp_empty.status_code == 422

    # Negative top_k
    resp_neg = test_client.post(
        "/api/documents/search",
        json={"query": "valid query", "top_k": 0},
    )
    assert resp_neg.status_code == 422

    # Excess top_k > 50
    resp_excess = test_client.post(
        "/api/documents/search",
        json={"query": "valid query", "top_k": 51},
    )
    assert resp_excess.status_code == 422


def test_ask_endpoint_success(test_client, make_pdf, monkeypatch):
    """Verify POST /api/documents/ask produces a grounded answer with citations."""
    pdf = make_pdf([
        "Photosynthesis in plants generates oxygen and glucose from sunlight and carbon dioxide.",
    ])
    upload_resp = test_client.post(
        "/api/documents/upload",
        files={"file": ("biology.pdf", pdf, "application/pdf")},
    )
    assert upload_resp.status_code == 201

    # Mock the QA service generate_answer method on the app's QA instance
    qa_service = test_client.app.state.qa_service
    monkeypatch.setattr(
        qa_service,
        "generate_answer",
        lambda question, passages: (
            "Photosynthesis produces oxygen and glucose using sunlight [biology.pdf, p. 1].",
            False,
            None,
        ),
    )

    ask_payload = {"question": "What does photosynthesis produce?"}
    response = test_client.post("/api/documents/ask", json=ask_payload)

    assert response.status_code == 200
    data = response.json()
    assert data["question"] == "What does photosynthesis produce?"
    assert "Photosynthesis produces oxygen and glucose" in data["answer"]
    assert len(data["sources"]) >= 1
    assert data["sources"][0]["page_citation"] == "p. 1"
    assert data["fallback_used"] is False
    assert data["fallback_reason"] is None


def test_ask_endpoint_no_matching_passages(test_client, make_pdf):
    """Verify exact unsupported phrase when retrieval returns zero passages."""
    pdf = make_pdf(["Organic chemistry carbon molecular bonds."])
    test_client.post(
        "/api/documents/upload",
        files={"file": ("chem.pdf", pdf, "application/pdf")},
    )

    # Completely unrelated question produces 0 TF-IDF matches
    ask_payload = {"question": "astronaut rocket trajectory astrophysics"}
    response = test_client.post("/api/documents/ask", json=ask_payload)

    assert response.status_code == 200
    data = response.json()
    assert data["answer"] == "The document does not contain this information."
    assert data["sources"] == []
    assert data["fallback_used"] is False


def test_ask_endpoint_missing_doc_returns_404(test_client):
    """Verify POST /api/documents/ask returns 404 for unknown doc_id."""
    response = test_client.post(
        "/api/documents/ask",
        json={"question": "What is here?", "doc_id": "non-existent-id"},
    )
    assert response.status_code == 404
    assert "not found" in response.json()["detail"]


def test_ask_endpoint_fallback_when_gemini_fails(test_client, make_pdf, monkeypatch):
    """Verify fallback mode is activated when Gemini fails, returning passages with fallback_used=True."""
    pdf = make_pdf(["Renewable energy sources include solar, wind, and geothermal power."])
    upload_resp = test_client.post(
        "/api/documents/upload",
        files={"file": ("energy.pdf", pdf, "application/pdf")},
    )
    doc_id = upload_resp.json()["doc_id"]

    # Mock QA service failure triggering fallback
    qa_service = test_client.app.state.qa_service
    monkeypatch.setattr(
        qa_service,
        "generate_answer",
        lambda question, passages: (
            qa_service.format_fallback_answer(passages),
            True,
            "Gemini service request timed out.",
        ),
    )

    response = test_client.post(
        "/api/documents/ask",
        json={"question": "What are renewable energy sources?", "doc_id": doc_id},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["fallback_used"] is True
    assert "timed out" in data["fallback_reason"].lower()
    assert "[Fallback Mode — Gemini Unavailable]" in data["answer"]
    assert len(data["sources"]) >= 1


def test_ask_endpoint_validation_errors(test_client):
    """Verify 422 error on empty question or invalid top_k."""
    # Empty question
    resp_empty = test_client.post(
        "/api/documents/ask",
        json={"question": "   "},
    )
    assert resp_empty.status_code == 422

    # Zero top_k
    resp_zero = test_client.post(
        "/api/documents/ask",
        json={"question": "valid question", "top_k": 0},
    )
    assert resp_zero.status_code == 422


def test_root_serves_frontend_html(test_client):
    """Verify GET / serves the single-page HTML frontend with 200 OK."""
    response = test_client.get("/")
    assert response.status_code == 200
    assert "text/html" in response.headers.get("content-type", "")
    assert "<title>DocuMind AI" in response.text
    assert "DocuMind AI" in response.text
    assert 'id="drop-zone"' in response.text
    assert 'id="ask-form"' in response.text
    assert 'id="document-list"' in response.text
    assert 'id="reset-scope-btn"' in response.text
    # Verify misleading "clear-scope-btn" / "Select All" button was cleanly replaced
    assert 'id="clear-scope-btn"' not in response.text
    # Verify no visible Gemini branding
    assert "Gemini answer" not in response.text


def test_static_assets_served(test_client):
    """Verify static CSS and JS assets are successfully accessible via /static/."""
    css_resp = test_client.get("/static/style.css")
    assert css_resp.status_code == 200
    assert "text/css" in css_resp.headers.get("content-type", "")

    js_resp = test_client.get("/static/app.js")
    assert js_resp.status_code == 200
    assert "javascript" in js_resp.headers.get("content-type", "")


def test_ask_endpoint_all_documents_scope_without_doc_id(test_client, make_pdf):
    """Verify omitting doc_id in /api/documents/ask searches across all uploaded documents."""
    pdf_a = make_pdf(["Quantum computing uses qubits for quantum parallelism."])
    pdf_b = make_pdf(["Photosynthesis converts sunlight into biochemical energy."])

    resp_a = test_client.post(
        "/api/documents/upload",
        files={"file": ("quantum.pdf", pdf_a, "application/pdf")},
    )
    assert resp_a.status_code == 201

    resp_b = test_client.post(
        "/api/documents/upload",
        files={"file": ("biology.pdf", pdf_b, "application/pdf")},
    )
    assert resp_b.status_code == 201

    # Ask query matching doc A without specifying doc_id (global "All Documents" scope)
    ask_resp_a = test_client.post(
        "/api/documents/ask",
        json={"question": "What does quantum computing use?"},
    )
    assert ask_resp_a.status_code == 200
    data_a = ask_resp_a.json()
    assert len(data_a["sources"]) >= 1
    assert data_a["sources"][0]["filename"] == "quantum.pdf"

    # Ask query matching doc B without specifying doc_id (global "All Documents" scope)
    ask_resp_b = test_client.post(
        "/api/documents/ask",
        json={"question": "What is photosynthesis?"},
    )
    assert ask_resp_b.status_code == 200
    data_b = ask_resp_b.json()
    assert len(data_b["sources"]) >= 1
    assert data_b["sources"][0]["filename"] == "biology.pdf"


def test_lifespan_http_client_initialization_and_cleanup():
    """Verify reusable HTTP client is configured on lifespan startup and closed on shutdown."""
    app = create_app(store=InMemoryDocumentStore())
    with TestClient(app) as client:
        # Check that http_client is attached and reusable
        assert hasattr(client.app.state, "http_client")
        active_client = client.app.state.http_client
        assert isinstance(active_client, httpx.AsyncClient)
        assert client.app.state.qa_service._async_client is active_client
        assert active_client.is_closed is False

    # After exiting the with-block, lifespan cleanup must have executed
    assert active_client.is_closed is True


def test_create_app_instance_isolation(make_pdf):
    """Verify complete isolation between separate create_app instances."""
    store1 = InMemoryDocumentStore()
    store2 = InMemoryDocumentStore()
    app1 = create_app(store=store1)
    app2 = create_app(store=store2)

    assert app1.state.store is not app2.state.store
    assert app1.state.retriever is not app2.state.retriever
    assert app1.state.qa_service is not app2.state.qa_service

    client1 = TestClient(app1)
    client2 = TestClient(app2)

    pdf = make_pdf(["Document in store one only."])
    resp1 = client1.post("/api/documents/upload", files={"file": ("doc1.pdf", pdf, "application/pdf")})
    assert resp1.status_code == 201

    # Store 1 has document, store 2 remains pristine
    assert client1.get("/api/health").json()["documents_count"] == 1
    assert client2.get("/api/health").json()["documents_count"] == 0


def test_ask_endpoint_async_client_production_path(make_pdf):
    """Verify /api/documents/ask uses injected AsyncClient without blocking event loop."""
    from unittest.mock import AsyncMock, MagicMock

    mock_async_client = AsyncMock(spec=httpx.AsyncClient)
    mock_response = MagicMock(spec=httpx.Response)
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "candidates": [
            {
                "content": {
                    "parts": [
                        {"text": "Photosynthesis converts solar energy into glucose [botany.pdf, p. 1]."}
                    ]
                }
            }
        ]
    }
    mock_async_client.post.return_value = mock_response

    store = InMemoryDocumentStore()
    settings = Settings(gemini_api_key="valid-test-key")
    app = create_app(store=store, settings=settings, async_client=mock_async_client)
    client = TestClient(app)

    pdf = make_pdf(["Photosynthesis converts solar energy into glucose."])
    upload_resp = client.post("/api/documents/upload", files={"file": ("botany.pdf", pdf, "application/pdf")})
    assert upload_resp.status_code == 201

    ask_resp = client.post(
        "/api/documents/ask",
        json={"question": "How does photosynthesis produce glucose?"},
    )
    assert ask_resp.status_code == 200
    data = ask_resp.json()
    assert "Photosynthesis converts solar energy into glucose" in data["answer"]
    assert data["fallback_used"] is False
    assert mock_async_client.post.await_count == 1
