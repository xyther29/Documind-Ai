/**
 * DocuMind AI — Frontend Application Logic
 * Professional, accessible Vanilla JavaScript implementation.
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

      // If currently selected document was deleted, reset scope
      if (state.selectedDocId && !state.documents.some((d) => d.doc_id === state.selectedDocId)) {
        state.selectedDocId = null;
      }

      updateScopeDisplay();
      await checkHealth();
    } catch (err) {
      showAlert("Could not load documents: " + err.message);
    }
  }

  function uploadFile(file) {
    if (!file || state.isUploading) return;

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
    elements.dropZone.setAttribute("aria-busy", "true");

    // Initial upload UI with honest progress bar
    elements.uploadStatus.className = "status-message uploading";
    elements.uploadStatus.innerHTML = `
      <div class="upload-progress-card">
        <div class="upload-progress-info">
          <span class="upload-filename" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</span>
          <span class="upload-pct" id="upload-pct-label">0%</span>
        </div>
        <div class="progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" id="upload-progress-track">
          <div class="progress-bar-fill" id="upload-progress-fill" style="width: 0%;"></div>
        </div>
        <div class="upload-phase-text" id="upload-phase-text">Uploading (${formatBytes(file.size)})...</div>
      </div>
    `;

    const formData = new FormData();
    formData.append("file", file);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/documents/upload");

    xhr.upload.addEventListener("progress", (evt) => {
      if (evt.lengthComputable && evt.total > 0) {
        const pct = Math.min(100, Math.round((evt.loaded / evt.total) * 100));
        const fillEl = document.getElementById("upload-progress-fill");
        const pctEl = document.getElementById("upload-pct-label");
        const trackEl = document.getElementById("upload-progress-track");
        const phaseEl = document.getElementById("upload-phase-text");

        if (fillEl) fillEl.style.width = pct + "%";
        if (trackEl) trackEl.setAttribute("aria-valuenow", String(pct));
        if (pctEl) pctEl.textContent = pct + "%";

        if (pct < 100) {
          if (phaseEl) phaseEl.textContent = `Uploading ${formatBytes(evt.loaded)} of ${formatBytes(evt.total)}...`;
        } else {
          // Transfer complete, now processing text and chunking on server
          if (phaseEl) phaseEl.textContent = "Upload complete. Extracting text & chunking on server...";
          if (trackEl) trackEl.classList.add("progress-indeterminate");
        }
      }
    });

    xhr.upload.addEventListener("load", () => {
      const phaseEl = document.getElementById("upload-phase-text");
      const trackEl = document.getElementById("upload-progress-track");
      if (phaseEl) phaseEl.textContent = "Upload complete. Extracting text & chunking on server...";
      if (trackEl) trackEl.classList.add("progress-indeterminate");
    });

    xhr.onreadystatechange = async function () {
      if (xhr.readyState !== XMLHttpRequest.DONE) return;

      state.isUploading = false;
      elements.browseBtn.disabled = false;
      elements.dropZone.removeAttribute("aria-busy");
      elements.pdfInput.value = "";

      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const uploadedDoc = JSON.parse(xhr.responseText);
          elements.uploadStatus.className = "status-message success";
          elements.uploadStatus.innerHTML = `
            <div class="upload-feedback-card upload-success-card">
              <span class="feedback-icon" aria-hidden="true">✓</span>
              <div class="feedback-content">
                <strong>${escapeHtml(uploadedDoc.filename)}</strong>
                <div class="feedback-sub">${uploadedDoc.page_count} page${uploadedDoc.page_count === 1 ? "" : "s"} · ${uploadedDoc.chunk_count} chunk${uploadedDoc.chunk_count === 1 ? "" : "s"} created</div>
              </div>
            </div>
          `;
          setTimeout(() => {
            if (elements.uploadStatus.classList.contains("success")) {
              elements.uploadStatus.innerHTML = "";
              elements.uploadStatus.className = "status-message";
            }
          }, 4500);

          // Select newly uploaded document
          state.selectedDocId = uploadedDoc.doc_id;
          await fetchDocuments();
        } catch (_) {
          elements.uploadStatus.className = "status-message error";
          elements.uploadStatus.textContent = "Upload succeeded but failed to parse response.";
          showAlert("Upload response parse error.");
        }
      } else {
        let errorMsg = `Upload failed with status ${xhr.status}`;
        try {
          const errData = JSON.parse(xhr.responseText);
          if (errData && errData.detail) errorMsg = errData.detail;
        } catch (_) {}
        elements.uploadStatus.className = "status-message error";
        elements.uploadStatus.innerHTML = `
          <div class="upload-feedback-card upload-error-card">
            <span class="feedback-icon" aria-hidden="true">!</span>
            <div class="feedback-content">
              <strong>Upload failed</strong>
              <div class="feedback-sub">${escapeHtml(errorMsg)}</div>
            </div>
          </div>
        `;
        showAlert("Upload error: " + errorMsg);
      }
    };

    xhr.onerror = function () {
      state.isUploading = false;
      elements.browseBtn.disabled = false;
      elements.dropZone.removeAttribute("aria-busy");
      elements.pdfInput.value = "";
      elements.uploadStatus.className = "status-message error";
      elements.uploadStatus.innerHTML = `
        <div class="upload-feedback-card upload-error-card">
          <span class="feedback-icon" aria-hidden="true">!</span>
          <div class="feedback-content">
            <strong>Network error</strong>
            <div class="feedback-sub">Server unreachable. Check backend connection.</div>
          </div>
        </div>
      `;
      showAlert("Upload failed: network error or server unreachable.");
    };

    xhr.send(formData);
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
    if (!question || !question.trim() || state.isAsking) return;

    state.isAsking = true;
    elements.askBtn.disabled = true;
    elements.questionInput.disabled = true;
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

    // Append Question message immediately to chat stream with entrance animation
    const entryEl = document.createElement("div");
    entryEl.className = "qa-entry qa-entry-animated";
    entryEl.innerHTML = `
      <div class="question-block">
        <div class="block-label">Question</div>
        <div class="question-text">${escapeHtml(payload.question)}</div>
      </div>
      <div class="answer-block loading-state">
        <div class="answer-header-row">
          <span class="block-label">Answer</span>
          <span class="searching-pulse-tag">
            <span class="pulse-dot" aria-hidden="true"></span>
            <span>Searching...</span>
          </span>
        </div>
        <div class="answer-loading-indicator">
          <div class="loading-progress-line" role="progressbar" aria-label="Synthesizing answer"></div>
          <p class="answer-loading-text">Searching document passages and synthesizing response...</p>
        </div>
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
      const answerBlock = entryEl.querySelector(".answer-block");
      answerBlock.className = "answer-block";
      answerBlock.innerHTML = `
        <div class="answer-header-row">
          <span class="block-label" style="color: var(--color-coral);">Error</span>
        </div>
        <div class="answer-body error-text" style="color: var(--color-coral); font-weight: 500;">
          Failed to retrieve answer: ${escapeHtml(err.message)}
        </div>
      `;
      showAlert("Question answering error: " + err.message);
    } finally {
      state.isAsking = false;
      elements.askBtn.disabled = false;
      elements.questionInput.disabled = false;
      elements.askStatus.textContent = "";
      elements.questionInput.value = "";
      elements.questionInput.focus();
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
          const scoreText = typeof src.score === "number" ? `<span class="chip-score" title="Cosine similarity score">Score: ${src.score.toFixed(4)}</span>` : "";

          return `
            <div class="source-item">
              <div class="source-header-row">
                <div class="source-meta-left">
                  <span class="source-citation-badge">[${escapeHtml(src.page_citation)}]</span>
                  <span class="source-filename" title="${escapeHtml(src.filename)}">${escapeHtml(src.filename)}</span>
                </div>
                <div class="source-meta-right">
                  ${scoreText}
                  <button type="button" class="btn-toggle-passage" data-target="${passageId}" aria-expanded="false">View passage</button>
                </div>
              </div>
              <div id="${passageId}" class="source-passage-box hidden">
                <div class="source-passage-content">${escapeHtml(src.text)}</div>
              </div>
            </div>
          `;
        })
        .join("");

      sourcesHtml = `
        <div class="sources-section">
          <div class="sources-title">
            <span>Retrieved Sources</span>
            <span class="sources-count-badge">${askData.sources.length}</span>
          </div>
          <div class="sources-list">${sourceItems}</div>
        </div>
      `;
    } else {
      sourcesHtml = `
        <div class="sources-section empty-sources">
          <span class="sources-empty-note">No source passages retrieved for this query.</span>
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

    // Drag and Drop with counter to prevent dragleave flickering
    let dragCounter = 0;

    elements.dropZone.addEventListener("click", () => {
      elements.pdfInput.click();
    });

    elements.dropZone.addEventListener("keydown", (evt) => {
      if (evt.key === "Enter" || evt.key === " ") {
        evt.preventDefault();
        elements.pdfInput.click();
      }
    });

    elements.dropZone.addEventListener("dragenter", (evt) => {
      evt.preventDefault();
      dragCounter++;
      elements.dropZone.classList.add("dragover");
    });

    elements.dropZone.addEventListener("dragover", (evt) => {
      evt.preventDefault();
      evt.dataTransfer.dropEffect = "copy";
      elements.dropZone.classList.add("dragover");
    });

    elements.dropZone.addEventListener("dragleave", (evt) => {
      evt.preventDefault();
      dragCounter--;
      if (dragCounter <= 0) {
        dragCounter = 0;
        elements.dropZone.classList.remove("dragover");
      }
    });

    elements.dropZone.addEventListener("drop", (evt) => {
      evt.preventDefault();
      dragCounter = 0;
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
