import React, { useMemo } from "react";
import { Layers, ShieldAlert, AlertCircle } from "lucide-react";
import type { SearchResult } from "../types/api";
import { useReducedMotion } from "../hooks/useReducedMotion";

export interface PageChunkGroup {
  pageNumber: number;
  pageCitation: string;
  sources: SearchResult[];
  maxScore: number;
}

export interface RAGPassageWeaverProps {
  question: string;
  sources: SearchResult[];
  scopeLabel: string;
  scopeDocId: string | null;
  pageCount?: number;
  isUnsupported: boolean;
  fallbackUsed?: boolean;
  fallbackReason?: string | null;
  /**
   * Array of chunk IDs currently highlighted by citation clicks.
   */
  highlightedChunkIds: string[];
  /**
   * Callback when user selects a passage node in the visualizer.
   */
  onPassageClick: (chunkId: string, pageCitation: string) => void;
}

export const RAGPassageWeaver: React.FC<RAGPassageWeaverProps> = ({
  question,
  sources,
  scopeLabel,
  scopeDocId,
  pageCount,
  isUnsupported,
  fallbackUsed = false,
  fallbackReason = null,
  highlightedChunkIds = [],
  onPassageClick,
}) => {
  const prefersReducedMotion = useReducedMotion();

  // Multi-chunk page grouping: Group sources by start_page or pages[0]
  const pageGroups = useMemo<PageChunkGroup[]>(() => {
    if (!sources || sources.length === 0) return [];

    const map = new Map<number, PageChunkGroup>();

    for (const src of sources) {
      const pageNum =
        typeof src.start_page === "number" && !isNaN(src.start_page)
          ? src.start_page
          : src.pages && src.pages.length > 0 && typeof src.pages[0] === "number"
          ? src.pages[0]
          : 1;

      const cite = src.page_citation || `p. ${pageNum}`;
      const score = typeof src.score === "number" && !isNaN(src.score) ? src.score : 0;

      const existing = map.get(pageNum);
      if (!existing) {
        map.set(pageNum, {
          pageNumber: pageNum,
          pageCitation: cite,
          sources: [src],
          maxScore: score,
        });
      } else {
        existing.sources.push(src);
        if (score > existing.maxScore) {
          existing.maxScore = score;
        }
      }
    }

    return Array.from(map.values()).sort((a, b) => a.pageNumber - b.pageNumber);
  }, [sources]);

  const hasZeroSources = !sources || sources.length === 0;
  const showNegativeGrounding = isUnsupported || hasZeroSources;

  return (
    <div
      className="rag-weaver-container my-3"
      role="region"
      aria-label={`RAG passage weaver for query: ${question}`}
      data-doc-id={scopeDocId || undefined}
    >
      {/* Visualizer Header */}
      <div className="flex items-center justify-between p-3 bg-slate-50/80 border-b border-border/70 flex-wrap gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Layers className="w-4 h-4 text-electric shrink-0" aria-hidden="true" />
          <span className="font-semibold text-xs text-navy tracking-tight">
            RAG Passage Weaver
          </span>
          <span className="text-[11px] text-slateText-muted">•</span>
          <span
            className="text-xs text-slateText-secondary font-medium truncate max-w-xs"
            title={`Scope: ${scopeLabel}${scopeDocId ? ` (${scopeDocId})` : ""}`}
          >
            {scopeLabel}
          </span>
          {typeof pageCount === "number" && pageCount > 0 && (
            <span className="text-[10.5px] text-slateText-muted font-mono">
              ({pageGroups.length}/{pageCount} {pageCount === 1 ? "page" : "pages"})
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Fallback Mode Badge */}
          {fallbackUsed && (
            <div
              role="note"
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-subtle text-amber-dark border border-amber/30"
              title={fallbackReason || "Direct passage synthesis used due to LLM failover"}
            >
              <AlertCircle className="w-3 h-3 text-amber shrink-0" aria-hidden="true" />
              <span>Passage Direct Assembly (Gemini failover)</span>
            </div>
          )}

          {prefersReducedMotion ? (
            <span className="px-2 py-0.5 rounded text-[10.5px] font-mono text-slateText-secondary bg-surface border border-border">
              Static Ledger
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded text-[10.5px] font-mono text-teal-dark bg-teal-subtle border border-teal/20">
              Folio Active
            </span>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="p-3">
        {/* Negative Grounding Banner */}
        {showNegativeGrounding ? (
          <div
            role="status"
            aria-live="polite"
            className="p-4 bg-amber-subtle/50 border border-amber/30 rounded-md text-amber-dark flex items-start gap-3"
          >
            <ShieldAlert className="w-5 h-5 text-amber shrink-0 mt-0.5" aria-hidden="true" />
            <div className="space-y-1">
              <p className="text-xs font-semibold tracking-wide uppercase text-amber-dark/80">
                Negative Grounding Active
              </p>
              <p className="text-sm font-medium text-slateText-primary">
                Zero passages exceeded retrieval relevance threshold. Negative grounding active.
              </p>
              <p className="text-xs text-slateText-secondary">
                DocuMind AI prevents hallucination by strictly refusing to assemble answers when retrieved evidence falls below cosine similarity criteria.
              </p>
            </div>
          </div>
        ) : prefersReducedMotion ? (
          /* Accessible Static Verification Ledger (Reduced Motion Mode) */
          <div className="overflow-x-auto">
            <table className="rag-static-ledger" aria-label="Passage retrieval verification ledger">
              <thead>
                <tr>
                  <th scope="col">Page</th>
                  <th scope="col">Chunk ID</th>
                  <th scope="col">TF-IDF Score</th>
                  <th scope="col">Citation Excerpt</th>
                </tr>
              </thead>
              <tbody>
                {sources.map((source) => {
                  const isHighlighted = highlightedChunkIds.includes(source.chunk_id);
                  const scoreFormatted =
                    typeof source.score === "number" && !isNaN(source.score)
                      ? source.score.toFixed(4)
                      : "0.0000";
                  const pageCitation = source.page_citation || `p. ${source.start_page ?? 1}`;

                  return (
                    <tr
                      key={source.chunk_id}
                      tabIndex={0}
                      role="button"
                      aria-label={`Select passage from ${pageCitation} with score ${scoreFormatted}`}
                      aria-pressed={isHighlighted}
                      onClick={() => onPassageClick(source.chunk_id, pageCitation)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onPassageClick(source.chunk_id, pageCitation);
                        }
                      }}
                      className={`rag-static-row cursor-pointer transition ${
                        isHighlighted ? "bg-tint font-medium" : ""
                      }`}
                    >
                      <td className="font-mono font-semibold text-teal-dark whitespace-nowrap">
                        {pageCitation}
                      </td>
                      <td className="font-mono text-xs text-slateText-muted whitespace-nowrap">
                        {source.chunk_id}
                      </td>
                      <td className="font-mono text-xs font-semibold text-amber-dark whitespace-nowrap">
                        Score: {scoreFormatted}
                      </td>
                      <td className="text-xs text-slateText-primary max-w-md truncate" title={source.text}>
                        {source.text}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          /* Folio View (Standard Motion Mode) */
          <div
            className="rag-folio-strip p-1 gap-3 overflow-x-auto items-start"
            role="region"
            aria-label="Folio Deck"
          >
            {pageGroups.map((group) => {
              const isAnyChunkHighlighted = group.sources.some((s) =>
                highlightedChunkIds.includes(s.chunk_id)
              );
              const maxScoreFormatted =
                typeof group.maxScore === "number" && !isNaN(group.maxScore)
                  ? group.maxScore.toFixed(4)
                  : "0.0000";

              return (
                <div
                  key={group.pageNumber}
                  className={`flex flex-col gap-2.5 p-3 rounded-lg border transition-all duration-200 shrink-0 min-w-[280px] max-w-[340px] bg-white/95 backdrop-blur-xs ${
                    isAnyChunkHighlighted
                      ? "border-teal shadow-md ring-1 ring-teal/30"
                      : "border-border shadow-xs hover:border-border-secondary"
                  }`}
                >
                  {/* Active Page Card Header */}
                  <div className="flex items-center justify-between gap-2 pb-2 border-b border-border/50">
                    <div className="flex items-center gap-2 min-w-0">
                      <button
                        type="button"
                        onClick={() => {
                          if (group.sources.length > 0) {
                            onPassageClick(group.sources[0].chunk_id, group.pageCitation);
                          }
                        }}
                        className={`rag-page-card rag-page-card-active shrink-0 cursor-pointer ${
                          isAnyChunkHighlighted ? "ring-2 ring-teal" : ""
                        }`}
                        title={`Page ${group.pageCitation} — Top Similarity: ${maxScoreFormatted}`}
                        aria-label={`Page ${group.pageCitation}, ${group.sources.length} chunks, max score ${maxScoreFormatted}`}
                      >
                        <span>{group.pageCitation}</span>
                      </button>
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-teal-subtle text-teal-dark border border-teal/20"
                        title={`${group.sources.length} retrieved passage chunk(s) on ${group.pageCitation}`}
                      >
                        {group.sources.length} {group.sources.length === 1 ? "chunk" : "chunks"}
                      </span>
                    </div>

                    <span
                      className="font-mono text-[10.5px] font-bold text-amber-dark bg-amber-subtle px-1.5 py-0.5 rounded border border-amber/20"
                      title="Highest TF-IDF cosine similarity score on this page"
                    >
                      Max: {maxScoreFormatted}
                    </span>
                  </div>

                  {/* Connecting Rails to Passage Chips */}
                  <div className="flex flex-col gap-2 pt-1 pl-1">
                    {group.sources.map((source) => {
                      const isChipActive = highlightedChunkIds.includes(source.chunk_id);
                      const scoreFormatted =
                        typeof source.score === "number" && !isNaN(source.score)
                          ? source.score.toFixed(4)
                          : "0.0000";
                      const snippet =
                        source.text && source.text.trim().length > 0
                          ? source.text.trim().replace(/\s+/g, " ")
                          : "No passage text available.";
                      const snippetPreview =
                        snippet.length > 95 ? `${snippet.slice(0, 95)}…` : snippet;
                      const pageCitation = source.page_citation || `p. ${source.start_page ?? 1}`;

                      return (
                        <div
                          key={source.chunk_id}
                          className={`rag-branch-rail ${isChipActive ? "active" : ""}`}
                          data-active={isChipActive}
                        >
                          <button
                            type="button"
                            onClick={() => onPassageClick(source.chunk_id, pageCitation)}
                            tabIndex={0}
                            className={`rag-passage-chip w-full text-left cursor-pointer transition ${
                              isChipActive ? "rag-passage-chip-active" : ""
                            }`}
                            aria-pressed={isChipActive}
                            aria-label={`Passage ${source.chunk_id} from ${pageCitation}, score ${scoreFormatted}`}
                            title={source.text}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                onPassageClick(source.chunk_id, pageCitation);
                              }
                            }}
                          >
                            <div className="flex flex-col gap-1 w-full min-w-0">
                              <div className="flex items-center justify-between gap-1.5 flex-wrap">
                                <span className="font-mono text-[10.5px] font-bold text-amber-dark bg-amber-subtle px-1.5 py-0.2 rounded border border-amber/30 shrink-0">
                                  Score: {scoreFormatted}
                                </span>
                                <span className="font-mono text-[10px] font-semibold text-teal-dark bg-teal-subtle px-1.5 py-0.2 rounded shrink-0">
                                  {pageCitation}
                                </span>
                              </div>
                              <p className="text-[11px] leading-snug text-slateText-secondary line-clamp-2 break-words font-sans">
                                {snippetPreview}
                              </p>
                            </div>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default RAGPassageWeaver;
