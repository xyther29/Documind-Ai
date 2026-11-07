import React from "react";
import { BookOpen, Sparkles, CheckCircle2 } from "lucide-react";
import type { DocumentMeta } from "../types/api";

interface WelcomeGuidanceProps {
  documents: DocumentMeta[];
  selectedDocId: string | null;
  onSelectPrompt: (prompt: string) => void;
}

export const WelcomeGuidance: React.FC<WelcomeGuidanceProps> = ({
  documents,
  selectedDocId,
  onSelectPrompt,
}) => {
  const selectedDoc = documents.find((d) => d.doc_id === selectedDocId);
  const totalPages = documents.reduce((acc, d) => acc + d.page_count, 0);
  const totalChunks = documents.reduce((acc, d) => acc + d.chunk_count, 0);

  return (
    <div className="max-w-3xl w-full mx-auto my-auto py-6 flex flex-col gap-5 animate-in fade-in duration-200">
      {/* Primary Card */}
      <div className="bg-surface border border-border border-t-4 border-t-navy rounded-lg p-6 shadow-card">
        <div className="flex items-start gap-3.5">
          <div className="w-9 h-9 rounded bg-navy text-white flex items-center justify-center shrink-0">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-navy">
              DocuMind AI — Retrieval-Augmented Question Answering
            </h2>
            <p className="text-xs text-slateText-secondary mt-1 leading-relaxed">
              Ask questions about your uploaded PDF documents. The system uses TF-IDF retrieval and cosine similarity to find relevant passages, then synthesizes a grounded answer with verifiable page citations.
            </p>
          </div>
        </div>

        {/* Guided Steps */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5 pt-4 border-t border-border text-xs">
          <div className="p-3 bg-tint/60 rounded border border-border">
            <span className="font-bold text-navy block text-[11px] mb-1">1. Choose Scope</span>
            <p className="text-slateText-secondary text-[11px] leading-normal">
              Select <strong>All Documents</strong> or filter to an individual document in the sidebar.
            </p>
          </div>
          <div className="p-3 bg-tint/60 rounded border border-border">
            <span className="font-bold text-navy block text-[11px] mb-1">2. Ask & Synthesize</span>
            <p className="text-slateText-secondary text-[11px] leading-normal">
              Enter a question below. The top matching chunks are retrieved and used to generate a grounded answer.
            </p>
          </div>
          <div className="p-3 bg-tint/60 rounded border border-border">
            <span className="font-bold text-navy block text-[11px] mb-1">3. Verify Citations</span>
            <p className="text-slateText-secondary text-[11px] leading-normal">
              Expand passage accordions to inspect the exact retrieved source text and similarity scores.
            </p>
          </div>
        </div>

        {/* Invariant Note */}
        <div className="mt-4 p-3 bg-slate-50 border border-border rounded text-[11px] text-slateText-secondary flex items-start gap-2">
          <Sparkles className="w-3.5 h-3.5 text-amber shrink-0 mt-0.5" />
          <span>
            <strong>Grounding Invariant:</strong> If the document does not contain the answer, the model strictly returns:{" "}
            <em className="text-navy font-medium">"The document does not contain this information."</em>
          </span>
        </div>

        {/* Sample Prompt Starters */}
        {documents.length > 0 && (
          <div className="mt-4 pt-3.5 border-t border-border flex items-center gap-2 flex-wrap text-xs">
            <span className="text-[11px] font-semibold text-slateText-muted">Quick start:</span>
            {["Summarize the key points", "Explain the main concepts simply", "What are the important terms?"].map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => onSelectPrompt(prompt)}
                className="px-2.5 py-1 text-[11px] font-medium text-navy bg-tint hover:bg-slate-200/80 border border-border rounded-full transition cursor-pointer"
              >
                {prompt}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Active Corpus Status Card */}
      {documents.length > 0 ? (
        <div className="bg-surface border border-border rounded-lg p-4 shadow-subtle flex items-center justify-between gap-4 flex-wrap text-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-teal" />
            <span className="font-semibold text-navy">
              Active Scope: {selectedDoc ? selectedDoc.filename : `All Documents (${documents.length})`}
            </span>
          </div>

          <div className="flex items-center gap-3 text-slateText-muted text-[11px]">
            <span>{documents.length} document{documents.length === 1 ? "" : "s"}</span>
            <span>·</span>
            <span>{totalPages} page{totalPages === 1 ? "" : "s"}</span>
            <span>·</span>
            <span>{totalChunks} passage chunks</span>
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-lg border border-dashed border-border bg-surface/60 text-center text-xs text-slateText-secondary">
          No documents uploaded yet. Drag and drop a PDF into the sidebar to start asking questions.
        </div>
      )}
    </div>
  );
};
