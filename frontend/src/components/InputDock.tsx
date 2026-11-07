import React, { useState } from "react";
import { Send, Loader2, Trash } from "lucide-react";
import { QuickPrompts } from "./QuickPrompts";

interface InputDockProps {
  onAsk: (question: string, topK: number) => void;
  onClearChat: () => void;
  hasEntries: boolean;
  hasDocuments: boolean;
  isLoading: boolean;
}

export const InputDock: React.FC<InputDockProps> = ({
  onAsk,
  onClearChat,
  hasEntries,
  hasDocuments,
  isLoading,
}) => {
  const [question, setQuestion] = useState("");
  const [topK, setTopK] = useState(4);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = question.trim();
    if (!trimmed || isLoading || !hasDocuments) return;
    onAsk(trimmed, topK);
    setQuestion("");
  }

  function handleSelectPrompt(promptText: string) {
    if (isLoading || !hasDocuments) return;
    onAsk(promptText, topK);
  }

  return (
    <footer className="bg-surface border-t border-border p-4 shadow-[0_-2px_10px_rgba(20,45,78,0.04)] shrink-0 z-10">
      <div className="max-w-4xl mx-auto flex flex-col gap-2.5">
        {/* Quick Prompts Bar */}
        {hasDocuments && (
          <QuickPrompts
            onSelectPrompt={handleSelectPrompt}
            disabled={isLoading || !hasDocuments}
          />
        )}

        {/* Question Submission Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            {/* Input field */}
            <div className="relative flex-1">
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder={
                  !hasDocuments
                    ? "Upload a PDF document first to begin asking questions..."
                    : "Ask a question grounded in the document content (e.g., 'What are the main findings?')..."
                }
                disabled={isLoading || !hasDocuments}
                className="w-full h-11 px-3.5 text-xs sm:text-sm bg-surface border border-border rounded-lg text-slateText-primary placeholder:text-slateText-muted focus:border-electric focus:ring-2 focus:ring-electric/20 outline-none transition disabled:bg-slate-100 disabled:cursor-not-allowed"
                aria-label="Ask a question grounded in document content"
              />
            </div>

            {/* Top-K Selector */}
            <div className="flex items-center gap-1.5 shrink-0 bg-surface border border-border rounded-lg px-2.5 h-11">
              <label htmlFor="top-k-select" className="text-[11px] font-semibold text-slateText-secondary hidden sm:inline">
                Passages:
              </label>
              <select
                id="top-k-select"
                value={topK}
                onChange={(e) => setTopK(Number(e.target.value))}
                disabled={isLoading || !hasDocuments}
                className="text-xs font-semibold text-navy bg-transparent outline-none cursor-pointer"
                title="Number of top matching passages to retrieve"
              >
                <option value={2}>2</option>
                <option value={4}>4</option>
                <option value={6}>6</option>
                <option value={8}>8</option>
              </select>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || !hasDocuments || !question.trim()}
              className="h-11 px-4 bg-electric hover:bg-electric-hover text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow-btn disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shrink-0"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="hidden sm:inline">Searching...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span className="hidden sm:inline">Ask Question</span>
                </>
              )}
            </button>

            {/* Clear Chat Button */}
            {hasEntries && (
              <button
                type="button"
                onClick={onClearChat}
                disabled={isLoading}
                title="Clear current chat stream"
                className="h-11 px-3 bg-surface hover:bg-coral-subtle text-slateText-secondary hover:text-coral-dark border border-border hover:border-coral/30 rounded-lg text-xs font-semibold flex items-center gap-1 transition cursor-pointer shrink-0"
              >
                <Trash className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Clear Chat</span>
              </button>
            )}
          </div>
        </form>
      </div>
    </footer>
  );
};
