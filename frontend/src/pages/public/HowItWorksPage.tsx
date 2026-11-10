import React from "react";
import { Link } from "../../lib/router";
import {
  CheckCircle2,
  Cpu,
  ArrowRight,
  Database,
} from "lucide-react";

export const HowItWorksPage: React.FC = () => {
  return (
    <div className="flex flex-col min-h-screen bg-canvas text-slateText-primary selection:bg-electric-subtle selection:text-electric">
      {/* Header */}
      <section className="pt-16 pb-16 md:pt-20 md:pb-20 bg-gradient-to-b from-white via-tint/30 to-canvas border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-electric-subtle border border-electric/20 text-electric text-xs font-semibold uppercase tracking-wider mb-4 font-mono">
            <Cpu className="w-3.5 h-3.5" />
            <span>Technical Architecture</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-navy tracking-tight leading-tight">
            How DocuMind AI Works
          </h1>
          <p className="mt-4 text-lg text-slateText-secondary leading-relaxed">
            An open, transparent look at the ingestion, vector retrieval, and grounded synthesis
            pipeline powering DocuMind's zero-hallucination research workspace.
          </p>
        </div>
      </section>

      {/* 5-Step Pipeline Walkthrough */}
      <section className="py-20 bg-surface border-b border-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="space-y-16">
            {/* Step 1 */}
            <div className="relative pl-10 border-l-2 border-electric/30 pb-4">
              <div className="absolute -left-[17px] top-0 w-8 h-8 rounded-full bg-navy text-white text-xs font-mono font-bold flex items-center justify-center shadow-xs">
                01
              </div>
              <div className="space-y-3">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-electric">
                  Stage 1: Validation & Extraction
                </span>
                <h3 className="text-2xl font-bold text-navy">
                  Deterministic PDF Ingestion & Folio Tracking
                </h3>
                <p className="text-sm text-slateText-secondary leading-relaxed">
                  When a user uploads a PDF file (restricted strictly to 10 MB maximum), FastAPI and
                  <code className="text-xs font-mono bg-tint px-1.5 py-0.5 rounded text-navy ml-1">pypdf</code>
                  parse each page stream individually. If a PDF contains no extractable text (e.g. scanned images without OCR),
                  it is rejected with a clear HTTP 400 error rather than silently failing downstream.
                </p>
                <div className="p-4 rounded-lg bg-canvas border border-border text-xs font-mono text-slateText-primary space-y-1">
                  <div className="text-slateText-muted"># Ingestion Guardrails in app/services/pdf_parser.py</div>
                  <div>max_file_size = 10 * 1024 * 1024  <span className="text-slateText-muted"># 10 MB limit</span></div>
                  <div>pages = [pypdf.PdfReader(stream).pages[i].extract_text() for i in ...]</div>
                  <div className="text-teal font-semibold">assert any(len(p.strip()) &gt; 0 for p in pages)  # Reject blank text</div>
                </div>
              </div>
            </div>

            {/* Step 2 */}
            <div className="relative pl-10 border-l-2 border-electric/30 pb-4">
              <div className="absolute -left-[17px] top-0 w-8 h-8 rounded-full bg-electric text-white text-xs font-mono font-bold flex items-center justify-center shadow-xs">
                02
              </div>
              <div className="space-y-3">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-electric">
                  Stage 2: Chunk Partitioning
                </span>
                <h3 className="text-2xl font-bold text-navy">
                  Passage Normalization with Persistent Provenance
                </h3>
                <p className="text-sm text-slateText-secondary leading-relaxed">
                  Text extracted from each physical page is segmented into overlapping character passages.
                  Critically, every chunk stores its parent document filename, unique document ID,
                  and exact physical page number (1-indexed). This permanent linkage guarantees that citations
                  always reflect true document physical coordinates.
                </p>
                <div className="p-4 rounded-lg bg-canvas border border-border text-xs font-mono text-slateText-primary space-y-1">
                  <div className="text-slateText-muted">&#123; "doc_id": "d-9f2a", "filename": "policy.pdf", "page": 4, "text": "..." &#125;</div>
                </div>
              </div>
            </div>

            {/* Step 3 */}
            <div className="relative pl-10 border-l-2 border-electric/30 pb-4">
              <div className="absolute -left-[17px] top-0 w-8 h-8 rounded-full bg-teal text-white text-xs font-mono font-bold flex items-center justify-center shadow-xs">
                03
              </div>
              <div className="space-y-3">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-teal">
                  Stage 3: Vector Retrieval
                </span>
                <h3 className="text-2xl font-bold text-navy">
                  TF-IDF Vector Space & Cosine Similarity Ranking
                </h3>
                <p className="text-sm text-slateText-secondary leading-relaxed">
                  Unlike black-box vector databases where ranking calculations are hidden, DocuMind uses
                  <code className="text-xs font-mono bg-tint px-1.5 py-0.5 rounded text-navy ml-1">scikit-learn TfidfVectorizer</code>
                  to transform text into sparse token matrices. Cosine similarity compares the user's question
                  vector against all candidate chunks. Only the highest-scoring passages are selected for synthesis.
                </p>
                <div className="p-4 rounded-lg bg-canvas border border-border text-xs font-mono text-slateText-primary space-y-1">
                  <div className="text-slateText-muted"># Cosine similarity ranking calculation</div>
                  <div>tfidf_matrix = vectorizer.fit_transform(corpus_chunks)</div>
                  <div>query_vector = vectorizer.transform([user_question])</div>
                  <div>scores = cosine_similarity(query_vector, tfidf_matrix)[0]</div>
                  <div className="text-electric font-semibold">top_indices = np.argsort(scores)[::-1][:top_k]</div>
                </div>
              </div>
            </div>

            {/* Step 4 */}
            <div className="relative pl-10 border-l-2 border-electric/30 pb-4">
              <div className="absolute -left-[17px] top-0 w-8 h-8 rounded-full bg-navy text-white text-xs font-mono font-bold flex items-center justify-center shadow-xs">
                04
              </div>
              <div className="space-y-3">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-navy">
                  Stage 4: Grounded Synthesis
                </span>
                <h3 className="text-2xl font-bold text-navy">
                  Gemini API Constrained Generation & Fallback Protocol
                </h3>
                <p className="text-sm text-slateText-secondary leading-relaxed">
                  Retrieved passages are packaged into a strictly constrained prompt dispatched via direct HTTP REST
                  to the Gemini API. The prompt forbids speculative extrapolation and mandates exact citation tokens:
                  <code className="text-xs font-mono bg-tint px-1.5 py-0.5 rounded text-navy ml-1">[filename, p. X]</code>.
                  If the passages lack relevant facts, Gemini is instructed to emit the exact negative response:
                  <code className="text-xs font-mono bg-tint px-1.5 py-0.5 rounded text-teal font-bold ml-1">"The document does not contain this information."</code>
                </p>
              </div>
            </div>

            {/* Step 5 */}
            <div className="relative pl-10 pb-4">
              <div className="absolute -left-[17px] top-0 w-8 h-8 rounded-full bg-electric text-white text-xs font-mono font-bold flex items-center justify-center shadow-xs">
                05
              </div>
              <div className="space-y-3">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-electric">
                  Stage 5: Folio Projection
                </span>
                <h3 className="text-2xl font-bold text-navy">
                  Client-Side RAG Passage Weaver
                </h3>
                <p className="text-sm text-slateText-secondary leading-relaxed">
                  The React client parses returned citation tokens and converts them into interactive buttons.
                  Clicking any citation expands the RAG Passage Weaver, highlighting the verbatim source chunk
                  and displaying its exact cosine similarity score.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Honest Technical Disclosures */}
      <section className="py-20 bg-canvas border-b border-border">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-xs font-bold uppercase tracking-wider text-electric font-mono mb-2">
              Architecture Disclosures
            </h2>
            <h3 className="text-3xl font-extrabold text-navy tracking-tight">
              Prototype vs. Blueprint 2.0 Roadmap
            </h3>
            <p className="mt-4 text-slateText-secondary text-sm leading-relaxed">
              In accordance with our strict honesty standards, we clearly separate existing prototype
              capabilities from upcoming Blueprint 2.0 architectural milestones.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="p-6 rounded-xl bg-surface border border-border shadow-xs">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-teal font-mono mb-3">
                <CheckCircle2 className="w-4 h-4" />
                <span>Current Baseline (M1.4 / M2.1)</span>
              </div>
              <ul className="space-y-3 text-xs text-slateText-secondary">
                <li className="flex items-start gap-2">
                  <span className="font-bold text-navy">•</span>
                  <span><strong>Sparse Vector Retrieval:</strong> scikit-learn TF-IDF + Cosine Similarity.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-navy">•</span>
                  <span><strong>Storage:</strong> Transient in-memory dictionary; zero disk footprint.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-navy">•</span>
                  <span><strong>Concurrency:</strong> Single-session prototype; no authentication required.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-navy">•</span>
                  <span><strong>Gemini Integration:</strong> Direct HTTP REST request with fallback handling.</span>
                </li>
              </ul>
            </div>

            <div className="p-6 rounded-xl bg-surface border border-border shadow-xs">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-electric font-mono mb-3">
                <Database className="w-4 h-4" />
                <span>Blueprint 2.0 (Milestones 2.2 – 2.7)</span>
              </div>
              <ul className="space-y-3 text-xs text-slateText-secondary">
                <li className="flex items-start gap-2">
                  <span className="font-bold text-navy">•</span>
                  <span><strong>Hybrid Retrieval:</strong> Sparse BM25 combined with dense pgvector embeddings.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-navy">•</span>
                  <span><strong>Cloud Persistence:</strong> Supabase PostgreSQL with strict Row Level Security (RLS).</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-navy">•</span>
                  <span><strong>Async Workers:</strong> Redis + Celery / task worker queue for large PDF OCR and indexing.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-navy">•</span>
                  <span><strong>Multi-Notebook Workspaces:</strong> Cross-document synthesis and team collections.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-surface">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h3 className="text-2xl font-bold text-navy tracking-tight">
            See the pipeline in action
          </h3>
          <p className="mt-2 text-slateText-secondary text-sm">
            Launch the demo to test our retrieval accuracy on your own research documents.
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
