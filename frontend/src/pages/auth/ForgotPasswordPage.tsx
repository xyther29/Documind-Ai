import React, { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { Link } from "../../lib/router";
import { KeyRound, Loader2, AlertCircle, ArrowLeft, Mail, CheckCircle2, Sparkles } from "lucide-react";

export const ForgotPasswordPage: React.FC = () => {
  const { resetPasswordForEmail, isConfigured } = useAuth();

  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setErrorMessage("Please enter your email address.");
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await resetPasswordForEmail(cleanEmail);
      if (error) {
        setErrorMessage(error.message);
      } else {
        setSent(true);
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to send reset email. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (sent) {
    return (
      <div className="flex flex-col min-h-screen bg-canvas text-slateText-primary justify-center items-center py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full bg-surface border border-border rounded-2xl p-8 shadow-sm space-y-6 text-center">
          <div className="w-14 h-14 rounded-2xl bg-teal/10 text-teal mx-auto flex items-center justify-center">
            <Mail className="w-7 h-7" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-extrabold text-navy tracking-tight">
              Reset Instructions Sent
            </h1>
            <p className="text-sm text-slateText-secondary leading-relaxed">
              If an account exists for{" "}
              <strong className="text-slateText-primary font-semibold">{email}</strong>, we&apos;ve
              emailed password reset instructions.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-canvas border border-border text-left space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-bold text-teal font-mono uppercase tracking-wider">
              <CheckCircle2 className="w-4 h-4" />
              <span>Next Steps</span>
            </div>
            <p className="text-xs text-slateText-secondary leading-relaxed">
              Click the link in the email to securely choose a new password for your DocuMind account.
            </p>
          </div>

          <div className="pt-2">
            <Link
              href="/login"
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold text-white bg-electric hover:bg-electric-hover shadow-btn transition"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Return to Sign In</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-canvas text-slateText-primary selection:bg-electric-subtle selection:text-electric justify-center items-center py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full bg-surface border border-border rounded-2xl p-8 shadow-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-xl bg-electric-subtle text-electric mx-auto flex items-center justify-center">
            <KeyRound className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-extrabold text-navy tracking-tight">
            Reset Your Password
          </h1>
          <p className="text-xs text-slateText-secondary">
            Enter your email address and we&apos;ll send you instructions to reset your password.
          </p>
        </div>

        {/* Unconfigured Notice */}
        {!isConfigured && (
          <div className="p-4 rounded-xl bg-tint border border-border text-left space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-navy">
              <Sparkles className="w-3.5 h-3.5 text-electric" />
              <span>Auth Service Offline</span>
            </div>
            <p className="text-xs text-slateText-secondary leading-relaxed">
              Supabase environment variables are unconfigured. Password reset requires an active
              Supabase configuration.
            </p>
          </div>
        )}

        {/* Error Alert */}
        {errorMessage && (
          <div
            className="p-3.5 rounded-xl bg-coral/10 border border-coral/20 text-coral text-xs flex items-start gap-2.5"
            role="alert"
            aria-live="polite"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <label
              htmlFor="forgot-email"
              className="block text-xs font-semibold text-slateText-primary uppercase tracking-wider"
            >
              Email Address
            </label>
            <input
              id="forgot-email"
              type="email"
              autoComplete="email"
              required
              disabled={submitting || !isConfigured}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-canvas text-sm text-slateText-primary placeholder:text-slateText-muted focus:outline-none focus:ring-2 focus:ring-electric focus:border-transparent transition disabled:opacity-60 disabled:cursor-not-allowed"
              placeholder="researcher@example.com"
            />
          </div>

          <button
            type="submit"
            disabled={submitting || !isConfigured}
            className="w-full mt-2 inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold text-white bg-electric hover:bg-electric-hover shadow-btn transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Sending Instructions...</span>
              </>
            ) : (
              <span>Send Reset Link</span>
            )}
          </button>
        </form>

        <div className="pt-4 border-t border-border text-center">
          <Link
            href="/login"
            className="text-xs font-semibold text-slateText-secondary hover:text-navy inline-flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Sign In</span>
          </Link>
        </div>
      </div>
    </div>
  );
};
