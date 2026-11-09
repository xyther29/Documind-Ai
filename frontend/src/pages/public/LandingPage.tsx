import React from "react";
import { Link } from "../../lib/router";
import { ProductPreviewMock } from "../../components/public/ProductPreviewMock";
import {
  CheckCircle2,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  Lock,
  Layers,
  Quote,
} from "lucide-react";

export const LandingPage: React.FC = () => {
  return (
    <div className="flex flex-col min-h-screen bg-canvas text-slateText-primary selection:bg-electric-subtle selection:text-electric">
      {/* Hero Section */}
      <section className="relative pt-16 pb-20 md:pt-24 md:pb-28 overflow-hidden border-b border-border bg-gradient-to-b from-white via-tint/40 to-canvas">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center text-center max-w-4xl mx-auto">
            {/* Blueprint Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-electric-subtle border border-electric/20 text-electric text-xs font-semibold uppercase tracking-wider mb-6 animate-fade-in font-mono">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Blueprint 2.0 • Active Research Preview</span>
            </div>

            {/* Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-navy leading-[1.12]">
              Your documents. <br className="hidden sm:inline" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-electric to-teal">
                Connected. Understood.
              </span>
            </h1>

            {/* Subtitle */}
            <p className="mt-6 text-lg sm:text-xl text-slateText-secondary max-w-2xl leading-relaxed">
              Transform research papers, legal briefs, and technical textbooks into structured,
              evidence-grounded understanding. Ask questions with verifiable, page-level citations.
            </p>

            {/* CTAs */}
            <div className="mt-8 flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
              <Link
                href="/app"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-lg text-sm font-bold text-white bg-electric hover:bg-electric-hover shadow-btn transition cursor-pointer"
              >
                <span>Launch Interactive Demo</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/how-it-works"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-lg text-sm font-semibold text-slateText-primary bg-surface hover:bg-tint border border-border transition cursor-pointer"
              >
                <Layers className="w-4 h-4 text-slateText-muted" />
                <span>Explore Architecture</span>
              </Link>
            </div>

            {/* Invariant Guarantees */}
            <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-medium text-slateText-secondary border-t border-border/80 pt-8 w-full max-w-3xl">
              <div className="flex items-center justify-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-teal shrink-0" />
                <span>Strict Negative Grounding</span>
              </div>
              <div className="flex items-center justify-center gap-2">
                <ShieldCheck className="w-4 h-4 text-electric shrink-0" />
                <span>Exact Page-Level Citations</span>
              </div>
              <div className="flex items-center justify-center gap-2">
                <Lock className="w-4 h-4 text-navy shrink-0" />
                <span>100% In-Memory Privacy</span>
              </div>
            </div>
          </div>

          {/* Interactive Workspace Mock Preview */}
          <div className="mt-16 sm:mt-20">
            <ProductPreviewMock />
          </div>
        </div>
      </section>

      {/* Core Value Pillars */}
      <section className="py-20 bg-surface border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-xs font-bold uppercase tracking-wider text-electric font-mono mb-2">
              Core Capabilities
            </h2>
            <h3 className="text-3xl font-extrabold text-navy tracking-tight">
              Built for rigorous research and verified evidence
            </h3>
            <p className="mt-4 text-slateText-secondary text-base leading-relaxed">
              Generic LLMs guess. DocuMind inspects actual document passages, aligns exact citations,
              and refuses to fabricate when sources do not support the query.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Pillar 1 */}
            <div className="p-8 rounded-xl bg-canvas border border-border hover:border-electric/40 transition-colors shadow-xs flex flex-col">
              <div className="w-12 h-12 rounded-lg bg-electric-subtle text-electric flex items-center justify-center mb-6">
                <Quote className="w-6 h-6" />
              </div>
              <h4 className="text-lg font-bold text-navy mb-2">
                Verifiable Page Citations
              </h4>
              <p className="text-sm text-slateText-secondary leading-relaxed flex-1">
                Every generated answer includes explicit source attribution down to the document name
                and folio page number. Click any citation to inspect the underlying passage.
              </p>
              <div className="mt-6 pt-4 border-t border-border text-xs font-mono text-electric">
                Folio projection & verification
              </div>
            </div>

            {/* Pillar 2 */}
            <div className="p-8 rounded-xl bg-canvas border border-border hover:border-electric/40 transition-colors shadow-xs flex flex-col">
              <div className="w-12 h-12 rounded-lg bg-teal/10 text-teal flex items-center justify-center mb-6">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h4 className="text-lg font-bold text-navy mb-2">
                Strict Negative Grounding
              </h4>
              <p className="text-sm text-slateText-secondary leading-relaxed flex-1">
                If your uploaded documents lack the information required to answer a question, DocuMind
                never guesses or hallucinates. It outputs the exact verified fallback guarantee.
              </p>
              <div className="mt-6 pt-4 border-t border-border text-xs font-mono text-teal">
                "The document does not contain this information."
              </div>
            </div>

            {/* Pillar 3 */}
            <div className="p-8 rounded-xl bg-canvas border border-border hover:border-electric/40 transition-colors shadow-xs flex flex-col">
              <div className="w-12 h-12 rounded-lg bg-navy/10 text-navy flex items-center justify-center mb-6">
                <Layers className="w-6 h-6" />
              </div>
              <h4 className="text-lg font-bold text-navy mb-2">
                Scoped Research Notebooks
              </h4>
              <p className="text-sm text-slateText-secondary leading-relaxed flex-1">
                Query across all ingested documents or narrow your focus to an individual PDF.
                Retain full context of your investigation within persistent, structured notebook threads.
              </p>
              <div className="mt-6 pt-4 border-t border-border text-xs font-mono text-navy">
                Document-level scoping & indexing
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3-Stage Research Workflow */}
      <section className="py-20 bg-canvas border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-xs font-bold uppercase tracking-wider text-electric font-mono mb-2">
              Workflow
            </h2>
            <h3 className="text-3xl font-extrabold text-navy tracking-tight">
              Three steps from raw PDF to trusted finding
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {/* Step 1 */}
            <div className="bg-surface p-6 rounded-xl border border-border relative">
              <div className="flex items-center gap-3 mb-4">
                <span className="w-8 h-8 rounded-full bg-navy text-white text-xs font-mono font-bold flex items-center justify-center">
                  01
                </span>
                <h4 className="font-bold text-navy text-base">Ingest & Extract</h4>
              </div>
              <p className="text-sm text-slateText-secondary leading-relaxed">
                Upload your research PDF (up to 10 MB). DocuMind extracts page-level text streams using
                deterministic parsing and partitions them into coherent retrieval passages.
              </p>
            </div>

            {/* Step 2 */}
            <div className="bg-surface p-6 rounded-xl border border-border relative">
              <div className="flex items-center gap-3 mb-4">
                <span className="w-8 h-8 rounded-full bg-electric text-white text-xs font-mono font-bold flex items-center justify-center">
                  02
                </span>
                <h4 className="font-bold text-navy text-base">Retrieve & Rank</h4>
              </div>
              <p className="text-sm text-slateText-secondary leading-relaxed">
                When you ask a question, TF-IDF vector matching surfaces the most relevant passages
                ranked by cosine similarity score, isolating only genuine signal.
              </p>
            </div>

            {/* Step 3 */}
            <div className="bg-surface p-6 rounded-xl border border-border relative">
              <div className="flex items-center gap-3 mb-4">
                <span className="w-8 h-8 rounded-full bg-teal text-white text-xs font-mono font-bold flex items-center justify-center">
                  03
                </span>
                <h4 className="font-bold text-navy text-base">Synthesize & Cite</h4>
              </div>
              <p className="text-sm text-slateText-secondary leading-relaxed">
                Gemini synthesizes a coherent answer strictly grounded in the retrieved passages,
                attributing every factual claim to its exact source and page number.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Comparison Grid: Generic LLM vs DocuMind AI */}
      <section className="py-20 bg-surface border-b border-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="text-xs font-bold uppercase tracking-wider text-electric font-mono mb-2">
              Comparison
            </h2>
            <h3 className="text-3xl font-extrabold text-navy tracking-tight">
              Why evidence grounding matters
            </h3>
          </div>

          <div className="bg-canvas border border-border rounded-xl overflow-hidden shadow-xs">
            <div className="grid grid-cols-3 bg-tint/60 border-b border-border px-6 py-4 text-xs font-bold uppercase tracking-wider text-navy font-mono">
              <div>Capability</div>
              <div className="text-slateText-muted">Generic Chatbots</div>
              <div className="text-electric">DocuMind AI</div>
            </div>

            <div className="divide-y divide-border text-sm">
              <div className="grid grid-cols-3 px-6 py-4 items-center">
                <div className="font-medium text-navy">Factual Attribution</div>
                <div className="text-slateText-muted">Broad claims, no page links</div>
                <div className="text-navy font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-teal" />
                  <span>Exact page-level citations</span>
                </div>
              </div>

              <div className="grid grid-cols-3 px-6 py-4 items-center">
                <div className="font-medium text-navy">Unknown Questions</div>
                <div className="text-slateText-muted">Hallucinates plausible falsehoods</div>
                <div className="text-navy font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-teal" />
                  <span>Strict negative fallback</span>
                </div>
              </div>

              <div className="grid grid-cols-3 px-6 py-4 items-center">
                <div className="font-medium text-navy">Evidence Inspection</div>
                <div className="text-slateText-muted">Black-box response</div>
                <div className="text-navy font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-teal" />
                  <span>Full passage & similarity viewer</span>
                </div>
              </div>

              <div className="grid grid-cols-3 px-6 py-4 items-center">
                <div className="font-medium text-navy">Data Privacy</div>
                <div className="text-slateText-muted">Trained on or stored in clouds</div>
                <div className="text-navy font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-teal" />
                  <span>Transient RAM-only execution</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Call to Action Banner */}
      <section className="py-20 bg-gradient-to-br from-navy via-navy to-navy-hover text-white relative overflow-hidden">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Ready to explore your documents with confidence?
          </h2>
          <p className="mt-4 text-slate-300 max-w-xl mx-auto text-base">
            Upload your first research PDF in the live interactive prototype. No account or API key required.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/app"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-lg text-sm font-bold text-navy bg-white hover:bg-slate-100 shadow-lg transition cursor-pointer"
            >
              <span>Launch Demo Workspace</span>
              <ArrowRight className="w-4 h-4 text-electric" />
            </Link>
            <Link
              href="/features"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-lg text-sm font-semibold text-white bg-white/10 hover:bg-white/15 border border-white/20 transition cursor-pointer"
            >
              <span>Explore Features</span>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};
