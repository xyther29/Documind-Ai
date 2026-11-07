import React from "react";
import { Layers, FileText, X } from "lucide-react";
import type { DocumentMeta } from "../types/api";

interface ScopeBannerProps {
  selectedDocId: string | null;
  documents: DocumentMeta[];
  onClearScope: () => void;
}

export const ScopeBanner: React.FC<ScopeBannerProps> = ({
  selectedDocId,
  documents,
  onClearScope,
}) => {
  const selectedDoc = documents.find((d) => d.doc_id === selectedDocId);
  const isIndividual = Boolean(selectedDocId && selectedDoc);

  return (
    <div className="h-11 bg-surface border-b border-border px-6 flex items-center justify-between text-xs shrink-0 shadow-sm z-10">
      <div className="flex items-center gap-2 overflow-hidden">
        <span className="text-slateText-muted font-medium">Search Scope:</span>
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-tint border border-border text-navy font-semibold max-w-[360px] truncate">
          {isIndividual ? (
            <>
              <FileText className="w-3.5 h-3.5 text-electric shrink-0" />
              <span className="truncate">{selectedDoc?.filename}</span>
              <span className="text-[10px] text-slateText-muted font-normal shrink-0">
                ({selectedDoc?.page_count}p)
              </span>
            </>
          ) : (
            <>
              <Layers className="w-3.5 h-3.5 text-navy shrink-0" />
              <span>All Documents ({documents.length})</span>
            </>
          )}
        </div>
      </div>

      {isIndividual && (
        <button
          type="button"
          onClick={onClearScope}
          className="inline-flex items-center gap-1 text-electric hover:text-electric-hover font-semibold text-xs cursor-pointer focus-visible:outline-electric"
          title="Switch to searching across all documents"
        >
          <span>Switch to All Documents</span>
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};
