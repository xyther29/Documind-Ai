import React from "react";
import { Layers, Loader2, AlertCircle, FilePlus2 } from "lucide-react";
import type { DocumentMeta } from "../types/api";
import { DocumentCard } from "./DocumentCard";

interface DocumentLibraryProps {
  documents: DocumentMeta[];
  selectedDocId: string | null;
  loading: boolean;
  error: string | null;
  onSelectScope: (docId: string | null) => void;
  onDeleteDocument: (docId: string, filename: string) => Promise<void>;
}

export const DocumentLibrary: React.FC<DocumentLibraryProps> = ({
  documents,
  selectedDocId,
  loading,
  error,
  onSelectScope,
  onDeleteDocument,
}) => {
  const isAllActive = selectedDocId === null;

  return (
    <div className="flex flex-col gap-3 flex-1 min-h-0">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-bold uppercase tracking-wider text-navy">
          Document Library
        </h2>
        <span className="text-[11px] font-semibold text-slateText-muted">
          {documents.length} in memory
        </span>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-3 bg-coral-subtle border border-coral/30 rounded text-coral-dark text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && documents.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-8 text-slateText-muted text-xs gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-electric" />
          <span>Loading documents...</span>
        </div>
      ) : documents.length === 0 ? (
        /* Empty State */
        <div className="flex flex-col items-center justify-center p-8 border border-dashed border-border rounded-lg bg-surface text-center">
          <div className="w-9 h-9 rounded-full bg-tint flex items-center justify-center text-slateText-muted mb-2">
            <FilePlus2 className="w-4 h-4" />
          </div>
          <p className="text-xs font-semibold text-navy">No documents in memory</p>
          <p className="text-[11px] text-slateText-muted mt-1 max-w-[200px]">
            Upload a PDF document above to start building your search corpus.
          </p>
        </div>
      ) : (
        /* Document Cards List */
        <div
          role="radiogroup"
          aria-label="Select document search scope"
          className="flex flex-col gap-2 overflow-y-auto flex-1 pr-0.5"
        >
          {/* Permanent "All Documents" Scope Card */}
          <div
            role="radio"
            aria-checked={isAllActive}
            tabIndex={0}
            onClick={() => onSelectScope(null)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelectScope(null);
              }
            }}
            className={`border rounded-lg p-3 transition text-left cursor-pointer select-none ${
              isAllActive
                ? "border-electric bg-selection shadow-sm border-l-4 border-l-electric"
                : "border-border bg-surface hover:border-border-secondary hover:shadow-card hover:-translate-y-0.5"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className={`w-6 h-6 rounded flex items-center justify-center ${
                    isAllActive
                      ? "bg-navy text-white"
                      : "bg-tint text-slateText-secondary"
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-navy">All Documents</h3>
                  <span className="text-[10px] text-slateText-muted block">
                    Search across full in-memory corpus
                  </span>
                </div>
              </div>
              <span
                className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                  isAllActive
                    ? "bg-navy text-white"
                    : "bg-tint text-navy border border-border"
                }`}
              >
                {documents.length} doc{documents.length === 1 ? "" : "s"}
              </span>
            </div>
          </div>

          {/* Individual Document Cards */}
          {documents.map((doc) => (
            <DocumentCard
              key={doc.doc_id}
              document={doc}
              isSelected={selectedDocId === doc.doc_id}
              onSelect={(id) => onSelectScope(id)}
              onDelete={onDeleteDocument}
            />
          ))}
        </div>
      )}
    </div>
  );
};
