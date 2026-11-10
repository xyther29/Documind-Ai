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

export type AuthMode = "authenticated" | "guest";

interface AuthHeadersResult {
  kind: "authenticated" | "guest";
  headers: Record<string, string>;
}

/**
 * Resolves the appropriate credentials for protected API requests.
 * 
 * Strict Phase 3.4 Precedence & Boundary Rules:
 * 1. /app and /app/* routes send Bearer credentials ONLY.
 *    Invalid or expired Bearer credentials must NEVER fall back to guest credentials.
 * 2. /demo and /demo/* routes send guest credentials ONLY.
 * 3. Public marketing and auth pages do not attach document API credentials.
 * 4. Guest and authenticated session lifecycles remain completely independent.
 */
export async function resolveAuthHeaders(explicitMode?: AuthMode): Promise<AuthHeadersResult> {
  let mode = explicitMode;

  if (!mode && typeof window !== "undefined") {
    const pathname = window.location.pathname;
    if (pathname === "/app" || pathname.startsWith("/app/")) {
      mode = "authenticated";
    } else if (pathname === "/demo" || pathname.startsWith("/demo/")) {
      mode = "guest";
    }
  }

  // 1. Authenticated mode (Required for /app/*)
  if (mode === "authenticated") {
    if (!isSupabaseConfigured || !supabase) {
      throw new Error("Authentication service is not configured.");
    }
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session?.access_token) {
        throw new Error("No active authenticated session found.");
      }
      return {
        kind: "authenticated",
        headers: {
          Authorization: `Bearer ${data.session.access_token}`,
        },
      };
    } catch (err: any) {
      // Strict rule: NEVER fall back to guest session when authenticated mode is required
      throw new Error(`Authentication required: ${err.message}`);
    }
  }

  // 2. Guest mode (Required for /demo/*)
  if (mode === "guest") {
    const guestToken = await getOrFetchGuestToken();
    return {
      kind: "guest",
      headers: {
        "X-Guest-Session": guestToken,
      },
    };
  }

  // 3. Fallback for exploratory calls if neither mode matches explicitly
  if (isSupabaseConfigured && supabase) {
    try {
      const { data } = await supabase.auth.getSession();
      if (data.session?.access_token) {
        return {
          kind: "authenticated",
          headers: {
            Authorization: `Bearer ${data.session.access_token}`,
          },
        };
      }
    } catch (_) {}
  }

  throw new Error("Credentials required: must be invoked from an authenticated (/app) or guest demo (/demo) route.");
}

interface AuthRequestOptions extends Omit<RequestInit, "mode"> {
  authMode?: AuthMode;
  _retryCount?: number;
}

/**
 * Authenticated fetch wrapper handling credential injection and single-retry 401 recovery.
 * Never retries on 403 quota or 429 rate limit responses.
 * Dispatches documind:auth-unauthorized only after authenticated refresh failure.
 */
async function authFetch(endpoint: string, options: AuthRequestOptions = {}): Promise<Response> {
  const { authMode, _retryCount = 0, ...fetchInit } = options;
  const retryCount = _retryCount;
  const authInfo = await resolveAuthHeaders(authMode);

  const headers = new Headers(fetchInit.headers || {});
  for (const [k, v] of Object.entries(authInfo.headers)) {
    headers.set(k, v);
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...fetchInit,
    headers,
  });

  // Handle 401 Unauthorized: attempt single token refresh
  if (response.status === 401) {
    if (retryCount < 1) {
      if (authInfo.kind === "authenticated" && isSupabaseConfigured && supabase) {
        try {
          const { data, error } = await supabase.auth.refreshSession();
          if (!error && data.session?.access_token) {
            return authFetch(endpoint, { ...options, _retryCount: retryCount + 1 });
          }
        } catch (_) {}
        // Authenticated refresh failed: notify once
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("documind:auth-unauthorized"));
        }
        return response;
      } else if (authInfo.kind === "guest") {
        clearGuestSession();
        try {
          await getOrFetchGuestToken();
          return authFetch(endpoint, { ...options, _retryCount: retryCount + 1 });
        } catch (_) {}
        return response;
      }
    } else if (authInfo.kind === "authenticated") {
      // Already retried once and still 401
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("documind:auth-unauthorized"));
      }
    }
  }

  // 403 (Quota limit) and 429 (Rate limit) are returned directly without retrying or destroying sessions
  return response;
}

/**
 * Upload document with byte-level progress reporting and authenticated header plumbing.
 */
export function uploadDocument(
  file: File,
  onProgress?: (progress: UploadProgress) => void,
  retryCount: number = 0,
  mode?: AuthMode
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
      authInfo = await resolveAuthHeaders(mode);
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
              return uploadDocument(file, onProgress, retryCount + 1, mode).then(resolve).catch(reject);
            }
          } catch (_) {}
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("documind:auth-unauthorized"));
          }
        } else if (authInfo.kind === "guest") {
          clearGuestSession();
          try {
            await getOrFetchGuestToken();
            return uploadDocument(file, onProgress, retryCount + 1, mode).then(resolve).catch(reject);
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
        // If 401 after retry: notify
        if (xhr.status === 401 && authInfo.kind === "authenticated" && typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("documind:auth-unauthorized"));
        }
        // Any other error (including 403 quota or 429) is never retried and never destroys session
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
 * Fetch documents scoped to caller's authenticated or guest partition.
 */
export async function fetchDocuments(mode?: AuthMode): Promise<DocumentListResponse> {
  const res = await authFetch("/api/documents", { method: "GET", authMode: mode });
  if (!res.ok) {
    let detail = `Failed to fetch documents: HTTP ${res.status}`;
    try {
      const errJson = await res.json();
      if (errJson?.detail) detail = errJson.detail;
    } catch (_) {}
    throw new Error(detail);
  }
  return res.json();
}

/**
 * Delete document from caller's authenticated or guest partition.
 */
export async function deleteDocument(docId: string, mode?: AuthMode): Promise<{ message: string; doc_id: string }> {
  const res = await authFetch(`/api/documents/${docId}`, { method: "DELETE", authMode: mode });
  if (!res.ok) {
    let detail = `Failed to delete document: HTTP ${res.status}`;
    try {
      const errJson = await res.json();
      if (errJson?.detail) detail = errJson.detail;
    } catch (_) {}
    throw new Error(detail);
  }
  return res.json();
}

/**
 * Ask question using authenticated credentials or guest credentials.
 */
export async function askQuestion(payload: AskRequest, mode?: AuthMode): Promise<AskResponse> {
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
    authMode: mode,
  });
  if (!res.ok) {
    let detail = `Ask request failed with status ${res.status}`;
    try {
      const errJson = await res.json();
      if (errJson?.detail) detail = errJson.detail;
    } catch (_) {}
    const err: any = new Error(detail);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

/**
 * Retrieve public health metrics (unauthenticated).
 */
export async function checkHealth(): Promise<HealthResponse> {
  const res = await fetch(`${API_BASE}/api/health`);
  if (!res.ok) {
    throw new Error(`Health check failed with status ${res.status}`);
  }
  return res.json();
}
