import React from "react";
import { Link } from "../../lib/router";
import {
  FileText,
  CheckCircle2,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  Lock,
  Cpu,
  Eye,
  Scale,
} from "lucide-react";

export const FeaturesPage: React.FC = () => {
  return (
    <div className="flex flex-col min-h-screen bg-canvas text-slateText-primary selection:bg-electric-subtle selection:text-electric">
      {/* Page Header */}
      <section className="pt-16 pb-16 md:pt-20 md:pb-20 bg-gradient-to-b from-white via-tint/30 to-canvas border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-electric-subtle border border-electric/20 text-electric text-xs font-semibold uppercase tracking-wider mb-4 font-mono">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Platform Capabilities</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-navy tracking-tight leading-tight">
            Engineered for Verifiable Document Intelligence
          </h1>
          <p className="mt-4 text-lg text-slateText-secondary leading-relaxed">
            Every feature in DocuMind AI is purposefully designed to eliminate AI hallucination,
            provide exact source provenance, and give researchers transparent insight into retrieved evidence.
          </p>
        </div>
      </section>

      {/* Main Feature Deep-Dive */}
      <section className="py-20 bg-surface border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-20">
          {/* Feature 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-6 space-y-4">
              <div className="inline-flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-electric bg-electric-subtle px-2.5 py-1 rounded">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Citation Integrity</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-navy tracking-tight">
                Exact Page-Level Folio Citations
              </h2>
              <p className="text-slateText-secondary leading-relaxed text-sm sm:text-base">
                DocuMind does not cite general documents or approximate page guesses. Through our
                deterministic text extraction and chunk-indexing pipeline, each passage retains its
                true document name and physical folio page number.
              </p>
              <ul className="space-y-2.5 text-sm text-slateText-secondary pt-2">
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-teal shrink-0 mt-0.5" />
                  <span>Clickable citation badges linking findings directly to source context.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-teal shrink-0 mt-0.5" />
                  <span>Interactive passage drawer displaying verbatim text and matching scores.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-teal shrink-0 mt-0.5" />
                  <span>Bi-directional passage highlighting for rapid claim verification.</span>
                </li>
              </ul>
            </div>
            <div className="lg:col-span-6 bg-canvas border border-border rounded-xl p-6 shadow-xs">
              <div className="bg-surface rounded-lg border border-border p-5 space-y-4 font-mono text-xs">
                <div className="flex items-center justify-between text-slateText-muted border-b border-border pb-3">
                  <span className="font-semibold text-navy">Synthesis Attribution Example</span>
                  <span className="text-[11px] text-teal bg-teal/10 px-2 py-0.5 rounded">FOLIO MATCH</span>
                </div>
                <p className="font-sans text-sm text-slateText-primary leading-relaxed">
                  "Gradient descent computes the analytical gradient with respect to model parameters:
                  <span className="ml-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-electric-subtle text-electric text-xs font-mono font-semibold border border-electric/30">
                    <FileText className="w-3 h-3" />
                    <span>deep_learning_survey.pdf, p. 14</span>
                  </span>
                  , minimizing empirical risk across all training samples."
                </p>
                <div className="bg-canvas p-3 rounded border border-border/80 text-[11px] text-slateText-secondary">
                  <span className="font-bold text-navy block mb-1">Underlying Passage Folio:</span>
                  "Equation 4.2 illustrates the stochastic formulation over mini-batches of size B..."
                </div>
              </div>
            </div>
          </div>

          {/* Feature 2 */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-6 order-2 lg:order-1 bg-canvas border border-border rounded-xl p-6 shadow-xs">
              <div className="bg-surface rounded-lg border border-border p-5 space-y-3 font-mono text-xs">
                <div className="flex items-center justify-between text-slateText-muted border-b border-border pb-2">
                  <span className="font-semibold text-navy">Negative Grounding Invariant</span>
                  <span className="text-[11px] text-coral bg-coral/10 px-2 py-0.5 rounded">STRICT FALLBACK</span>
                </div>
                <div className="bg-tint/50 p-3 rounded text-slateText-primary font-sans text-sm">
                  <div className="text-xs text-slateText-muted mb-1 font-mono">User Query:</div>
                  "What is the company's projected revenue for Q4 2030?"
                </div>
                <div className="bg-canvas p-3.5 rounded border border-coral/30 text-coral font-medium font-mono text-xs">
                  "The document does not contain this information."
                </div>
                <p className="font-sans text-[11px] text-slateText-muted">
                  DocuMind strictly enforces this exact string response whenever retrieved similarity
                  scores or document passages fail to provide unequivocal evidence.
                </p>
              </div>
            </div>
            <div className="lg:col-span-6 order-1 lg:order-2 space-y-4">
              <div className="inline-flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-teal bg-teal/10 px-2.5 py-1 rounded">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Zero Hallucination</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-navy tracking-tight">
                Strict Negative Grounding Guarantee
              </h2>
              <p className="text-slateText-secondary leading-relaxed text-sm sm:text-base">
                Standard conversational LLMs are notorious for inventing authoritative-sounding
                answers when documents are silent on a topic. DocuMind guarantees strict negative
                grounding: if the document does not contain the answer, it returns an invariant message.
              </p>
              <ul className="space-y-2.5 text-sm text-slateText-secondary pt-2">
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-teal shrink-0 mt-0.5" />
                  <span>Exact deterministic fallback contract preventing false certainty.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-teal shrink-0 mt-0.5" />
                  <span>Eliminates conversational fluff and speculative synthesis.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-teal shrink-0 mt-0.5" />
                  <span>Tested rigorously through automated negative regression suites.</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Feature 3 */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-6 space-y-4">
              <div className="inline-flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-navy bg-navy/10 px-2.5 py-1 rounded">
                <Cpu className="w-3.5 h-3.5" />
                <span>Retrieval Transparency</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-navy tracking-tight">
                TF-IDF & Cosine Similarity Engine
              </h2>
              <p className="text-slateText-secondary leading-relaxed text-sm sm:text-base">
                The current interactive prototype utilizes scikit-learn TF-IDF vectorization paired
                with cosine similarity ranking. This ensures fast, mathematically transparent retrieval
                free from opaque vector distortion.
              </p>
              <ul className="space-y-2.5 text-sm text-slateText-secondary pt-2">
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-teal shrink-0 mt-0.5" />
                  <span>Transparent similarity scores exposed to the user for every passage.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-teal shrink-0 mt-0.5" />
                  <span>Sub-second retrieval speed across multi-page research documents.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-teal shrink-0 mt-0.5" />
                  <span>Foundation for Blueprint 2.0 hybrid sparse + dense vector retrieval.</span>
                </li>
              </ul>
            </div>
            <div className="lg:col-span-6 bg-canvas border border-border rounded-xl p-6 shadow-xs">
              <div className="bg-surface rounded-lg border border-border p-5 space-y-3 font-mono text-xs">
                <div className="flex items-center justify-between text-slateText-muted border-b border-border pb-2">
                  <span className="font-semibold text-navy">Vector Space Similarity</span>
                  <span className="text-[11px] text-electric bg-electric-subtle px-2 py-0.5 rounded">COSINE METRIC</span>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-2 rounded bg-canvas border border-border">
                    <span className="text-slateText-primary font-mono text-[11px]">Passage #1 (Page 3)</span>
                    <span className="font-bold text-teal font-mono">0.842 Similarity</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded bg-canvas border border-border">
                    <span className="text-slateText-primary font-mono text-[11px]">Passage #2 (Page 7)</span>
                    <span className="font-bold text-teal font-mono">0.689 Similarity</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded bg-canvas border border-border">
                    <span className="text-slateText-primary font-mono text-[11px]">Passage #3 (Page 12)</span>
                    <span className="font-bold text-slateText-muted font-mono">0.412 Similarity</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Grid: Additional Highlights */}
      <section className="py-20 bg-canvas border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-xs font-bold uppercase tracking-wider text-electric font-mono mb-2">
              Engineering Craft
            </h2>
            <h3 className="text-3xl font-extrabold text-navy tracking-tight">
              Designed with care down to every pixel
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-xl bg-surface border border-border shadow-xs">
              <Eye className="w-6 h-6 text-electric mb-4" />
              <h4 className="font-bold text-navy text-base mb-2">Reduced-Motion Compliance</h4>
              <p className="text-xs text-slateText-secondary leading-relaxed">
                First-class respect for <code className="font-mono text-electric">prefers-reduced-motion</code>.
                Users with vestibular sensitivities experience zero jarring transforms or continuous animations.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-surface border border-border shadow-xs">
              <Lock className="w-6 h-6 text-teal mb-4" />
              <h4 className="font-bold text-navy text-base mb-2">In-Memory Session Isolation</h4>
              <p className="text-xs text-slateText-secondary leading-relaxed">
                During the demo phase, documents reside purely in volatile RAM. No unencrypted files
                are saved to disk, preserving total session privacy.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-surface border border-border shadow-xs">
              <Scale className="w-6 h-6 text-navy mb-4" />
              <h4 className="font-bold text-navy text-base mb-2">Deterministic Evaluation</h4>
              <p className="text-xs text-slateText-secondary leading-relaxed">
                Validated through an automated test suite spanning 108 unit tests, PDF ingestion
                scenarios, and end-to-end integration workflows.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-surface border-t border-border">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h3 className="text-2xl sm:text-3xl font-extrabold text-navy tracking-tight">
            Try these features on your own documents
          </h3>
          <p className="mt-3 text-slateText-secondary text-sm">
            Launch the interactive prototype now to upload a PDF and ask questions with live citations.
          </p>
          <div className="mt-6 flex justify-center">
            <Link
              href="/app"
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
