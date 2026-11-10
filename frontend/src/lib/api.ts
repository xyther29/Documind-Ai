import type {
  HealthResponse,
  DocumentListResponse,
  DocumentMeta,
  AskRequest,
  AskResponse,
} from "../types/api";
import { formatBytes } from "./utils";
import { supabase, isSupabaseConfigured } from "./supabase";
import { getOrFetchGuestToken, clearGuestSession } from "./guest";

const API_BASE = "";

export interface UploadProgress {
  loaded: number;
  total: number;
  percent: number;
  phase: "uploading" | "processing" | "success" | "error";
  message?: string;
}

interface AuthHeadersResult {
  kind: "authenticated" | "guest";
  headers: Record<string, string>;
}

/**
 * Resolves the appropriate credentials for protected API requests.
 * 
 * Strict Precedence Rules:
 * 1. If an authenticated user session exists, attach Authorization: Bearer <token>.
 *    Never attach guest credentials alongside a Bearer token.
 * 2. If no authenticated session exists, attach X-Guest-Session: <token>.
 */
async function resolveAuthHeaders(): Promise<AuthHeadersResult> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      if (accessToken) {
        return {
          kind: "authenticated",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        };
      }
    } catch (_) {
      // Fall through to guest if session retrieval fails
    }
  }

  // Fallback to guest session
  const guestToken = await getOrFetchGuestToken();
  return {
    kind: "guest",
    headers: {
      "X-Guest-Session": guestToken,
    },
  };
}

interface AuthRequestOptions extends RequestInit {
  _retryCount?: number;
}

/**
 * Authenticated fetch wrapper handling credential injection and single-retry 401 recovery.
 * Never retries on 403 quota responses.
 */
async function authFetch(endpoint: string, options: AuthRequestOptions = {}): Promise<Response> {
  const retryCount = options._retryCount || 0;
  const authInfo = await resolveAuthHeaders();

  const headers = new Headers(options.headers || {});
  for (const [k, v] of Object.entries(authInfo.headers)) {
    headers.set(k, v);
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  // Handle 401 retry at most once
  if (response.status === 401 && retryCount < 1) {
    if (authInfo.kind === "authenticated" && isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase.auth.refreshSession();
        if (!error && data.session?.access_token) {
          return authFetch(endpoint, { ...options, _retryCount: retryCount + 1 });
        }
      } catch (_) {}
    } else if (authInfo.kind === "guest") {
      clearGuestSession();
      try {
        await getOrFetchGuestToken();
        return authFetch(endpoint, { ...options, _retryCount: retryCount + 1 });
      } catch (_) {}
    }
  }

  return response;
}

/**
 * Upload document with byte-level progress reporting and authenticated header plumbing.
 */
export function uploadDocument(
  file: File,
  onProgress?: (progress: UploadProgress) => void,
  retryCount: number = 0
): Promise<DocumentMeta> {
  return new Promise(async (resolve, reject) => {
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

    let authInfo: AuthHeadersResult;
    try {
      authInfo = await resolveAuthHeaders();
    } catch (err: any) {
      return reject(new Error(`Authentication failed before upload: ${err.message}`));
    }

    const formData = new FormData();
    formData.append("file", file);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE}/api/documents/upload`);

    // Attach credentials
    for (const [k, v] of Object.entries(authInfo.headers)) {
      xhr.setRequestHeader(k, v);
    }

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

    xhr.onreadystatechange = async () => {
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
      } else if (xhr.status === 401 && retryCount < 1) {
        // Single retry for 401
        if (authInfo.kind === "authenticated" && isSupabaseConfigured && supabase) {
          try {
            const { data, error } = await supabase.auth.refreshSession();
            if (!error && data.session?.access_token) {
              return uploadDocument(file, onProgress, retryCount + 1).then(resolve).catch(reject);
            }
          } catch (_) {}
        } else if (authInfo.kind === "guest") {
          clearGuestSession();
          try {
            await getOrFetchGuestToken();
            return uploadDocument(file, onProgress, retryCount + 1).then(resolve).catch(reject);
          } catch (_) {}
        }
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
      } else {
        // Any other error (including 403 quota) is never retried
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

/**
 * Public health check endpoint.
 * In accordance with rules: remains public and NEVER triggers guest session creation.
 */
export async function checkHealth(): Promise<HealthResponse> {
  const res = await fetch(`${API_BASE}/api/health`);
  if (!res.ok) {
    throw new Error(`Health check failed with status ${res.status}`);
  }
  return res.json();
}

/**
 * Fetch documents using authenticated credentials (Bearer or Guest Session).
 */
export async function fetchDocuments(): Promise<DocumentListResponse> {
  const res = await authFetch("/api/documents");
  if (!res.ok) {
    let detail = `Failed to fetch documents: ${res.status}`;
    try {
      const errJson = await res.json();
      if (errJson?.detail) detail = errJson.detail;
    } catch (_) {}
    throw new Error(detail);
  }
  return res.json();
}

/**
 * Delete document using authenticated credentials (Bearer or Guest Session).
 */
export async function deleteDocument(docId: string): Promise<{ message: string; doc_id: string }> {
  const res = await authFetch(`/api/documents/${encodeURIComponent(docId)}`, {
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

/**
 * Ask question using authenticated credentials (Bearer or Guest Session).
 */
export async function askQuestion(payload: AskRequest): Promise<AskResponse> {
  const requestId = payload.request_id || (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : undefined);
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (requestId) {
    headers["X-Request-Id"] = requestId;
  }
  const bodyPayload = requestId && !payload.request_id ? { ...payload, request_id: requestId } : payload;
  const res = await authFetch("/api/documents/ask", {
    method: "POST",
    headers,
    body: JSON.stringify(bodyPayload),
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
