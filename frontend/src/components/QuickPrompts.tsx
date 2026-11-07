import React from "react";
import { Sparkles } from "lucide-react";

interface QuickPromptsProps {
  onSelectPrompt: (promptText: string) => void;
  disabled?: boolean;
}

const PROMPTS = [
  "Summarize the key points",
  "Explain the main concepts simply",
  "What are the important terms?",
  "What methodology or approach is described?",
];

export const QuickPrompts: React.FC<QuickPromptsProps> = ({
  onSelectPrompt,
  disabled = false,
}) => {
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs select-none scrollbar-none">
      <div className="flex items-center gap-1 text-[11px] font-semibold text-slateText-muted shrink-0 pr-1">
        <Sparkles className="w-3.5 h-3.5 text-amber" />
        <span>Try asking:</span>
      </div>
      {PROMPTS.map((prompt) => (
        <button
          key={prompt}
          type="button"
          onClick={() => onSelectPrompt(prompt)}
          disabled={disabled}
          className="shrink-0 px-2.5 py-1 text-[11px] font-medium text-navy bg-tint hover:bg-slate-200/80 border border-border rounded-full transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {prompt}
        </button>
      ))}
    </div>
  );
};
