import React from "react";
import { Link } from "../../lib/router";
import { ShieldCheck, Lock, ArrowRight, HardDrive, Cpu } from "lucide-react";

export const PrivacyPage: React.FC = () => {
  return (
    <div className="flex flex-col min-h-screen bg-canvas text-slateText-primary selection:bg-electric-subtle selection:text-electric">
      {/* Header */}
      <section className="pt-16 pb-16 md:pt-20 md:pb-20 bg-gradient-to-b from-white via-tint/30 to-canvas border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal/10 border border-teal/20 text-teal text-xs font-semibold uppercase tracking-wider mb-4 font-mono">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Provisional Draft</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-navy tracking-tight leading-tight">
            Privacy Policy
          </h1>
          <p className="mt-4 text-base text-slateText-secondary leading-relaxed">
            Effective Date: November 2026 • Milestone 2.1 Release Baseline
          </p>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-20 bg-surface border-b border-border">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          {/* Important Notice Callout */}
          <div className="p-6 rounded-xl bg-canvas border border-border border-l-4 border-l-teal shadow-xs">
            <div className="flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-teal shrink-0 mt-0.5" />
              <div className="space-y-1 text-xs text-slateText-secondary leading-relaxed">
                <span className="font-bold text-navy text-sm block">Provisional Policy Notice</span>
                <p>
                  This document serves as our provisional privacy disclosure for the DocuMind AI
                  research prototype. As the platform transitions to multi-user cloud persistence in
                  Milestone 2.2, this policy will be formally updated and reviewed.
                </p>
              </div>
            </div>
          </div>

          {/* Section 1: In-Memory Demonstration Baseline */}
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-navy flex items-center gap-2">
              <HardDrive className="w-5 h-5 text-electric" />
              <span>1. Current In-Memory Demonstration Architecture (Milestone 1.4 / 2.1)</span>
            </h2>
            <div className="text-sm text-slateText-secondary space-y-3 leading-relaxed">
              <p>
                In the current demonstration prototype hosted at <code className="text-xs font-mono text-electric bg-tint px-1.5 py-0.5 rounded">/demo</code>:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  <strong>Volatile Memory Only:</strong> All uploaded PDF files, extracted text passages,
                  and TF-IDF vector indices are stored strictly in volatile server RAM.
                </li>
                <li>
                  <strong>Zero Persistent Disk Storage:</strong> We do not write uploaded document files,
                  passages, or conversation histories to hard disk or external databases.
                </li>
                <li>
                  <strong>Immediate Session Purging:</strong> Documents can be deleted immediately using
                  the trash icon in the document library, purging all associated memory records.
                  Server restarts automatically wipe all state.
                </li>
              </ul>
            </div>
          </div>

          {/* Section 2: Third-Party Processing */}
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-navy flex items-center gap-2">
              <Cpu className="w-5 h-5 text-teal" />
              <span>2. Third-Party API & Generative Processing</span>
            </h2>
            <div className="text-sm text-slateText-secondary space-y-3 leading-relaxed">
              <p>
                To generate grounded answers, DocuMind AI transmits only the specific text passages
                retrieved via TF-IDF vector matching to the Gemini API over an encrypted HTTPS connection.
              </p>
              <p>
                We do not transmit your entire raw PDF file to the LLM. Only the retrieved chunks
                necessary to synthesize an evidence-grounded response are provided to the model prompt.
                DocuMind AI does not use your uploaded documents or research questions to train machine learning models.
              </p>
            </div>
          </div>

          {/* Section 3: Planned Multi-User Cloud Architecture */}
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-navy flex items-center gap-2">
              <Lock className="w-5 h-5 text-navy" />
              <span>3. Upcoming Multi-User Cloud Architecture (Milestone 2.2+)</span>
            </h2>
            <div className="text-sm text-slateText-secondary space-y-3 leading-relaxed">
              <p>
                Under Product Blueprint 2.0 (Milestones 2.2 through 2.7), DocuMind AI will introduce
                authenticated user accounts powered by Supabase:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  <strong>Strict Row Level Security (RLS):</strong> Every user notebook, document, and
                  conversation record will be cryptographically isolated to the verified account identity.
                </li>
                <li>
                  <strong>Encrypted Storage:</strong> Documents stored in cloud object storage will be encrypted
                  at rest and in transit.
                </li>
                <li>
                  <strong>Right to Complete Erasure:</strong> Users will possess the unilateral ability to
                  permanently purge their accounts, documents, embeddings, and research notebooks.
                </li>
              </ul>
            </div>
          </div>

          {/* Section 4: Analytics and Cookies */}
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-navy">4. Cookies and Telemetry</h2>
            <p className="text-sm text-slateText-secondary leading-relaxed">
              DocuMind AI does not use advertising cookies, commercial tracking pixels, or cross-site
              surveillance frameworks. Any future telemetry will be strictly opt-in and restricted to
              anonymized performance metrics.
            </p>
          </div>

          {/* Section 5: Contact */}
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-navy">5. Inquiries & Data Rights</h2>
            <p className="text-sm text-slateText-secondary leading-relaxed">
              If you have questions regarding our data handling or privacy architecture, please contact
              the maintainer at:
            </p>
            <div className="p-4 rounded-lg bg-canvas border border-border text-xs font-mono text-navy">
              Hritik Maurya — <a href="mailto:hritikmaurya24@gmail.com" className="text-electric hover:underline">hritikmaurya24@gmail.com</a>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-canvas">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Link
            href="/demo"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-bold text-white bg-electric hover:bg-electric-hover shadow-btn transition cursor-pointer"
          >
            <span>Return to Interactive Demo</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  );
};
