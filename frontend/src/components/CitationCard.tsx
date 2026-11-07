import React, { useState, useEffect } from "react";
import { ChevronDown, ChevronUp, FileText, Sparkles, Copy, Check } from "lucide-react";
import type { SearchResult } from "../types/api";
import { copyCitationSnippet } from "../lib/clipboard";

interface CitationCardProps {
  source: SearchResult;
  index: number;
  isHighlighted?: boolean;
  forceExpanded?: boolean;
}

export const CitationCard: React.FC<CitationCardProps> = ({
  source,
  index,
  isHighlighted = false,
  forceExpanded = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  // If parent asks to expand (e.g. from inline citation click), update local state
  useEffect(() => {
    if (forceExpanded) {
      setIsExpanded(true);
    }
  }, [forceExpanded]);

  const hasScore = typeof source.score === "number" && !isNaN(source.score);

  async function handleCopyCitation(e: React.MouseEvent) {
    e.stopPropagation();
    const success = await copyCitationSnippet(
      source.filename || "Document",
      source.page_citation || "p. 1",
      source.text
    );
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div
      id={`citation-${source.chunk_id}`}
      className={`border rounded bg-surface shadow-subtle overflow-hidden transition-all duration-300 ${
        isHighlighted
          ? "border-electric ring-2 ring-electric/40 bg-tint shadow-card"
          : "border-border hover:border-border-secondary"
      }`}
    >
      {/* Citation Header Row */}
      <div className="flex items-center justify-between p-2.5 text-xs bg-slate-50/70 border-b border-border/50 gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {/* Page Citation Badge */}
          <span className="shrink-0 px-2 py-0.5 font-mono text-[11px] font-bold text-teal-dark bg-teal-subtle border border-teal/20 rounded">
            [{source.page_citation || "p. 1"}]
          </span>

          {/* Filename */}
          <span
            className="font-medium text-slateText-secondary truncate text-xs flex items-center gap-1.5"
            title={source.filename}
          >
            <FileText className="w-3.5 h-3.5 text-slateText-muted shrink-0" />
            <span className="truncate">{source.filename || "Document"}</span>
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Similarity Score Pill */}
          {hasScore && (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-mono text-[10.5px] font-bold text-amber-dark bg-amber-subtle border border-amber/30"
              title="Cosine similarity score from TF-IDF vector retrieval"
            >
              <Sparkles className="w-3 h-3 text-amber" />
              <span>Score: {source.score.toFixed(4)}</span>
            </span>
          )}

          {/* Copy Citation Button */}
          <button
            type="button"
            onClick={handleCopyCitation}
            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-slateText-secondary hover:text-navy bg-surface border border-border hover:bg-tint rounded transition cursor-pointer"
            title="Copy citation and passage to clipboard"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-teal" />
                <span className="text-teal font-semibold">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3 text-slateText-muted" />
                <span>Copy</span>
              </>
            )}
          </button>

          {/* Toggle Passage Button */}
          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            aria-expanded={isExpanded}
            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-navy bg-surface border border-border hover:bg-tint rounded transition cursor-pointer"
          >
            <span>{isExpanded ? "Hide passage" : "View passage"}</span>
            {isExpanded ? (
              <ChevronUp className="w-3 h-3 text-slateText-muted" />
            ) : (
              <ChevronDown className="w-3 h-3 text-slateText-muted" />
            )}
          </button>
        </div>
      </div>

      {/* Expandable Passage Box */}
      {isExpanded && (
        <div className="p-3 bg-slate-50 text-[11.5px] font-mono leading-relaxed text-slateText-primary border-l-4 border-l-teal animate-in fade-in duration-150 whitespace-pre-wrap break-words">
          <div className="flex items-center justify-between text-[10px] uppercase font-bold text-slateText-muted mb-1 font-sans">
            <span>Passage #{index + 1} Excerpt</span>
            <span>Pages: {source.pages?.join(", ") || source.start_page}</span>
          </div>
          {source.text}
        </div>
      )}
    </div>
  );
};
