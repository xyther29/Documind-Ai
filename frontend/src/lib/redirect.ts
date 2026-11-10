/**
 * Strict redirect validation and open-redirect defense for DocuMind AI.
 * 
 * In accordance with Phase 3.4 security requirements:
 * - Reject protocol-relative URLs (//, /\, \\, \/)
 * - Reject external schemes (https:, http:, ftp:, javascript:, data:, etc.)
 * - Reject encoded directory traversal (%2e%2e, %2f, %5c, .., etc.)
 * - Reject prefix spoofing (strict path boundary matching, not naive startsWith)
 * - Apply destination-specific query parameter allowlists
 * - Password recovery must redirect ONLY to the approved reset-password destination
 */

const APPROVED_EXACT_ROUTES = new Set([
  "/app",
  "/demo",
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
]);

const APPROVED_PREFIX_ROUTES = [
  "/app/",
  "/demo/",
];

/**
 * Validate a proposed redirect destination against strict route boundaries and security rules.
 * 
 * @param target Raw redirect string from query parameters or user input
 * @param fallback Safe default destination if target is invalid or unapproved (default: "/app")
 * @returns Sanitized, validated local URL path with safe query parameters
 */
export function validateRedirectUrl(
  target: string | null | undefined,
  fallback: string = "/app"
): string {
  if (!target || typeof target !== "string") {
    return fallback;
  }

  const trimmed = target.trim();
  if (!trimmed) {
    return fallback;
  }

  // 1. Check for protocol-relative or backslash bypasses
  if (
    trimmed.startsWith("//") ||
    trimmed.startsWith("/\\") ||
    trimmed.startsWith("\\\\") ||
    trimmed.startsWith("\\/") ||
    trimmed.startsWith("\\")
  ) {
    return fallback;
  }

  // 2. Reject if not starting with a single forward slash
  if (!trimmed.startsWith("/")) {
    return fallback;
  }

  // 3. Reject any scheme before path or query (e.g. javascript:, data:, https:)
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
    return fallback;
  }

  // 4. Decode URI sequences to inspect for encoded traversal or scheme attacks
  let decoded = trimmed;
  try {
    decoded = decodeURIComponent(trimmed);
  } catch (_) {
    return fallback;
  }

  // Re-check decoded string for scheme or protocol-relative patterns
  if (
    decoded.startsWith("//") ||
    decoded.startsWith("/\\") ||
    decoded.startsWith("\\\\") ||
    decoded.startsWith("\\/") ||
    decoded.includes(":") ||
    decoded.includes("..") ||
    decoded.includes("\0")
  ) {
    return fallback;
  }

  // 5. Split pathname from search query
  const queryIndex = trimmed.indexOf("?");
  const rawPath = queryIndex >= 0 ? trimmed.substring(0, queryIndex) : trimmed;
  const rawQuery = queryIndex >= 0 ? trimmed.substring(queryIndex + 1) : "";

  // 6. Strict route boundary validation
  const isApprovedExact = APPROVED_EXACT_ROUTES.has(rawPath);
  const isApprovedPrefix = APPROVED_PREFIX_ROUTES.some((prefix) => rawPath.startsWith(prefix));

  if (!isApprovedExact && !isApprovedPrefix) {
    return fallback;
  }

  // 7. Destination-specific query parameter allowlists
  if (!rawQuery) {
    return rawPath;
  }

  let searchParams: URLSearchParams;
  try {
    searchParams = new URLSearchParams(rawQuery);
  } catch (_) {
    return rawPath;
  }

  const cleanParams = new URLSearchParams();

  if (rawPath === "/app" || rawPath.startsWith("/app/")) {
    // Only allow doc_id (alphanumeric, dashes, underscores)
    const docId = searchParams.get("doc_id");
    if (docId && /^[a-zA-Z0-9_-]{1,64}$/.test(docId)) {
      cleanParams.set("doc_id", docId);
    }
  } else if (rawPath === "/login") {
    // Allow expired=true and sanitized redirect parameter
    if (searchParams.get("expired") === "true") {
      cleanParams.set("expired", "true");
    }
    const nestedRedirect = searchParams.get("redirect");
    if (nestedRedirect) {
      // Recursively validate nested redirect destination without allowing further nesting
      const cleanNested = validateRedirectUrl(nestedRedirect, "/app");
      // Never allow /login to redirect to /login
      if (!cleanNested.startsWith("/login")) {
        cleanParams.set("redirect", cleanNested);
      }
    }
  } else {
    // For /demo, /signup, /forgot-password, /reset-password: NO query parameters permitted
  }

  const queryString = cleanParams.toString();
  return queryString ? `${rawPath}?${queryString}` : rawPath;
}

/**
 * Validate redirect destination specifically for password recovery flows.
 * In accordance with Phase 3.4 requirements: Password recovery MUST redirect
 * only to the approved /reset-password destination without query parameters.
 */
export function validatePasswordRecoveryRedirect(
  target: string | null | undefined
): string {
  if (!target || typeof target !== "string") {
    return "/reset-password";
  }
  const validated = validateRedirectUrl(target, "/reset-password");
  if (validated === "/reset-password") {
    return "/reset-password";
  }
  return "/reset-password";
}
