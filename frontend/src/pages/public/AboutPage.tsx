import React from "react";
import { Link } from "../../lib/router";
import {
  Mail,
  ExternalLink,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { GithubIcon } from "../../components/public/icons";

export const AboutPage: React.FC = () => {
  return (
    <div className="flex flex-col min-h-screen bg-canvas text-slateText-primary selection:bg-electric-subtle selection:text-electric">
      {/* Header */}
      <section className="pt-16 pb-16 md:pt-20 md:pb-20 bg-gradient-to-b from-white via-tint/30 to-canvas border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-electric-subtle border border-electric/20 text-electric text-xs font-semibold uppercase tracking-wider mb-4 font-mono">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Mission & Manifesto</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-navy tracking-tight leading-tight">
            Our Mission: Transforming Documents into Grounded Knowledge
          </h1>
          <p className="mt-4 text-lg text-slateText-secondary leading-relaxed">
            DocuMind AI was founded on a simple conviction: conversational AI is only as useful
            as it is trustworthy. When dealing with research, legal briefs, and technical specifications,
            plausible fiction is dangerous.
          </p>
        </div>
      </section>

      {/* The DocuMind Manifesto */}
      <section className="py-20 bg-surface border-b border-border">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="text-xs font-bold uppercase tracking-wider text-electric font-mono mb-2">
              Our Principles
            </h2>
            <h3 className="text-3xl font-extrabold text-navy tracking-tight">
              The Engineering Manifesto
            </h3>
          </div>

          <div className="space-y-6">
            <div className="p-6 rounded-xl bg-canvas border border-border">
              <h4 className="text-lg font-bold text-navy flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-electric text-white text-xs flex items-center justify-center font-mono">1</span>
                <span>Truth Above Fluency</span>
              </h4>
              <p className="mt-2 text-sm text-slateText-secondary leading-relaxed">
                A system that admits "The document does not contain this information" is infinitely more
                valuable to a researcher than one that invents a eloquent, fictional paragraph. We reject
                hallucinatory smoothing.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-canvas border border-border">
              <h4 className="text-lg font-bold text-navy flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-teal text-white text-xs flex items-center justify-center font-mono">2</span>
                <span>Provenance is Mandatory</span>
              </h4>
              <p className="mt-2 text-sm text-slateText-secondary leading-relaxed">
                An answer without an exact source folio is merely a rumor. Every factual claim generated
                by DocuMind must be anchored to its underlying document filename and page number.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-canvas border border-border">
              <h4 className="text-lg font-bold text-navy flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-navy text-white text-xs flex items-center justify-center font-mono">3</span>
                <span>Radical Observability</span>
              </h4>
              <p className="mt-2 text-sm text-slateText-secondary leading-relaxed">
                We believe in white-box engineering. Retrieval similarity scores, passage chunks, and
                elapsed request times must never be faked or obscured. If a pipeline takes 4.2 seconds,
                we display 4.2 seconds—never artificial step animations.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-canvas border border-border">
              <h4 className="text-lg font-bold text-navy flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-slate-700 text-white text-xs flex items-center justify-center font-mono">4</span>
                <span>Privacy by Architecture</span>
              </h4>
              <p className="mt-2 text-sm text-slateText-secondary leading-relaxed">
                In the current demonstration baseline, documents exist exclusively in volatile memory and
                are purged on server restart. In future cloud versions, multi-tenant data will be strictly
                isolated with cryptographic user authentication and Row Level Security.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Project & Creator Profile */}
      <section className="py-20 bg-canvas border-b border-border">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-surface rounded-2xl border border-border p-8 sm:p-10 shadow-xs">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 pb-6 border-b border-border">
              <div>
                <h3 className="text-2xl font-extrabold text-navy">About the Project & Creator</h3>
                <p className="text-sm text-slateText-secondary mt-1">
                  Built and maintained with a relentless focus on software engineering craft.
                </p>
              </div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded bg-tint text-xs font-mono text-navy border border-border">
                <span>Milestone 2.1 Release</span>
              </div>
            </div>

            <div className="pt-6 space-y-4 text-sm text-slateText-secondary leading-relaxed">
              <p>
                DocuMind AI was conceived and engineered by <strong>Hritik Maurya</strong> (<code className="text-xs font-mono text-electric">xyther29</code>)
                as a high-rigor exploration into Retrieval-Augmented Generation (RAG) and document understanding.
              </p>
              <p>
                Built using Python 3.12, FastAPI, pypdf, scikit-learn, React 19, and Tailwind CSS, the platform
                balances backend determinism with responsive, accessible frontend craft.
              </p>

              <div className="pt-4 flex flex-wrap items-center gap-4 text-xs font-medium">
                <a
                  href="https://github.com/xyther29/Documind-AI"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-canvas hover:bg-tint border border-border text-navy transition"
                >
                  <GithubIcon className="w-4 h-4" />
                  <span>github.com/xyther29/Documind-AI</span>
                  <ExternalLink className="w-3 h-3 opacity-60" />
                </a>

                <a
                  href="mailto:hritikmaurya24@gmail.com"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-canvas hover:bg-tint border border-border text-navy transition"
                >
                  <Mail className="w-4 h-4 text-electric" />
                  <span>hritikmaurya24@gmail.com</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-surface">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h3 className="text-2xl font-bold text-navy tracking-tight">
            Explore the live prototype
          </h3>
          <p className="mt-2 text-slateText-secondary text-sm">
            Experience our grounded document synthesis workflow right now.
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
