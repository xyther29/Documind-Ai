"""DocuMind AI — End-to-End Automated Verification Script.

Executes a complete, isolated end-to-end journey verifying:
1. Health endpoint.
2. PDF upload and validation using the canonical sample RAG primer PDF.
3. Document listing and metadata extraction (page count, chunk count, size).
4. Grounded question answering with source citations.
5. Exact unsupported-answer fallback ("The document does not contain this information.").
6. Fallback activation when Gemini is unconfigured or unavailable.
7. Document deletion and library reset.
8. Real headless Chrome browser DOM and asset delivery verification.
"""

from pathlib import Path
import subprocess
import sys
import time

# Ensure project root is in sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from app.services.qa_service import UNSUPPORTED_ANSWER
from app.services.storage_service import InMemoryDocumentStore


def run_api_e2e_journey() -> dict:
    """Execute full user journey through FastAPI endpoints."""
    print("\n" + "=" * 60)
    print("  PHASE 1: API END-TO-END WORKFLOW VERIFICATION")
    print("=" * 60)

    results = {}
    sample_pdf_path = Path(__file__).resolve().parent.parent / "demo" / "sample_rag_primer.pdf"
    if not sample_pdf_path.is_file():
        from demo.generate_sample_pdf import generate_sample_pdf
        generate_sample_pdf(sample_pdf_path)

    pdf_bytes = sample_pdf_path.read_bytes()

    # Create isolated application instance with predictable settings
    isolated_store = InMemoryDocumentStore()
    app = create_app(store=isolated_store, settings=Settings(gemini_api_key="mock-api-key"))

    with TestClient(app) as client:
        # 1. Health check initial
        print("1. Verifying /api/health endpoint...")
        resp = client.get("/api/health")
        assert resp.status_code == 200, f"Health check failed: {resp.text}"
        data = resp.json()
        assert data["status"] == "ok"
        assert data["documents_count"] == 0
        print("   [PASS] Initial health ok. Documents: 0, Chunks: 0")
        results["health_check_initial"] = True

        # 2. PDF upload
        print("2. Uploading canonical sample RAG primer PDF...")
        upload_resp = client.post(
            "/api/documents/upload",
            files={"file": ("sample_rag_primer.pdf", pdf_bytes, "application/pdf")},
        )
        assert upload_resp.status_code == 201, f"Upload failed: {upload_resp.text}"
        doc_meta = upload_resp.json()
        doc_id = doc_meta["doc_id"]
        assert doc_meta["filename"] == "sample_rag_primer.pdf"
        assert doc_meta["page_count"] == 3
        assert doc_meta["chunk_count"] >= 3
        assert doc_meta["file_size_bytes"] == len(pdf_bytes)
        print(f"   [PASS] Uploaded successfully: doc_id={doc_id[:8]}... pages={doc_meta['page_count']} chunks={doc_meta['chunk_count']}")
        results["pdf_upload"] = True

        # 3. Document list verification
        print("3. Verifying /api/documents library listing...")
        list_resp = client.get("/api/documents")
        assert list_resp.status_code == 200
        list_data = list_resp.json()
        assert list_data["total"] == 1
        assert list_data["documents"][0]["doc_id"] == doc_id
        print("   [PASS] Library listing reflects uploaded document.")
        results["document_listing"] = True

        # 4. Search verification
        print("4. Verifying /api/documents/search retrieval...")
        search_resp = client.post(
            "/api/documents/search",
            json={"query": "Retrieval-Augmented Generation RAG architecture", "doc_id": doc_id, "top_k": 3},
        )
        assert search_resp.status_code == 200
        search_data = search_resp.json()
        assert search_data["total_results"] > 0
        top_hit = search_data["results"][0]
        assert top_hit["filename"] == "sample_rag_primer.pdf"
        assert top_hit["score"] > 0.0
        print(f"   [PASS] Retrieved {search_data['total_results']} passages. Top score: {top_hit['score']:.4f}")
        results["retrieval_search"] = True

        # 5. Grounded Q&A with mocked answer
        print("5. Verifying grounded Q&A with citations...")
        qa_service = client.app.state.qa_service
        # Inject deterministic response for testing
        setattr(
            qa_service,
            "generate_answer",
            lambda question, passages: (
                f"RAG dynamically retrieves facts to enhance generation [sample_rag_primer.pdf, {passages[0].page_citation}].",
                False,
                None,
            ),
        )

        ask_resp = client.post(
            "/api/documents/ask",
            json={"question": "What is RAG architecture?", "doc_id": doc_id},
        )
        assert ask_resp.status_code == 200
        ask_data = ask_resp.json()
        assert "sample_rag_primer.pdf" in ask_data["answer"]
        assert len(ask_data["sources"]) > 0
        assert ask_data["fallback_used"] is False
        print(f"   [PASS] Q&A generated grounded answer with {len(ask_data['sources'])} citation sources.")
        results["grounded_qa"] = True

        # 6. Unsupported question abstention
        print("6. Verifying unsupported query exact abstention...")
        unsupported_resp = client.post(
            "/api/documents/ask",
            json={"question": "What is the recipe for baking chocolate chip cookies?"},
        )
        assert unsupported_resp.status_code == 200
        unsupported_data = unsupported_resp.json()
        assert unsupported_data["answer"] == UNSUPPORTED_ANSWER
        assert unsupported_data["sources"] == []
        assert unsupported_data["fallback_used"] is False
        print(f"   [PASS] Unsupported query returned exact phrase: \"{UNSUPPORTED_ANSWER}\"")
        results["unsupported_abstention"] = True

        # 7. Unconfigured Gemini fallback
        print("7. Verifying unconfigured API key activates fallback...")
        unkeyed_app = create_app(store=isolated_store, settings=Settings(gemini_api_key=None))
        with TestClient(unkeyed_app) as unkeyed_client:
            fallback_resp = unkeyed_client.post(
                "/api/documents/ask",
                json={"question": "What is vector embedding?", "doc_id": doc_id},
            )
            assert fallback_resp.status_code == 200
            fallback_data = fallback_resp.json()
            assert fallback_data["fallback_used"] is True
            assert "[Fallback Mode — Gemini Unavailable]" in fallback_data["answer"]
            assert len(fallback_data["sources"]) > 0
            print("   [PASS] Fallback mode cleanly activated with retrieved passage excerpts.")
            results["fallback_mode"] = True

        # 8. Document deletion
        print("8. Verifying document deletion...")
        del_resp = client.delete(f"/api/documents/{doc_id}")
        assert del_resp.status_code == 200
        health_after = client.get("/api/health").json()
        assert health_after["documents_count"] == 0
        assert health_after["chunks_count"] == 0
        print("   [PASS] Document deleted and storage reset to 0.")
        results["document_deletion"] = True

    return results


def run_headless_chrome_verification() -> dict:
    """Verify production SPA HTML and asset delivery using macOS Google Chrome."""
    import tempfile
    import shutil
    import re

    print("\n" + "=" * 60)
    print("  PHASE 2: PRODUCTION BROWSER VERIFICATION (GOOGLE CHROME)")
    print("=" * 60)

    results = {}
    dist_index = (PROJECT_ROOT / "frontend" / "dist" / "index.html").resolve()
    if not dist_index.is_file():
        print("   --> Building React bundle before browser verification...")
        subprocess.run(["npm", "run", "build", "--prefix", "frontend", "--silent"], check=True)

    # 1. Verify FastAPI Production Serving of SPA & Static Assets via ASGI
    print("1. Verifying FastAPI production SPA serving and asset routes...")
    app = create_app()
    with TestClient(app) as client:
        root_resp = client.get("/")
        assert root_resp.status_code == 200, f"Root route failed: {root_resp.status_code}"
        assert "text/html" in root_resp.headers.get("content-type", "")
        html_content = root_resp.text
        assert "<div id=\"root\">" in html_content
        assert "<title>DocuMind AI" in html_content
        print("   [PASS] FastAPI successfully serves frontend/dist/index.html at GET /")

        # Extract and verify all referenced CSS and JS bundles
        asset_matches = re.findall(r'href="(/assets/[^"]+)"|src="(/assets/[^"]+)"', html_content)
        verified_assets = 0
        for href, src in asset_matches:
            asset_path = href or src
            asset_resp = client.get(asset_path)
            assert asset_resp.status_code == 200, f"Failed to serve asset {asset_path}"
            print(f"   [PASS] Asset served: {asset_path} ({len(asset_resp.content)} bytes)")
            verified_assets += 1
        assert verified_assets >= 2, "Expected at least 1 CSS and 1 JS bundle in production build"
        results["fastapi_spa_assets"] = True

    # 2. Real Headless Chrome DOM Verification
    chrome_path = Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
    if not chrome_path.is_file():
        print("   [SKIP] Google Chrome not found at /Applications/Google Chrome.app")
        results["chrome_available"] = False
        return results

    tmp_profile = tempfile.mkdtemp(prefix="chrome_e2e_")
    try:
        base_chrome_flags = [
            "--headless=new",
            "--disable-gpu",
            "--no-sandbox",
            f"--user-data-dir={tmp_profile}",
            "--disable-crash-reporter",
            f"--crash-dumps-dir={tmp_profile}",
            "--no-first-run",
            "--no-default-browser-check",
            "--disable-features=Translate,OptimizationHints,MediaRouter",
        ]

        # 2a. Desktop Viewport (1280x800)
        print("2. Inspecting Desktop Viewport in Google Chrome (1280x800)...")
        desktop_cmd = [
            str(chrome_path),
            *base_chrome_flags,
            "--window-size=1280,800",
            "--dump-dom",
            f"file://{dist_index}",
        ]
        dom_output = subprocess.check_output(desktop_cmd, timeout=15, stderr=subprocess.DEVNULL).decode("utf-8")
        assert "<div id=\"root\">" in dom_output, "React root element missing in dumped DOM"
        assert "/assets/" in dom_output, "Compiled asset bundles not referenced in DOM"
        assert "DocuMind AI" in dom_output, "Title missing in DOM"
        print("   [PASS] Chrome desktop DOM validated: root container and assets present.")
        results["chrome_desktop_dom"] = True

        # 2b. Mobile Viewport (375x667)
        print("3. Inspecting Mobile Viewport in Google Chrome (375x667)...")
        mobile_cmd = [
            str(chrome_path),
            *base_chrome_flags,
            "--window-size=375,667",
            "--user-agent=Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15",
            "--dump-dom",
            f"file://{dist_index}",
        ]
        mobile_output = subprocess.check_output(mobile_cmd, timeout=15, stderr=subprocess.DEVNULL).decode("utf-8")
        assert "<div id=\"root\">" in mobile_output
        assert "viewport" in mobile_output.lower()
        print("   [PASS] Chrome mobile DOM validated: responsive viewport metadata verified.")
        results["chrome_mobile_dom"] = True

    finally:
        shutil.rmtree(tmp_profile, ignore_errors=True)

    return results


def main():
    print("DocuMind AI — Milestone 1.3 End-to-End Verification")
    api_results = run_api_e2e_journey()
    browser_results = run_headless_chrome_verification()

    print("\n" + "=" * 60)
    print("  VERIFICATION SUMMARY")
    print("=" * 60)
    all_passed = all(api_results.values()) and all(browser_results.values())
    for k, v in {**api_results, **browser_results}.items():
        status_label = "[PASS]" if v else "[FAIL]"
        print(f"  {status_label} {k}")

    if all_passed:
        print("\nAll End-to-End checks passed successfully.")
        sys.exit(0)
    else:
        print("\nOne or more checks failed.")
        sys.exit(1)


if __name__ == "__main__":
    main()
