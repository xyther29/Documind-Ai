import React, { useState } from "react";
import {
  Copy,
  Check,
  AlertTriangle,
  FileText,
  Layers,
  Info,
  ExternalLink,
} from "lucide-react";
import type { QAEntry, SearchResult } from "../types/api";
import { CitationList } from "./CitationList";
import { RAGLoadingStatus } from "./RAGLoadingStatus";
import { RAGPassageWeaver } from "./RAGPassageWeaver";
import { copyTextToClipboard, formatQANoteAsMarkdown } from "../lib/clipboard";

interface QAEntryItemProps {
  entry: QAEntry;
  onRetry?: (question: string, docId: string | null) => void;
}

export const QAEntryItem: React.FC<QAEntryItemProps> = ({ entry }) => {
  const [copied, setCopied] = useState(false);
  const [highlightedChunkIds, setHighlightedChunkIds] = useState<string[]>([]);

  const isUnsupported =
    entry.answer === "The document does not contain this information.";

  async function handleCopy() {
    const markdown = formatQANoteAsMarkdown(entry);
    const success = await copyTextToClipboard(markdown);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  function handleCitationClick(chunkIds: string[]) {
    if (!chunkIds || chunkIds.length === 0) return;
    setHighlightedChunkIds(chunkIds);

    // Smoothly scroll to the first matching citation card
    const targetElement = document.getElementById(`citation-${chunkIds[0]}`);
    if (targetElement) {
      targetElement.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    // Toggle active ring classes on all matching citation elements
    chunkIds.forEach((id) => {
      const el = document.getElementById(`citation-${id}`);
      if (el) {
        el.classList.add("ring-2", "ring-electric", "bg-selection");
      }
    });

    // Fade out highlight after 2.5s
    setTimeout(() => {
      setHighlightedChunkIds([]);
      chunkIds.forEach((id) => {
        const el = document.getElementById(`citation-${id}`);
        if (el) {
          el.classList.remove("ring-2", "ring-electric", "bg-selection");
        }
      });
    }, 2500);
  }

  /**
   * Parse answer text and transform citation markers into clickable pills that link to sources.
   * Matches all chunks sharing the cited filename and page.
   */
  function renderFormattedAnswer(answerText: string, sources: SearchResult[]) {
    if (!answerText) return null;

    // Pattern matching [filename.pdf, p. 1] or [file.pdf, pp. 2-3]
    const citationRegex = /\[([^\[\]]+?,\s*p{1,2}\.\s*\d+(?:-\d+)?)\]/g;
    const elements: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = citationRegex.exec(answerText)) !== null) {
      const matchIndex = match.index;
      const fullMatch = match[0]; // e.g. "[report.pdf, p. 1]"
      const citationContent = match[1]; // e.g. "report.pdf, p. 1"

      // Append preceding plain text
      if (matchIndex > lastIndex) {
        elements.push(answerText.substring(lastIndex, matchIndex));
      }

      // Find all matching source passages by filename and citation substring
      const cleanContent = citationContent.trim().toLowerCase();
      const matchingSources = sources.filter((s) => {
        const sFile = (s.filename || "").toLowerCase();
        const sCite = (s.page_citation || "").toLowerCase();
        return (
          cleanContent === `${sFile}, ${sCite}` ||
          (cleanContent.includes(sFile) && cleanContent.includes(sCite))
        );
      });

      if (matchingSources.length > 0) {
        const matchingChunkIds = matchingSources.map((s) => s.chunk_id);
        const matchTitle = `Jump to source: [${matchingSources[0].filename}, ${matchingSources[0].page_citation}] (${matchingSources.length} chunk${matchingSources.length > 1 ? "s" : ""} on page)`;
        // Interactive citation badge
        elements.push(
          <button
            key={`cite-${matchIndex}`}
            type="button"
            onClick={() => handleCitationClick(matchingChunkIds)}
            className="inline-flex items-center gap-1 mx-1 px-1.5 py-0.5 rounded text-[11px] font-mono font-bold bg-teal-subtle text-teal-dark border border-teal/30 hover:bg-teal hover:text-white transition cursor-pointer shadow-xs align-baseline"
            title={matchTitle}
          >
            <span>{fullMatch}</span>
            <ExternalLink className="w-2.5 h-2.5 opacity-70" />
          </button>
        );
      } else {
        // Unmatched citation badge
        elements.push(
          <span
            key={`cite-unmatched-${matchIndex}`}
            className="inline-flex items-center mx-1 px-1.5 py-0.5 rounded text-[11px] font-mono font-medium bg-slate-100 text-slateText-muted border border-border align-baseline"
            title="Citation reference in response"
          >
            {fullMatch}
          </span>
        );
      }

      lastIndex = matchIndex + fullMatch.length;
    }

    // Append remaining plain text
    if (lastIndex < answerText.length) {
      elements.push(answerText.substring(lastIndex));
    }

    return elements;
  }

  return (
    <div className="flex flex-col gap-3 max-w-4xl w-full mx-auto animate-in fade-in slide-in-from-bottom-2 duration-200">
      {/* Question Block */}
      <div className="bg-tint border border-border border-l-4 border-l-navy rounded-lg p-3.5 shadow-subtle">
        <div className="flex items-center justify-between text-[11px] mb-1.5">
          <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-navy">
            <span>Question</span>
            <span className="text-slateText-muted font-normal">·</span>
            <span className="inline-flex items-center gap-1 font-semibold text-slateText-secondary font-sans normal-case">
              {entry.scopeDocId ? (
                <>
                  <FileText className="w-3 h-3 text-electric" />
                  <span className="truncate max-w-[200px]">{entry.scopeLabel}</span>
                </>
              ) : (
                <>
                  <Layers className="w-3 h-3 text-navy" />
                  <span>All Documents</span>
                </>
              )}
            </span>
          </div>
          <span className="text-slateText-muted text-[10px]">{entry.timestamp}</span>
        </div>
        <p className="text-sm font-semibold text-slateText-primary leading-relaxed">
          {entry.question}
        </p>
      </div>

      {/* RAG Passage Weaver & Folio Projection (When Settled) */}
      {entry.status === "success" && (
        <RAGPassageWeaver
          question={entry.question}
          sources={entry.sources || []}
          scopeLabel={entry.scopeLabel}
          scopeDocId={entry.scopeDocId}
          isUnsupported={isUnsupported}
          fallbackUsed={entry.fallback_used}
          fallbackReason={entry.fallback_reason}
          highlightedChunkIds={highlightedChunkIds}
          onPassageClick={(chunkId, pageCitation) => {
            const siblingChunkIds = (entry.sources || [])
              .filter((s) => s.page_citation === pageCitation || s.chunk_id === chunkId)
              .map((s) => s.chunk_id);
            handleCitationClick(siblingChunkIds.length > 0 ? siblingChunkIds : [chunkId]);
          }}
        />
      )}

      {/* Answer Block */}
      <div className="bg-surface border border-border border-t-4 border-t-electric rounded-lg p-4 sm:p-5 shadow-card">
        {/* Answer Header Row */}
        <div className="flex items-center justify-between gap-2 pb-3 mb-3 border-b border-border/70 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-electric">
              Answer
            </span>

            {/* Fallback Badge */}
            {entry.status === "success" && entry.fallback_used && (
              <span
                className="px-2 py-0.5 text-[10.5px] font-semibold rounded bg-amber-subtle text-amber-dark border border-amber/30 inline-flex items-center gap-1"
                title="AI synthesis was unavailable. Answer formatted directly from retrieved passages."
              >
                <AlertTriangle className="w-3 h-3 text-amber" />
                <span>Passage-only fallback</span>
              </span>
            )}
          </div>

          {/* Action Tools */}
          {entry.status === "success" && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slateText-secondary hover:text-navy bg-tint hover:bg-slate-200/70 border border-border rounded transition cursor-pointer"
                title="Copy note with citations formatted in Markdown"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-teal" />
                    <span className="text-teal font-semibold">Copied Note!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Note</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Fallback Reason Note (if present) */}
        {entry.status === "success" && entry.fallback_used && entry.fallback_reason && (
          <div className="mb-3 p-2.5 rounded bg-amber-subtle/80 border-l-4 border-l-amber text-xs text-amber-dark leading-relaxed">
            <span className="font-bold">Provider Note: </span>
            <span>{entry.fallback_reason}</span>
          </div>
        )}

        {/* Body State: Authentic In-Flight Loading */}
        {entry.status === "loading" && (
          <RAGLoadingStatus
            question={entry.question}
            scopeLabel={entry.scopeLabel}
            scopeDocId={entry.scopeDocId}
          />
        )}

        {/* Body State: Error */}
        {entry.status === "error" && (
          <div className="p-3.5 bg-coral-subtle border border-coral/30 rounded text-coral-dark text-xs flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-coral shrink-0 mt-0.5" />
            <div className="flex-1">
              <strong className="block font-semibold">Failed to generate answer</strong>
              <span className="text-coral-dark/90 mt-0.5 block">
                {entry.errorMessage || "An unexpected error occurred while communicating with the server."}
              </span>
            </div>
          </div>
        )}

        {/* Body State: Success */}
        {entry.status === "success" && (
          <>
            {isUnsupported ? (
              <div className="flex items-start gap-3 p-3.5 rounded-lg bg-tint/80 border border-border text-slateText-secondary text-xs leading-relaxed">
                <Info className="w-4 h-4 text-slateText-muted shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-slateText-primary block mb-0.5">
                    {entry.answer}
                  </span>
                  <span className="text-slateText-muted">
                    The document content does not contain sufficient facts to answer this question. Try rephrasing or checking another document.
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-sm leading-relaxed whitespace-pre-wrap break-words text-slateText-primary">
                {renderFormattedAnswer(entry.answer || "", entry.sources || [])}
              </div>
            )}

            {/* Citations & Sources */}
            <CitationList
              sources={entry.sources || []}
              highlightedChunkId={highlightedChunkIds[0] || null}
            />
          </>
        )}
      </div>
    </div>
  );
};
