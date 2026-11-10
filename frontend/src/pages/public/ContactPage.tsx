import React, { useState } from "react";
import { Link } from "../../lib/router";
import {
  Mail,
  Bug,
  ExternalLink,
  Send,
  CheckCircle2,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { GithubIcon } from "../../components/public/icons";

export const ContactPage: React.FC = () => {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const mailtoUrl = `mailto:hritikmaurya24@gmail.com?subject=${encodeURIComponent(
      subject || "DocuMind AI Inquiry"
    )}&body=${encodeURIComponent(message)}`;
    window.location.href = mailtoUrl;
    setSubmitted(true);
  };

  return (
    <div className="flex flex-col min-h-screen bg-canvas text-slateText-primary selection:bg-electric-subtle selection:text-electric">
      {/* Header */}
      <section className="pt-16 pb-16 md:pt-20 md:pb-20 bg-gradient-to-b from-white via-tint/30 to-canvas border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-electric-subtle border border-electric/20 text-electric text-xs font-semibold uppercase tracking-wider mb-4 font-mono">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Community & Feedback</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-navy tracking-tight leading-tight">
            Connect with the DocuMind Team
          </h1>
          <p className="mt-4 text-lg text-slateText-secondary leading-relaxed">
            Have questions regarding our RAG architecture, encountered an edge-case PDF document,
            or interested in contributing to our open research roadmap? We'd love to hear from you.
          </p>
        </div>
      </section>

      {/* Contact Channels Grid */}
      <section className="py-20 bg-surface border-b border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
            {/* Direct Email */}
            <div className="p-6 rounded-xl bg-canvas border border-border shadow-xs flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-lg bg-electric-subtle text-electric flex items-center justify-center mb-4">
                  <Mail className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-navy text-lg mb-2">Maintainer Email</h3>
                <p className="text-xs text-slateText-secondary leading-relaxed mb-4">
                  Send research inquiries, architecture critiques, or collaboration proposals directly to the creator.
                </p>
              </div>
              <a
                href="mailto:hritikmaurya24@gmail.com"
                className="text-xs font-bold text-electric hover:underline inline-flex items-center gap-1 font-mono break-all"
              >
                <span>hritikmaurya24@gmail.com</span>
                <ExternalLink className="w-3 h-3 shrink-0" />
              </a>
            </div>

            {/* GitHub Issues */}
            <div className="p-6 rounded-xl bg-canvas border border-border shadow-xs flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-lg bg-teal/10 text-teal flex items-center justify-center mb-4">
                  <Bug className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-navy text-lg mb-2">Bug Reports & Issues</h3>
                <p className="text-xs text-slateText-secondary leading-relaxed mb-4">
                  Report parsing glitches, unexpected citation tokens, or frontend rendering defects on GitHub.
                </p>
              </div>
              <a
                href="https://github.com/xyther29/Documind-AI/issues"
                target="_blank"
                rel="noreferrer"
                className="text-xs font-bold text-teal hover:underline inline-flex items-center gap-1 font-mono"
              >
                <span>Open an Issue</span>
                <ExternalLink className="w-3 h-3 shrink-0" />
              </a>
            </div>

            {/* GitHub Repo */}
            <div className="p-6 rounded-xl bg-canvas border border-border shadow-xs flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-lg bg-navy/10 text-navy flex items-center justify-center mb-4">
                  <GithubIcon className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-navy text-lg mb-2">Open Source Project</h3>
                <p className="text-xs text-slateText-secondary leading-relaxed mb-4">
                  Inspect the complete codebase, review milestone pull requests, and star the repository.
                </p>
              </div>
              <a
                href="https://github.com/xyther29/Documind-AI"
                target="_blank"
                rel="noreferrer"
                className="text-xs font-bold text-navy hover:underline inline-flex items-center gap-1 font-mono"
              >
                <span>xyther29/Documind-AI</span>
                <ExternalLink className="w-3 h-3 shrink-0" />
              </a>
            </div>
          </div>

          {/* Direct Dispatch Form */}
          <div className="max-w-2xl mx-auto bg-canvas border border-border rounded-2xl p-8 shadow-xs">
            <h3 className="text-xl font-bold text-navy mb-2">Compose an Inquiry</h3>
            <p className="text-xs text-slateText-secondary mb-6">
              Submitting this form prepares a pre-filled email draft to the maintainer in your default email client.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="subject" className="block text-xs font-bold text-navy mb-1.5">
                  Subject or Topic
                </label>
                <input
                  id="subject"
                  type="text"
                  required
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. Question regarding TF-IDF vs Dense Vector Retrieval"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-surface text-sm text-slateText-primary focus:outline-electric focus:ring-1 focus:ring-electric"
                />
              </div>

              <div>
                <label htmlFor="message" className="block text-xs font-bold text-navy mb-1.5">
                  Message Details
                </label>
                <textarea
                  id="message"
                  required
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Describe your feedback, test scenario, or technical question..."
                  className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-surface text-sm text-slateText-primary focus:outline-electric focus:ring-1 focus:ring-electric"
                />
              </div>

              <button
                type="submit"
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg text-sm font-bold text-white bg-electric hover:bg-electric-hover shadow-btn transition cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>Launch Email Client</span>
              </button>

              {submitted && (
                <div className="p-3 rounded-lg bg-teal/10 border border-teal/20 text-teal text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Draft opened in your email client. Thank you for reaching out!</span>
                </div>
              )}
            </form>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-surface">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h3 className="text-2xl font-bold text-navy tracking-tight">
            Prefer to test the system directly?
          </h3>
          <p className="mt-2 text-slateText-secondary text-sm">
            You can test the interactive prototype immediately without any account or API key.
          </p>
          <div className="mt-6 flex justify-center">
            <Link
              href="/demo"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-bold text-white bg-electric hover:bg-electric-hover shadow-btn transition cursor-pointer"
            >
              <span>Launch Interactive Demo</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};
