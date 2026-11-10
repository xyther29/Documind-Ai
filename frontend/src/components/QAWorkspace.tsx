import React, { useRef, useEffect } from "react";
import { ScopeBanner } from "./ScopeBanner";
import { WelcomeGuidance } from "./WelcomeGuidance";
import { QAEntryItem } from "./QAEntryItem";
import { InputDock } from "./InputDock";
import type { DocumentMeta, QAEntry, AskRequest } from "../types/api";
import { askQuestion, type AuthMode } from "../lib/api";

interface QAWorkspaceProps {
  documents: DocumentMeta[];
  selectedDocId: string | null;
  onSelectDoc: (docId: string | null) => void;
  entries: QAEntry[];
  setEntries: React.Dispatch<React.SetStateAction<QAEntry[]>>;
  mode?: AuthMode;
}

export const QAWorkspace: React.FC<QAWorkspaceProps> = ({
  documents,
  selectedDocId,
  onSelectDoc,
  entries,
  setEntries,
  mode,
}) => {
  const streamEndRef = useRef<HTMLDivElement>(null);
  const selectedDoc = documents.find((d) => d.doc_id === selectedDocId);

  // Auto-scroll to bottom when new entries arrive or state updates
  useEffect(() => {
    streamEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [entries]);

  const isAsking = entries.some((e) => e.status === "loading");

  async function handleAskQuestion(questionText: string, topK: number) {
    if (!questionText.trim() || isAsking) return;

    const entryId = `qa-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const nowTime = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
    }).format(new Date());

    const scopeLabel = selectedDoc
      ? selectedDoc.filename
      : `All Documents (${documents.length})`;

    // Immediate optimistic entry in loading state
    const newEntry: QAEntry = {
      id: entryId,
      question: questionText.trim(),
      scopeLabel,
      scopeDocId: selectedDocId,
      status: "loading",
      timestamp: nowTime,
    };

    setEntries((prev) => [...prev, newEntry]);

    const payload: AskRequest = {
      question: questionText.trim(),
      top_k: topK,
    };
    // Send doc_id ONLY if specific document is selected
    if (selectedDocId) {
      payload.doc_id = selectedDocId;
    }

    try {
      const response = await askQuestion(payload, mode);

      setEntries((prev) =>
        prev.map((e) => {
          if (e.id !== entryId) return e;
          return {
            ...e,
            status: "success",
            answer: response.answer,
            sources: response.sources || [],
            fallback_used: response.fallback_used,
            fallback_reason: response.fallback_reason,
          };
        })
      );
    } catch (err: any) {
      setEntries((prev) =>
        prev.map((e) => {
          if (e.id !== entryId) return e;
          return {
            ...e,
            status: "error",
            errorMessage: err.message || "Failed to generate answer from server",
          };
        })
      );
    }
  }

  function handleClearChat() {
    setEntries([]);
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-canvas overflow-hidden">
      {/* Scope Banner */}
      <ScopeBanner
        selectedDocId={selectedDocId}
        documents={documents}
        onClearScope={() => onSelectDoc(null)}
      />

      {/* Scrollable Conversation Stream */}
      <div
        className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col gap-6"
        aria-label="Conversation Log"
        role="log"
        aria-live="polite"
      >
        {entries.length === 0 ? (
          <WelcomeGuidance
            documents={documents}
            selectedDocId={selectedDocId}
            onSelectPrompt={(p) => handleAskQuestion(p, 4)}
          />
        ) : (
          entries.map((entry) => (
            <QAEntryItem key={entry.id} entry={entry} />
          ))
        )}
        <div ref={streamEndRef} />
      </div>

      {/* Docked Input Footer */}
      <InputDock
        onAsk={handleAskQuestion}
        onClearChat={handleClearChat}
        hasEntries={entries.length > 0}
        hasDocuments={documents.length > 0}
        isLoading={isAsking}
      />
    </div>
  );
};
