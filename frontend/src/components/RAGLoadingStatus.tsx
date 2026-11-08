import React, { useState, useEffect } from "react";
import { Loader2, Sparkles, Layers, FileText } from "lucide-react";

export interface RAGLoadingStatusProps {
  question: string;
  scopeLabel: string;
  scopeDocId: string | null;
  /**
   * Optional epoch ms when request began. If omitted, uses component mount time.
   */
  startedAt?: number;
}

export const RAGLoadingStatus: React.FC<RAGLoadingStatusProps> = ({
  question,
  scopeLabel,
  scopeDocId,
  startedAt,
}) => {
  const [elapsedMs, setElapsedMs] = useState<number>(0);

  useEffect(() => {
    const startTime = startedAt ?? Date.now();

    // Initial tick on mount or when startedAt changes
    setElapsedMs(Math.max(0, Date.now() - startTime));

    const intervalId = window.setInterval(() => {
      setElapsedMs(Math.max(0, Date.now() - startTime));
    }, 100);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [startedAt]);

  const formattedElapsed = `${(elapsedMs / 1000).toFixed(1)}s`;

  return (
    <div
      role="status"
      aria-live="polite"
      className="p-4 rounded-lg bg-surface border border-border border-l-4 border-l-electric shadow-card flex flex-col gap-3"
    >
      {/* Header and Live Elapsed Pill */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-electric shrink-0" />
          <h4 className="text-sm font-semibold text-navy">
            Retrieving & Synthesizing
          </h4>
        </div>
        <div className="flex items-center gap-2">
          {/* Scope Pill */}
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-tint text-slateText-secondary border border-border/80"
            title={`Active search scope: ${scopeLabel}`}
          >
            {scopeDocId ? (
              <FileText className="w-3 h-3 text-electric shrink-0" />
            ) : (
              <Layers className="w-3 h-3 text-navy shrink-0" />
            )}
            <span className="truncate max-w-[160px] sm:max-w-[200px]">{scopeLabel}</span>
          </span>

          {/* Elapsed Seconds Pill */}
          <span
            className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-mono font-medium bg-tint text-slateText-secondary border border-border"
            title="Elapsed query time"
          >
            {formattedElapsed}
          </span>
        </div>
      </div>

      {/* Subtitle */}
      <p className="text-xs text-slateText-secondary">
        Awaiting server retrieval and synthesis...
      </p>

      {/* Animated Scanning Bar (DocuMind electric blue / amber palette) */}
      <div
        className="w-full h-1.5 bg-tint rounded-full overflow-hidden"
        aria-hidden="true"
      >
        <div className="h-full w-full bg-gradient-to-r from-electric via-amber to-electric rounded-full animate-pulse" />
      </div>

      {/* Detail Note & Question */}
      <div className="flex flex-col gap-1.5 pt-0.5">
        <div className="flex items-center gap-1.5 text-[11px] text-slateText-muted">
          <Sparkles className="w-3.5 h-3.5 text-electric shrink-0" />
          <span>Querying precomputed TF-IDF index and requesting Gemini grounding</span>
        </div>

        {question ? (
          <p className="text-[11px] text-slateText-muted italic truncate">
            &ldquo;{question}&rdquo;
          </p>
        ) : null}
      </div>
    </div>
  );
};
