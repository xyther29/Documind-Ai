import type { GuestSessionResponse } from "../types/api";

const GUEST_STORAGE_KEY = "documind_guest_session";

/**
 * Single-flight promise lock to deduplicate concurrent requests for a guest session token.
 */
let pendingGuestPromise: Promise<string> | null = null;

/**
 * Retrieve current guest session record from tab-scoped sessionStorage if present and valid.
 */
export function getStoredGuestSession(): GuestSessionResponse | null {
  if (typeof window === "undefined" || !window.sessionStorage) {
    return null;
  }
  try {
    const raw = window.sessionStorage.getItem(GUEST_STORAGE_KEY);
    if (!raw) return null;
    const session: GuestSessionResponse = JSON.parse(raw);
    if (!session || !session.guest_token || !session.expires_at) {
      return null;
    }
    // Buffer check: if within 60 seconds of expiration, consider expired
    const expiresMs = new Date(session.expires_at).getTime();
    if (expiresMs - Date.now() <= 60_000) {
      window.sessionStorage.removeItem(GUEST_STORAGE_KEY);
      return null;
    }
    return session;
  } catch (_) {
    return null;
  }
}

/**
 * Clear the tab-scoped guest session from sessionStorage.
 */
export function clearGuestSession(): void {
  if (typeof window !== "undefined" && window.sessionStorage) {
    try {
      window.sessionStorage.removeItem(GUEST_STORAGE_KEY);
    } catch (_) {}
  }
}

/**
 * Retrieve an active guest token, reusing the current tab session or requesting a fresh one.
 * Deduplicates concurrent calls via an in-flight promise lock.
 */
export async function getOrFetchGuestToken(): Promise<string> {
  const existing = getStoredGuestSession();
  if (existing) {
    return existing.guest_token;
  }

  if (pendingGuestPromise) {
    return pendingGuestPromise;
  }

  pendingGuestPromise = (async () => {
    try {
      const response = await fetch("/api/auth/guest-session", {
        method: "POST",
      });

      if (!response.ok) {
        let detail = `Failed to create guest session: HTTP ${response.status}`;
        try {
          const errJson = await response.json();
          if (errJson?.detail) detail = errJson.detail;
        } catch (_) {}
        throw new Error(detail);
      }

      const data: GuestSessionResponse = await response.json();
      if (typeof window !== "undefined" && window.sessionStorage) {
        window.sessionStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(data));
      }
      return data.guest_token;
    } finally {
      pendingGuestPromise = null;
    }
  })();

  return pendingGuestPromise;
}
