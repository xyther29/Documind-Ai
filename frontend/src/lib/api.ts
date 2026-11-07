import type { HealthResponse, DocumentListResponse, DocumentMeta, AskRequest, AskResponse } from "../types/api";
import { formatBytes } from "./utils";

const API_BASE = "";

export interface UploadProgress {
  loaded: number;
  total: number;
  percent: number;
  phase: "uploading" | "processing" | "success" | "error";
  message?: string;
}

export function uploadDocument(
  file: File,
  onProgress?: (progress: UploadProgress) => void
): Promise<DocumentMeta> {
  return new Promise((resolve, reject) => {
    // Client-side extension check
    const lowerName = file.name.toLowerCase();
    if (!lowerName.endsWith(".pdf")) {
      const err = new Error("Invalid file type: only PDF documents (.pdf) are supported.");
      onProgress?.({
        loaded: 0,
        total: file.size,
        percent: 0,
        phase: "error",
        message: err.message,
      });
      return reject(err);
    }

    // Client-side size check (10 MiB limit)
    const maxBytes = 10 * 1024 * 1024;
    if (file.size > maxBytes) {
      const err = new Error(
        `File exceeds maximum limit of 10 MB (${formatBytes(file.size)}).`
      );
      onProgress?.({
        loaded: 0,
        total: file.size,
        percent: 0,
        phase: "error",
        message: err.message,
      });
      return reject(err);
    }

    const formData = new FormData();
    formData.append("file", file);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE}/api/documents/upload`);

    xhr.upload.addEventListener("progress", (evt) => {
      if (evt.lengthComputable && evt.total > 0) {
        const percent = Math.min(100, Math.round((evt.loaded / evt.total) * 100));
        if (percent < 100) {
          onProgress?.({
            loaded: evt.loaded,
            total: evt.total,
            percent,
            phase: "uploading",
            message: `Uploading: ${formatBytes(evt.loaded)} of ${formatBytes(evt.total)} (${percent}%)`,
          });
        } else {
          onProgress?.({
            loaded: evt.loaded,
            total: evt.total,
            percent: 100,
            phase: "processing",
            message: "Upload complete. Extracting text & chunking on server...",
          });
        }
      }
    });

    xhr.upload.addEventListener("load", () => {
      onProgress?.({
        loaded: file.size,
        total: file.size,
        percent: 100,
        phase: "processing",
        message: "Upload complete. Extracting text & chunking on server...",
      });
    });

    xhr.onreadystatechange = () => {
      if (xhr.readyState !== XMLHttpRequest.DONE) return;

      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText) as DocumentMeta;
          onProgress?.({
            loaded: file.size,
            total: file.size,
            percent: 100,
            phase: "success",
            message: `"${data.filename}" uploaded successfully (${data.page_count} pages, ${data.chunk_count} chunks).`,
          });
          resolve(data);
        } catch (_) {
          const err = new Error("Failed to parse server upload response.");
          onProgress?.({
            loaded: file.size,
            total: file.size,
            percent: 100,
            phase: "error",
            message: err.message,
          });
          reject(err);
        }
      } else {
        let detail = `Upload failed with HTTP ${xhr.status}`;
        try {
          const errObj = JSON.parse(xhr.responseText);
          if (errObj?.detail) detail = errObj.detail;
        } catch (_) {}

        onProgress?.({
          loaded: file.size,
          total: file.size,
          percent: 100,
          phase: "error",
          message: detail,
        });
        reject(new Error(detail));
      }
    };

    xhr.onerror = () => {
      const err = new Error("Network error during document upload. Server may be unreachable.");
      onProgress?.({
        loaded: 0,
        total: file.size,
        percent: 0,
        phase: "error",
        message: err.message,
      });
      reject(err);
    };

    xhr.send(formData);
  });
}

export async function checkHealth(): Promise<HealthResponse> {
  const res = await fetch(`${API_BASE}/api/health`);
  if (!res.ok) {
    throw new Error(`Health check failed with status ${res.status}`);
  }
  return res.json();
}

export async function fetchDocuments(): Promise<DocumentListResponse> {
  const res = await fetch(`${API_BASE}/api/documents`);
  if (!res.ok) {
    throw new Error(`Failed to fetch documents: ${res.status}`);
  }
  return res.json();
}

export async function deleteDocument(docId: string): Promise<{ message: string; doc_id: string }> {
  const res = await fetch(`${API_BASE}/api/documents/${encodeURIComponent(docId)}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    let detail = `Failed to delete document: ${res.status}`;
    try {
      const errJson = await res.json();
      if (errJson?.detail) detail = errJson.detail;
    } catch (_) {}
    throw new Error(detail);
  }
  return res.json();
}

export async function askQuestion(payload: AskRequest): Promise<AskResponse> {
  const res = await fetch(`${API_BASE}/api/documents/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    let detail = `Ask request failed with status ${res.status}`;
    try {
      const errJson = await res.json();
      if (errJson?.detail) detail = errJson.detail;
    } catch (_) {}
    throw new Error(detail);
  }
  return res.json();
}
