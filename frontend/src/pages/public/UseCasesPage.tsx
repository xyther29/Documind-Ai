import React from "react";
import { Link } from "../../lib/router";
import {
  GraduationCap,
  Scale,
  Code2,
  CheckCircle2,
  ArrowRight,
  Sparkles,
} from "lucide-react";

export const UseCasesPage: React.FC = () => {
  return (
    <div className="flex flex-col min-h-screen bg-canvas text-slateText-primary selection:bg-electric-subtle selection:text-electric">
      {/* Header */}
      <section className="pt-16 pb-16 md:pt-20 md:pb-20 bg-gradient-to-b from-white via-tint/30 to-canvas border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-electric-subtle border border-electric/20 text-electric text-xs font-semibold uppercase tracking-wider mb-4 font-mono">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Research Workflows</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-navy tracking-tight leading-tight">
            Built for Demanding Research Scenarios
          </h1>
          <p className="mt-4 text-lg text-slateText-secondary leading-relaxed">
            When accuracy, transparency, and page-level provenance are non-negotiable,
            professionals rely on DocuMind AI.
          </p>
        </div>
      </section>

      {/* Persona Deep-Dives */}
      <section className="py-20 bg-surface border-b border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
          {/* Persona 1: Academic Researchers */}
          <div className="p-8 sm:p-10 rounded-2xl bg-canvas border border-border shadow-xs">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-8 space-y-4">
                <div className="w-12 h-12 rounded-xl bg-electric-subtle text-electric flex items-center justify-center">
                  <GraduationCap className="w-6 h-6" />
                </div>
                <h2 className="text-2xl font-extrabold text-navy tracking-tight">
                  Academic Researchers & Literature Reviews
                </h2>
                <p className="text-sm sm:text-base text-slateText-secondary leading-relaxed">
                  Synthesizing findings across dozens of academic preprints requires flawless attribution.
                  Researchers cannot afford AI tools that invent methodology claims or misattribute citations.
                </p>
                <div className="space-y-2 pt-2 text-xs sm:text-sm text-slateText-secondary">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-teal shrink-0 mt-0.5" />
                    <span><strong>Direct Folio Citations:</strong> Every assertion links directly to its source paper and page number.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-teal shrink-0 mt-0.5" />
                    <span><strong>Rapid Fact-Checking:</strong> Compare experimental results and baseline datasets side-by-side.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-teal shrink-0 mt-0.5" />
                    <span><strong>Verbatim Passage Verification:</strong> Read underlying quotes without flipping back and forth.</span>
                  </div>
                </div>
              </div>
              <div className="lg:col-span-4 bg-surface p-5 rounded-xl border border-border text-xs space-y-3 font-mono">
                <div className="text-slateText-muted border-b border-border pb-2 font-bold text-navy">
                  Sample Researcher Query
                </div>
                <div className="text-slateText-primary bg-tint/60 p-2.5 rounded font-sans">
                  "What dataset split did the authors use in the ablation study?"
                </div>
                <div className="text-electric font-semibold">
                  Found on page 9 of transformer_eval.pdf (similarity: 0.812)
                </div>
              </div>
            </div>
          </div>

          {/* Persona 2: Legal & Regulatory */}
          <div className="p-8 sm:p-10 rounded-2xl bg-canvas border border-border shadow-xs">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-8 space-y-4">
                <div className="w-12 h-12 rounded-xl bg-teal/10 text-teal flex items-center justify-center">
                  <Scale className="w-6 h-6" />
                </div>
                <h2 className="text-2xl font-extrabold text-navy tracking-tight">
                  Legal, Regulatory & Compliance Audits
                </h2>
                <p className="text-sm sm:text-base text-slateText-secondary leading-relaxed">
                  Legal teams reviewing contracts, policy disclosures, and regulatory frameworks require
                  zero hallucination tolerance. A fabricated indemnification clause or nonexistent term
                  creates massive liabilities.
                </p>
                <div className="space-y-2 pt-2 text-xs sm:text-sm text-slateText-secondary">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-teal shrink-0 mt-0.5" />
                    <span><strong>Guaranteed Negative Fallback:</strong> If a clause doesn't exist, DocuMind explicitly refuses to guess.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-teal shrink-0 mt-0.5" />
                    <span><strong>Scope Isolation:</strong> Restrict queries to a single agreement or scan an entire compliance folder.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-teal shrink-0 mt-0.5" />
                    <span><strong>Transient Execution:</strong> Confidential documents are processed entirely in memory.</span>
                  </div>
                </div>
              </div>
              <div className="lg:col-span-4 bg-surface p-5 rounded-xl border border-border text-xs space-y-3 font-mono">
                <div className="text-slateText-muted border-b border-border pb-2 font-bold text-navy">
                  Sample Compliance Query
                </div>
                <div className="text-slateText-primary bg-tint/60 p-2.5 rounded font-sans">
                  "Does the vendor agreement include a liquidated damages clause?"
                </div>
                <div className="text-coral font-semibold">
                  "The document does not contain this information."
                </div>
              </div>
            </div>
          </div>

          {/* Persona 3: Technical Engineering */}
          <div className="p-8 sm:p-10 rounded-2xl bg-canvas border border-border shadow-xs">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-8 space-y-4">
                <div className="w-12 h-12 rounded-xl bg-navy/10 text-navy flex items-center justify-center">
                  <Code2 className="w-6 h-6" />
                </div>
                <h2 className="text-2xl font-extrabold text-navy tracking-tight">
                  Engineering Specifications & Whitepapers
                </h2>
                <p className="text-sm sm:text-base text-slateText-secondary leading-relaxed">
                  Engineers working with 300-page API specifications, protocol RFCs, and hardware datasheets
                  need rapid, pin-point parameter lookups without wading through repetitive tables of contents.
                </p>
                <div className="space-y-2 pt-2 text-xs sm:text-sm text-slateText-secondary">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-teal shrink-0 mt-0.5" />
                    <span><strong>Mathematical Vector Ranking:</strong> Surface exact registers, memory bounds, and protocol parameters.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-teal shrink-0 mt-0.5" />
                    <span><strong>Sub-Second Retrieval:</strong> Instant answers across multi-megabyte specification manuals.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-teal shrink-0 mt-0.5" />
                    <span><strong>Full Text Verification:</strong> Confirm exact code examples before committing firmware designs.</span>
                  </div>
                </div>
              </div>
              <div className="lg:col-span-4 bg-surface p-5 rounded-xl border border-border text-xs space-y-3 font-mono">
                <div className="text-slateText-muted border-b border-border pb-2 font-bold text-navy">
                  Sample Hardware Query
                </div>
                <div className="text-slateText-primary bg-tint/60 p-2.5 rounded font-sans">
                  "What is the maximum clock frequency for SPI peripheral bus 2?"
                </div>
                <div className="text-electric font-semibold">
                  Found on page 142 of mcu_reference.pdf: "Clock limit 80 MHz"
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-surface">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h3 className="text-2xl font-bold text-navy tracking-tight">
            Start using DocuMind for your research workflow
          </h3>
          <p className="mt-2 text-slateText-secondary text-sm">
            Upload your PDF and experience verifiable, grounded document intelligence.
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
