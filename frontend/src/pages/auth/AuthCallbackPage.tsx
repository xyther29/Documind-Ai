import React, { useEffect, useState, useRef } from "react";
import { supabase, isSupabaseConfigured } from "../../lib/supabase";
import { useRouter, validateRedirectUrl, validatePasswordRecoveryRedirect, Link } from "../../lib/router";
import { Loader2, AlertCircle, ArrowLeft, CheckCircle2 } from "lucide-react";

export const AuthCallbackPage: React.FC = () => {
  const { navigate } = useRouter();
  const [status, setStatus] = useState<"loading" | "error" | "success">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Authoritative single-flight guard: ensures exchangeCodeForSession is called exactly once
  const hasExchanged = useRef<boolean>(false);

  useEffect(() => {
    if (hasExchanged.current) {
      return;
    }
    hasExchanged.current = true;

    if (!isSupabaseConfigured || !supabase) {
      setStatus("error");
      setErrorMessage("Authentication service is not configured in this environment.");
      return;
    }

    const searchParams = new URLSearchParams(window.location.search);
    const code = searchParams.get("code");
    const errorParam = searchParams.get("error");
    const errorDesc = searchParams.get("error_description");
    const nextParam = searchParams.get("next");

    // 1. Check for errors in the incoming URL
    if (errorParam || errorDesc) {
      setStatus("error");
      setErrorMessage(
        errorDesc || "The verification link is invalid, expired, or has already been used."
      );
      return;
    }

    // 2. Perform authoritative PKCE code exchange
    if (code) {
      supabase.auth
        .exchangeCodeForSession(code)
        .then(({ error }) => {
          if (error) {
            setStatus("error");
            setErrorMessage(error.message || "Failed to exchange verification code.");
            return;
          }

          setStatus("success");

          // Determine safe destination
          let destination = "/app";
          if (nextParam === "/reset-password") {
            // Password recovery must redirect strictly to /reset-password
            destination = validatePasswordRecoveryRedirect(nextParam);
          } else if (nextParam) {
            destination = validateRedirectUrl(nextParam, "/app");
          }

          // Navigate cleanly to validated target
          navigate(destination);
        })
        .catch((err: any) => {
          setStatus("error");
          setErrorMessage(err?.message || "An unexpected error occurred during verification.");
        });
      return;
    }

    // 3. If no code in query params, inspect existing session or hash
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (session) {
          setStatus("success");
          const destination = nextParam ? validateRedirectUrl(nextParam, "/app") : "/app";
          navigate(destination);
        } else {
          setStatus("error");
          setErrorMessage("No verification code was provided in the callback URL.");
        }
      })
      .catch(() => {
        setStatus("error");
        setErrorMessage("Unable to verify authentication session.");
      });
  }, [navigate]);

  if (status === "error") {
    return (
      <div className="flex flex-col min-h-screen bg-canvas text-slateText-primary justify-center items-center py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full bg-surface border border-border rounded-2xl p-8 shadow-sm space-y-6 text-center">
          <div className="w-12 h-12 rounded-xl bg-coral/10 text-coral mx-auto flex items-center justify-center">
            <AlertCircle className="w-6 h-6" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-extrabold text-navy tracking-tight">
              Verification Link Error
            </h1>
            <p className="text-sm text-slateText-secondary leading-relaxed">
              {errorMessage || "The authentication link is invalid or has expired."}
            </p>
          </div>

          <div className="pt-2">
            <Link
              href="/login"
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold text-white bg-electric hover:bg-electric-hover shadow-btn transition cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Return to Sign In</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="flex flex-col min-h-screen bg-canvas text-slateText-primary justify-center items-center py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full bg-surface border border-border rounded-2xl p-8 shadow-sm space-y-4 text-center">
          <div className="w-12 h-12 rounded-xl bg-teal/10 text-teal mx-auto flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-navy">Authentication Verified</h1>
          <p className="text-xs text-slateText-secondary">Redirecting to your research vault...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center bg-canvas text-slateText-primary"
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-8 h-8 text-electric animate-spin" aria-hidden="true" />
        <span className="text-sm font-medium text-slateText-secondary">
          Completing authentication verification...
        </span>
      </div>
    </div>
  );
};
