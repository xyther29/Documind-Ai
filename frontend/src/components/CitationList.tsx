import React from "react";
import type { SearchResult } from "../types/api";
import { CitationCard } from "./CitationCard";
import { BookOpen } from "lucide-react";

interface CitationListProps {
  sources: SearchResult[];
  highlightedChunkId?: string | null;
}

export const CitationList: React.FC<CitationListProps> = ({
  sources,
  highlightedChunkId = null,
}) => {
  if (!sources || sources.length === 0) {
    return (
      <div className="mt-3 pt-3 border-t border-border/60">
        <span className="text-xs text-slateText-muted italic">
          No source passages retrieved for this question.
        </span>
      </div>
    );
  }

  return (
    <div className="mt-4 pt-3 border-t border-border">
      <div className="flex items-center gap-2 mb-2.5">
        <BookOpen className="w-3.5 h-3.5 text-navy" />
        <span className="text-[11px] font-bold uppercase tracking-wider text-navy">
          Retrieved Sources
        </span>
        <span className="px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-tint border border-border text-navy">
          {sources.length}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        {sources.map((source, index) => (
          <CitationCard
            key={source.chunk_id || `source-${index}`}
            source={source}
            index={index}
            isHighlighted={source.chunk_id === highlightedChunkId}
            forceExpanded={source.chunk_id === highlightedChunkId}
          />
        ))}
      </div>
    </div>
  );
};
