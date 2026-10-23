/**
 * DocuMind AI — Frontend Application Logic
 * Plain Vanilla JavaScript implementation.
 */

(function () {
  "use strict";

  // Application State
  const state = {
    documents: [],
    selectedDocId: null, // null means "All Documents" global scope
    isUploading: false,
    isAsking: false,
  };

  // DOM Elements
  const elements = {
    backendIndicator: document.getElementById("backend-status-indicator"),
    backendText: document.getElementById("backend-status-text"),
    docsCountText: document.getElementById("docs-count-text"),
    pdfInput: document.getElementById("pdf-input"),
    browseBtn: document.getElementById("browse-btn"),
    dropZone: document.getElementById("drop-zone"),
    uploadStatus: document.getElementById("upload-status"),
    documentList: document.getElementById("document-list"),
    activeScopeText: document.getElementById("active-scope-text"),
    resetScopeBtn: document.getElementById("reset-scope-btn"),
    alertBanner: document.getElementById("alert-banner"),
    alertText: document.getElementById("alert-text"),
    alertCloseBtn: document.getElementById("alert-close-btn"),
    chatStream: document.getElementById("chat-stream"),
    welcomeCard: document.getElementById("welcome-card"),
    askForm: document.getElementById("ask-form"),
    questionInput: document.getElementById("question-input"),
    topKSelect: document.getElementById("top-k-select"),
    askBtn: document.getElementById("ask-btn"),
    askStatus: document.getElementById("ask-status"),
  };

  // ==========================================================================
  // Helper Utilities
  // ==========================================================================

  function escapeHtml(text) {
    if (!text) return "";
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  function formatBytes(bytes) {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  }

  function showAlert(message) {
    elements.alertText.textContent = message;
    elements.alertBanner.classList.remove("hidden");
  }

  function hideAlert() {
    elements.alertBanner.classList.add("hidden");
    elements.alertText.textContent = "";
  }

  // ==========================================================================
  // Scope Management
  // ==========================================================================

  function selectDocumentScope(docId) {
    state.selectedDocId = docId;
    updateScopeDisplay();
  }

  function clearDocumentScope() {
    state.selectedDocId = null;
    updateScopeDisplay();
  }

  function updateScopeDisplay() {
    if (state.selectedDocId) {
      const doc = state.documents.find((d) => d.doc_id === state.selectedDocId);
      const name = doc ? doc.filename : "Selected Document";
      elements.activeScopeText.textContent = name;
      elements.resetScopeBtn.classList.remove("hidden");
    } else {
      const totalDocs = state.documents.length;
      elements.activeScopeText.textContent = totalDocs > 0
        ? `All Documents (${totalDocs})`
        : "All Documents";
      elements.resetScopeBtn.classList.add("hidden");
    }
    renderDocumentList();
  }

  // ==========================================================================
  // API Calls
  // ==========================================================================

  async function checkHealth() {
    try {
      const resp = await fetch("/api/health");
      if (!resp.ok) throw new Error("Health check returned status " + resp.status);
      const data = await resp.json();
      elements.backendIndicator.className = "status-dot status-online";
      elements.backendText.textContent = "Backend: Online";
      elements.docsCountText.textContent = `${data.documents_count} document${data.documents_count === 1 ? "" : "s"} in memory`;
      return true;
    } catch (err) {
      elements.backendIndicator.className = "status-dot status-offline";
      elements.backendText.textContent = "Backend: Offline";
      elements.docsCountText.textContent = "Server unreachable";
      return false;
    }
  }

  async function fetchDocuments() {
    try {
      const resp = await fetch("/api/documents");
      if (!resp.ok) throw new Error("Failed to load documents (" + resp.status + ")");
      const data = await resp.json();
      state.documents = data.documents || [];

      // If currently selected document was deleted outside our state, reset scope
      if (state.selectedDocId && !state.documents.some((d) => d.doc_id === state.selectedDocId)) {
        state.selectedDocId = null;
      }

      updateScopeDisplay();
      await checkHealth();
    } catch (err) {
      showAlert("Could not load documents: " + err.message);
    }
  }

  async function uploadFile(file) {
    if (!file) return;

    // Client-side extension validation
    const lowerName = file.name.toLowerCase();
    if (!lowerName.endsWith(".pdf")) {
      showAlert("Invalid file type: only PDF documents (.pdf) are supported.");
      return;
    }

    // Client-side 10 MB size limit validation
    const maxBytes = 10 * 1024 * 1024;
    if (file.size > maxBytes) {
      showAlert(`File exceeds maximum size of 10 MB (${formatBytes(file.size)}).`);
      return;
    }

    state.isUploading = true;
    elements.browseBtn.disabled = true;
    elements.uploadStatus.className = "status-message";
    elements.uploadStatus.textContent = "Uploading and chunking document...";

    const formData = new FormData();
    formData.append("file", file);

    try {
      const resp = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
      });

      if (!resp.ok) {
        let errorMsg = `Upload failed with status ${resp.status}`;
        try {
          const errData = await resp.json();
          if (errData && errData.detail) errorMsg = errData.detail;
        } catch (_) {}
        throw new Error(errorMsg);
      }

      const uploadedDoc = await resp.json();
      elements.uploadStatus.textContent = "Document uploaded successfully.";
      setTimeout(() => {
        elements.uploadStatus.textContent = "";
      }, 3500);

      // Select newly uploaded document
      state.selectedDocId = uploadedDoc.doc_id;
      await fetchDocuments();
    } catch (err) {
      elements.uploadStatus.className = "status-message error";
      elements.uploadStatus.textContent = "Upload failed.";
      showAlert("Upload error: " + err.message);
    } finally {
      state.isUploading = false;
      elements.browseBtn.disabled = false;
      elements.pdfInput.value = "";
    }
  }

  async function deleteDocument(docId, filename) {
    const confirmDelete = window.confirm(`Are you sure you want to delete "${filename}" from memory?`);
    if (!confirmDelete) return;

    try {
      const resp = await fetch(`/api/documents/${encodeURIComponent(docId)}`, {
        method: "DELETE",
      });

      if (!resp.ok) {
        let errorMsg = `Delete failed with status ${resp.status}`;
        try {
          const errData = await resp.json();
          if (errData && errData.detail) errorMsg = errData.detail;
        } catch (_) {}
        throw new Error(errorMsg);
      }

      if (state.selectedDocId === docId) {
        state.selectedDocId = null;
      }

      await fetchDocuments();
    } catch (err) {
      showAlert("Delete error: " + err.message);
    }
  }

  async function askQuestion(question, topK) {
    if (!question || !question.trim()) return;

    state.isAsking = true;
    elements.askBtn.disabled = true;
    elements.askStatus.textContent = "Searching document passages and synthesizing answer...";

    // Hide welcome card if present
    if (elements.welcomeCard) {
      elements.welcomeCard.classList.add("hidden");
    }

    const payload = {
      question: question.trim(),
      top_k: parseInt(topK, 10) || 4,
    };

    // Strictly send doc_id only when a specific document is chosen; omit for global scope
    if (state.selectedDocId) {
      payload.doc_id = state.selectedDocId;
    }

    // Append Question message immediately to chat stream
    const entryEl = document.createElement("div");
    entryEl.className = "qa-entry";
    entryEl.innerHTML = `
      <div class="question-block">
        <div class="block-label">Question</div>
        <div class="question-text">${escapeHtml(payload.question)}</div>
      </div>
      <div class="answer-block loading-state">
        <div class="answer-header-row">
          <span class="block-label">Answer</span>
        </div>
        <div class="answer-body">Retrieving relevant passages and synthesizing response...</div>
      </div>
    `;
    elements.chatStream.appendChild(entryEl);
    elements.chatStream.scrollTop = elements.chatStream.scrollHeight;

    try {
      const resp = await fetch("/api/documents/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        let errorMsg = `Request failed with status ${resp.status}`;
        try {
          const errData = await resp.json();
          if (errData && errData.detail) errorMsg = errData.detail;
        } catch (_) {}
        throw new Error(errorMsg);
      }

      const askData = await resp.json();
      renderAnswerEntry(entryEl, askData);
    } catch (err) {
      entryEl.querySelector(".answer-block").innerHTML = `
        <div class="answer-header-row">
          <span class="block-label">Error</span>
        </div>
        <div class="answer-body" style="color: var(--color-error-text);">
          Failed to retrieve answer: ${escapeHtml(err.message)}
        </div>
      `;
      showAlert("Question answering error: " + err.message);
    } finally {
      state.isAsking = false;
      elements.askBtn.disabled = false;
      elements.askStatus.textContent = "";
      elements.questionInput.value = "";
      elements.chatStream.scrollTop = elements.chatStream.scrollHeight;
    }
  }

  // ==========================================================================
  // Renderers
  // ==========================================================================

  function renderDocumentList() {
    const listEl = elements.documentList;
    listEl.innerHTML = "";

    if (state.documents.length === 0) {
      listEl.innerHTML = '<div class="empty-state">No documents in memory. Upload a PDF above to begin.</div>';
      return;
    }

    // 1. Permanent "All Documents" Item at top of document list
    const isAllActive = state.selectedDocId === null;
    const allDocsCard = document.createElement("div");
    allDocsCard.className = `doc-card all-docs-card${isAllActive ? " active" : ""}`;
    allDocsCard.setAttribute("role", "radio");
    allDocsCard.setAttribute("tabindex", "0");
    allDocsCard.setAttribute("aria-checked", isAllActive ? "true" : "false");
    allDocsCard.setAttribute("title", "Search across all uploaded documents");

    const totalCount = state.documents.length;
    allDocsCard.innerHTML = `
      <div class="doc-card-header">
        <span class="doc-filename">
          All Documents
          <span class="all-docs-badge">${totalCount} doc${totalCount === 1 ? "" : "s"}</span>
        </span>
      </div>
      <div class="doc-meta-row">
        <span>Search across full in-memory corpus</span>
      </div>
    `;

    allDocsCard.addEventListener("click", () => {
      clearDocumentScope();
    });

    allDocsCard.addEventListener("keydown", (evt) => {
      if (evt.key === "Enter" || evt.key === " ") {
        evt.preventDefault();
        clearDocumentScope();
      }
    });

    listEl.appendChild(allDocsCard);

    // 2. Individual Document Cards
    state.documents.forEach((doc) => {
      const card = document.createElement("div");
      const isSelected = state.selectedDocId === doc.doc_id;
      card.className = `doc-card${isSelected ? " active" : ""}`;
      card.setAttribute("role", "radio");
      card.setAttribute("tabindex", "0");
      card.setAttribute("aria-checked", isSelected ? "true" : "false");
      card.setAttribute("title", `Filter search to ${doc.filename}`);

      const pagesLabel = `${doc.page_count} page${doc.page_count === 1 ? "" : "s"}`;
      const chunksLabel = `${doc.chunk_count} chunk${doc.chunk_count === 1 ? "" : "s"}`;
      const sizeLabel = formatBytes(doc.file_size_bytes);

      card.innerHTML = `
        <div class="doc-card-header">
          <span class="doc-filename">
            <span class="pdf-tag" aria-label="PDF file">PDF</span>
            ${escapeHtml(doc.filename)}
          </span>
          <button type="button" class="doc-delete-btn" title="Delete document from memory" aria-label="Delete document">Delete</button>
        </div>
        <div class="doc-meta-row">
          <span class="meta-chip chip-pages">${pagesLabel}</span>
          <span class="meta-chip chip-chunks">${chunksLabel}</span>
          <span class="meta-chip chip-size">${sizeLabel}</span>
        </div>
      `;

      // Selection handler
      card.addEventListener("click", (evt) => {
        if (evt.target.classList.contains("doc-delete-btn")) return;
        selectDocumentScope(doc.doc_id);
      });

      card.addEventListener("keydown", (evt) => {
        if (evt.key === "Enter" || evt.key === " ") {
          if (evt.target.classList.contains("doc-delete-btn")) return;
          evt.preventDefault();
          selectDocumentScope(doc.doc_id);
        }
      });

      // Delete handler
      const deleteBtn = card.querySelector(".doc-delete-btn");
      deleteBtn.addEventListener("click", (evt) => {
        evt.stopPropagation();
        deleteDocument(doc.doc_id, doc.filename);
      });

      listEl.appendChild(card);
    });
  }

  function renderAnswerEntry(entryEl, askData) {
    const isUnsupported =
      askData.answer === "The document does not contain this information.";

    // Honest fallback disclosure:
    // Only display a mode badge when fallback was used. Normal answers simply show the clean "Answer" label.
    let badgeHtml = "";
    let reasonHtml = "";
    if (askData.fallback_used) {
      badgeHtml = `<span class="mode-badge badge-fallback">Passage-only fallback</span>`;
      if (askData.fallback_reason) {
        // Sanitize and trim fallback reason
        const cleanReason = String(askData.fallback_reason).slice(0, 200);
        reasonHtml = `<div class="fallback-reason-text">Note: ${escapeHtml(cleanReason)}</div>`;
      }
    }

    let sourcesHtml = "";
    if (askData.sources && askData.sources.length > 0) {
      const sourceItems = askData.sources
        .map((src, idx) => {
          const passageId = `passage-${Math.random().toString(36).substring(2, 9)}-${idx}`;
          const scoreText = typeof src.score === "number" ? `<span class="chip-score">Score: ${src.score.toFixed(4)}</span>` : "";

          return `
            <div class="source-item">
              <div class="source-header-row">
                <div>
                  <span class="source-citation-badge">[${escapeHtml(src.page_citation)}]</span>
                  <span class="source-filename">${escapeHtml(src.filename)}</span>
                </div>
                <div>
                  <span class="source-score">${scoreText}</span>
                  <button type="button" class="btn-toggle-passage" data-target="${passageId}" aria-expanded="false">View passage</button>
                </div>
              </div>
              <div id="${passageId}" class="source-passage-box hidden">
                ${escapeHtml(src.text)}
              </div>
            </div>
          `;
        })
        .join("");

      sourcesHtml = `
        <div class="sources-section">
          <div class="sources-title">Retrieved Sources (${askData.sources.length})</div>
          <div class="sources-list">${sourceItems}</div>
        </div>
      `;
    }

    const answerBlock = entryEl.querySelector(".answer-block");
    answerBlock.className = "answer-block";
    answerBlock.innerHTML = `
      <div class="answer-header-row">
        <span class="block-label">Answer</span>
        ${badgeHtml}
      </div>
      ${reasonHtml}
      <div class="answer-body${isUnsupported ? " unsupported-answer" : ""}">${escapeHtml(askData.answer)}</div>
      ${sourcesHtml}
    `;

    // Attach toggle listeners for citation passage previews
    answerBlock.querySelectorAll(".btn-toggle-passage").forEach((btn) => {
      btn.addEventListener("click", () => {
        const targetId = btn.getAttribute("data-target");
        const passageEl = document.getElementById(targetId);
        if (!passageEl) return;
        const isHidden = passageEl.classList.contains("hidden");
        if (isHidden) {
          passageEl.classList.remove("hidden");
          btn.textContent = "Hide passage";
          btn.setAttribute("aria-expanded", "true");
        } else {
          passageEl.classList.add("hidden");
          btn.textContent = "View passage";
          btn.setAttribute("aria-expanded", "false");
        }
      });
    });
  }

  // ==========================================================================
  // Event Bindings
  // ==========================================================================

  function bindEvents() {
    // Browse Button triggers hidden file input
    elements.browseBtn.addEventListener("click", () => {
      elements.pdfInput.click();
    });

    // File Input change
    elements.pdfInput.addEventListener("change", (evt) => {
      const file = evt.target.files && evt.target.files[0];
      if (file) uploadFile(file);
    });

    // Drag and Drop
    elements.dropZone.addEventListener("click", () => {
      elements.pdfInput.click();
    });

    elements.dropZone.addEventListener("keydown", (evt) => {
      if (evt.key === "Enter" || evt.key === " ") {
        evt.preventDefault();
        elements.pdfInput.click();
      }
    });

    elements.dropZone.addEventListener("dragover", (evt) => {
      evt.preventDefault();
      elements.dropZone.classList.add("dragover");
    });

    elements.dropZone.addEventListener("dragleave", () => {
      elements.dropZone.classList.remove("dragover");
    });

    elements.dropZone.addEventListener("drop", (evt) => {
      evt.preventDefault();
      elements.dropZone.classList.remove("dragover");
      const file = evt.dataTransfer.files && evt.dataTransfer.files[0];
      if (file) uploadFile(file);
    });

    // Reset scope button in header banner
    elements.resetScopeBtn.addEventListener("click", () => {
      clearDocumentScope();
    });

    // Alert banner close (user-dismissed only, not auto-dismissed)
    elements.alertCloseBtn.addEventListener("click", hideAlert);

    // Ask Question Form submission
    elements.askForm.addEventListener("submit", (evt) => {
      evt.preventDefault();
      const question = elements.questionInput.value;
      const topK = elements.topKSelect.value;
      askQuestion(question, topK);
    });
  }

  // ==========================================================================
  // Initialization
  // ==========================================================================

  async function init() {
    bindEvents();
    await checkHealth();
    await fetchDocuments();
  }

  // Run on DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
