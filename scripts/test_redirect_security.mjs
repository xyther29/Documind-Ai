/**
 * Unit tests for redirect validation and open-redirect security.
 * Runs via native Node.js: node scripts/test_redirect_security.mjs
 */

import assert from "node:assert/strict";
import { validateRedirectUrl, validatePasswordRecoveryRedirect } from "../frontend/src/lib/redirect.ts";

console.log("Running DocuMind AI Redirect Security Tests...");

// 1. Safe approved routes
assert.equal(validateRedirectUrl("/app"), "/app");
assert.equal(validateRedirectUrl("/demo"), "/demo");
assert.equal(validateRedirectUrl("/login"), "/login");
assert.equal(validateRedirectUrl("/signup"), "/signup");
assert.equal(validateRedirectUrl("/forgot-password"), "/forgot-password");
assert.equal(validateRedirectUrl("/reset-password"), "/reset-password");

// Subpaths on approved prefix routes
assert.equal(validateRedirectUrl("/app/settings"), "/app/settings");
assert.equal(validateRedirectUrl("/demo/explore"), "/demo/explore");

// Fallback on null, undefined, empty
assert.equal(validateRedirectUrl(null), "/app");
assert.equal(validateRedirectUrl(undefined), "/app");
assert.equal(validateRedirectUrl(""), "/app");
assert.equal(validateRedirectUrl("   "), "/app");
assert.equal(validateRedirectUrl(null, "/demo"), "/demo");

// 2. Strict path boundary tests (prevent prefix spoofing / startsWith bugs)
assert.equal(validateRedirectUrl("/app-malicious"), "/app", "Must reject /app-malicious");
assert.equal(validateRedirectUrl("/apple"), "/app", "Must reject /apple");
assert.equal(validateRedirectUrl("/app.evil.com"), "/app", "Must reject /app.evil.com");
assert.equal(validateRedirectUrl("/demoman"), "/app", "Must reject /demoman");
assert.equal(validateRedirectUrl("/demo.evil.com"), "/app", "Must reject /demo.evil.com");
assert.equal(validateRedirectUrl("/login-fake"), "/app", "Must reject /login-fake");
assert.equal(validateRedirectUrl("/signup-evil"), "/app", "Must reject /signup-evil");
assert.equal(validateRedirectUrl("/reset-password-spoof"), "/app", "Must reject /reset-password-spoof");

// 3. Protocol-relative and backslash attacks
assert.equal(validateRedirectUrl("//evil.com"), "/app", "Must reject //evil.com");
assert.equal(validateRedirectUrl("//evil.com/app"), "/app", "Must reject //evil.com/app");
assert.equal(validateRedirectUrl("/\\evil.com"), "/app", "Must reject /\\evil.com");
assert.equal(validateRedirectUrl("\\\\evil.com"), "/app", "Must reject \\\\evil.com");
assert.equal(validateRedirectUrl("\\/evil.com"), "/app", "Must reject \\/evil.com");
assert.equal(validateRedirectUrl("\\evil.com"), "/app", "Must reject \\evil.com");

// 4. Scheme attacks
assert.equal(validateRedirectUrl("https://evil.com"), "/app", "Must reject https scheme");
assert.equal(validateRedirectUrl("http://evil.com"), "/app", "Must reject http scheme");
assert.equal(validateRedirectUrl("javascript:alert(1)"), "/app", "Must reject javascript scheme");
assert.equal(validateRedirectUrl("data:text/html,<script>alert(1)</script>"), "/app", "Must reject data scheme");
assert.equal(validateRedirectUrl("vbscript:msgbox"), "/app", "Must reject vbscript scheme");

// 5. Encoded traversal and scheme attacks
assert.equal(validateRedirectUrl("/%2e%2e/evil"), "/app", "Must reject encoded traversal");
assert.equal(validateRedirectUrl("/app/.."), "/app", "Must reject dot dot traversal");
assert.equal(validateRedirectUrl("/app/../evil"), "/app", "Must reject directory traversal");
assert.equal(validateRedirectUrl("/%2f%2fevil.com"), "/app", "Must reject encoded slashes");

// 6. Destination-specific query parameter allowlists
// /app allows only doc_id
assert.equal(validateRedirectUrl("/app?doc_id=valid-doc-123"), "/app?doc_id=valid-doc-123");
assert.equal(validateRedirectUrl("/app?doc_id=valid-doc-123&evil=true"), "/app?doc_id=valid-doc-123");
assert.equal(validateRedirectUrl("/app?evil=true"), "/app");

// /login allows expired=true and sanitized redirect
assert.equal(validateRedirectUrl("/login?expired=true"), "/login?expired=true");
assert.equal(validateRedirectUrl("/login?expired=false"), "/login");
assert.equal(validateRedirectUrl("/login?redirect=%2Fapp"), "/login?redirect=%2Fapp");
assert.equal(validateRedirectUrl("/login?redirect=https%3A%2F%2Fevil.com"), "/app", "Reject malicious external URL redirect");
assert.equal(validateRedirectUrl("/login?redirect=%2Flogin"), "/login"); // No recursive /login redirect

// Other routes permit NO query parameters
assert.equal(validateRedirectUrl("/demo?token=leak"), "/demo");
assert.equal(validateRedirectUrl("/signup?ref=promo"), "/signup");
assert.equal(validateRedirectUrl("/reset-password?admin=true"), "/reset-password");

// 7. Password recovery redirect restrictions
assert.equal(validatePasswordRecoveryRedirect("/reset-password"), "/reset-password");
assert.equal(validatePasswordRecoveryRedirect("/app"), "/reset-password", "Password recovery must redirect only to /reset-password");
assert.equal(validatePasswordRecoveryRedirect("https://evil.com"), "/reset-password");
assert.equal(validatePasswordRecoveryRedirect(null), "/reset-password");
assert.equal(validatePasswordRecoveryRedirect("/reset-password?token=leak"), "/reset-password");

console.log("All 35 redirect security assertions passed successfully!");
