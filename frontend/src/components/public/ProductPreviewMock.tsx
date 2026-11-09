import React, { useState } from "react";
import {
  Layers,
  Sparkles,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

export interface ProductPreviewMockProps {
  className?: string;
}

export const ProductPreviewMock: React.FC<ProductPreviewMockProps> = ({ className = "" }) => {
  const [evidenceExpanded, setEvidenceExpanded] = useState(false);
  const [activeCitation, setActiveCitation] = useState<string | null>("p. 14");

  return (
    <div
      className={`rounded-xl border border-border bg-surface shadow-2xl overflow-hidden text-left flex flex-col ${className}`}
      aria-label="Conceptual Preview of DocuMind 2.0 Research Workspace"
    >
      {/* Editorial Preview Header Banner */}
      <div className="bg-navy px-4 py-2.5 flex items-center justify-between text-xs text-white border-b border-navy-hover flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-coral/80" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber/80" />
            <span className="w-2.5 h-2.5 rounded-full bg-teal/80" />
          </div>
          <span className="font-mono text-[11px] text-slate-300 ml-2 font-semibold">
            workspace.documind.ai / notebook / transformer-optimization
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider bg-electric/20 text-electric font-bold border border-electric/30">
            Conceptual Preview of DocuMind 2.0 Research Workspace
          </span>
        </div>
      </div>

      {/* Workspace Inner Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[460px] bg-canvas">
        {/* Supporting Context: Left Sources Sidebar (3 cols) */}
        <div className="lg:col-span-4 bg-surface border-r border-border p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-navy">
              <Layers className="w-3.5 h-3.5 text-electric" />
              <span>Notebook Sources (3)</span>
            </div>
            <span className="text-[10px] text-slateText-muted font-mono">Scope Active</span>
          </div>

          <div className="flex flex-col gap-2">
            {/* Source 1 (Selected) */}
            <div className="p-2.5 rounded-lg border-2 border-electric bg-electric-subtle/40 text-xs flex flex-col gap-1 cursor-default">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-navy truncate max-w-[180px]">
                  Attention_Is_All_You_Need.pdf
                </span>
                <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-teal-subtle text-teal-dark font-bold">
                  Active
                </span>
              </div>
              <span className="text-[10.5px] text-slateText-secondary">
                15 pages · 42 passage chunks
              </span>
            </div>

            {/* Source 2 */}
            <div className="p-2.5 rounded-lg border border-border bg-surface hover:bg-tint/50 text-xs flex flex-col gap-1 cursor-default transition">
              <div className="flex items-center justify-between">
                <span className="font-medium text-slateText-primary truncate max-w-[180px]">
                  FlashAttention_Fast_Exact.pdf
                </span>
                <span className="text-[9px] font-mono text-slateText-muted">Attached</span>
              </div>
              <span className="text-[10.5px] text-slateText-muted">
                18 pages · 54 passage chunks
              </span>
            </div>

            {/* Source 3 */}
            <div className="p-2.5 rounded-lg border border-border bg-surface hover:bg-tint/50 text-xs flex flex-col gap-1 cursor-default transition">
              <div className="flex items-center justify-between">
                <span className="font-medium text-slateText-primary truncate max-w-[180px]">
                  KV_Cache_Optimization_Survey.pdf
                </span>
                <span className="text-[9px] font-mono text-slateText-muted">Attached</span>
              </div>
              <span className="text-[10.5px] text-slateText-muted">
                12 pages · 36 passage chunks
              </span>
            </div>
          </div>

          <div className="mt-auto pt-3 border-t border-border/80 text-[11px] text-slateText-muted leading-relaxed">
            <span className="font-semibold text-slateText-secondary block mb-0.5">
              Multi-Source Scope
            </span>
            Questions search across all 3 attached sources using grounded TF-IDF vector similarity.
          </div>
        </div>

        {/* Primary Workspace: Central Conversational Research (8 cols) */}
        <div className="lg:col-span-8 p-4 sm:p-6 flex flex-col justify-between gap-4">
          <div className="flex flex-col gap-4">
            {/* User Question */}
            <div className="bg-tint border border-border border-l-4 border-l-navy rounded-lg p-3.5 shadow-xs">
              <div className="flex items-center justify-between text-[11px] text-slateText-muted mb-1">
                <span className="font-bold uppercase tracking-wider text-navy font-mono">
                  Research Query
                </span>
                <span>Just now</span>
              </div>
              <p className="text-xs sm:text-sm font-semibold text-slateText-primary">
                How does key-value caching optimize multi-head attention during autoregressive token generation?
              </p>
            </div>

            {/* Grounded AI Response */}
            <div className="bg-surface border border-border border-t-4 border-t-electric rounded-lg p-4 shadow-sm flex flex-col gap-3">
              <div className="flex items-center justify-between pb-2 border-b border-border/60">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-electric">
                    Grounded Synthesis
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-teal-subtle text-teal-dark border border-teal/20 font-bold">
                    2 Sources Cited
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setEvidenceExpanded((prev) => !prev)}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-navy hover:text-electric transition cursor-pointer"
                >
                  <span>{evidenceExpanded ? "Hide Evidence Panel" : "Explore Evidence Drawer"}</span>
                  {evidenceExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
              </div>

              <div className="text-xs sm:text-[13px] leading-relaxed text-slateText-primary space-y-2">
                <p>
                  During autoregressive sequence decoding, standard attention recomputes projections for all prior tokens at each generation step. Key-value (KV) caching eliminates this redundant computation by storing previously computed keys and values in memory{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setActiveCitation("p. 14");
                      setEvidenceExpanded(true);
                    }}
                    className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10.5px] font-mono font-bold bg-teal-subtle text-teal-dark border border-teal/30 hover:bg-teal hover:text-white transition cursor-pointer"
                  >
                    <span>[Attention_Is_All_You_Need.pdf, p. 14]</span>
                    <ExternalLink className="w-2.5 h-2.5 opacity-70" />
                  </button>
                  .
                </p>
                <p>
                  This transforms the per-token computational complexity from $O(N^2)$ to $O(N)$ with respect to sequence length, trading GPU memory footprint for major decoding throughput gains{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setActiveCitation("p. 6");
                      setEvidenceExpanded(true);
                    }}
                    className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10.5px] font-mono font-bold bg-teal-subtle text-teal-dark border border-teal/30 hover:bg-teal hover:text-white transition cursor-pointer"
                  >
                    <span>[KV_Cache_Optimization_Survey.pdf, p. 6]</span>
                    <ExternalLink className="w-2.5 h-2.5 opacity-70" />
                  </button>
                  .
                </p>
              </div>
            </div>

            {/* Optional Expandable Evidence Exploration Drawer */}
            {evidenceExpanded && (
              <div className="p-3.5 rounded-lg bg-slate-50 border border-teal/30 shadow-xs animate-in fade-in duration-200 text-xs">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-border text-[11px] font-mono">
                  <div className="flex items-center gap-1.5 text-teal-dark font-bold">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Evidence Explorer · Cosine Similarity Ranking</span>
                  </div>
                  <span className="text-slateText-muted">Inspection Mode</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div
                    className={`p-2.5 rounded border transition ${
                      activeCitation === "p. 14"
                        ? "border-teal bg-teal-subtle/50 ring-1 ring-teal/30"
                        : "border-border bg-surface"
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10.5px] mb-1 font-mono">
                      <span className="font-bold text-teal-dark">[Attention_Is_All_You_Need.pdf, p. 14]</span>
                      <span className="font-bold text-amber-dark">Score: 0.4285</span>
                    </div>
                    <p className="text-[11px] text-slateText-secondary line-clamp-2 italic">
                      "...to avoid recomputing key-value projections at every decoding step, intermediate states are cached in memory buffer..."
                    </p>
                  </div>

                  <div
                    className={`p-2.5 rounded border transition ${
                      activeCitation === "p. 6"
                        ? "border-teal bg-teal-subtle/50 ring-1 ring-teal/30"
                        : "border-border bg-surface"
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10.5px] mb-1 font-mono">
                      <span className="font-bold text-teal-dark">[KV_Cache_Optimization_Survey.pdf, p. 6]</span>
                      <span className="font-bold text-amber-dark">Score: 0.3850</span>
                    </div>
                    <p className="text-[11px] text-slateText-secondary line-clamp-2 italic">
                      "...reducing computational complexity per generated token from quadratic to linear relative to prefix history..."
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input Dock Simulation */}
          <div className="pt-2 border-t border-border flex items-center justify-between text-xs text-slateText-muted">
            <span className="italic">Grounded exclusively in notebook source evidence.</span>
            <span className="font-mono text-[10.5px] text-navy font-semibold">
              FastAPI + scikit-learn + Gemini Engine
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
