import React, { useState } from "react";
import { Trash2 } from "lucide-react";
import type { DocumentMeta } from "../types/api";
import { formatBytes, formatDate } from "../lib/utils";

interface DocumentCardProps {
  document: DocumentMeta;
  isSelected: boolean;
  onSelect: (docId: string) => void;
  onDelete: (docId: string, filename: string) => Promise<void>;
}

export const DocumentCard: React.FC<DocumentCardProps> = ({
  document: doc,
  isSelected,
  onSelect,
  onDelete,
}) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  async function handleDeleteClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }

    setIsDeleting(true);
    try {
      await onDelete(doc.doc_id, doc.filename);
    } catch (_) {
      setIsDeleting(false);
      setConfirmingDelete(false);
    }
  }

  function handleCancelDelete(e: React.MouseEvent) {
    e.stopPropagation();
    setConfirmingDelete(false);
  }

  return (
    <div
      role="radio"
      aria-checked={isSelected}
      tabIndex={0}
      onClick={() => onSelect(doc.doc_id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(doc.doc_id);
        }
      }}
      className={`group relative border rounded-lg p-3 transition text-left cursor-pointer select-none ${
        isSelected
          ? "border-electric bg-selection shadow-sm border-l-4 border-l-electric"
          : "border-border bg-surface hover:border-border-secondary hover:shadow-card hover:-translate-y-0.5"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0 flex-1">
          <span className="shrink-0 px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide bg-coral-subtle text-coral-dark border border-coral/30 rounded mt-0.5">
            PDF
          </span>
          <div className="min-w-0 flex-1">
            <h3
              className="text-xs font-semibold text-slateText-primary truncate leading-tight"
              title={doc.filename}
            >
              {doc.filename}
            </h3>
            <span className="text-[10px] text-slateText-muted block mt-0.5">
              Added {formatDate(doc.created_at)}
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
          {confirmingDelete ? (
            <div className="flex items-center gap-1 bg-coral-subtle border border-coral/30 rounded px-1.5 py-0.5 text-[10px]">
              <span className="text-coral-dark font-medium">Delete?</span>
              <button
                type="button"
                onClick={handleDeleteClick}
                disabled={isDeleting}
                className="text-white bg-coral hover:bg-coral-dark px-1.5 py-0.5 rounded font-bold transition"
                title="Confirm deletion"
              >
                Yes
              </button>
              <button
                type="button"
                onClick={handleCancelDelete}
                className="text-slateText-secondary hover:text-navy px-1 py-0.5 rounded font-medium"
                title="Cancel deletion"
              >
                No
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleDeleteClick}
              className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 text-slateText-muted hover:text-coral-dark hover:bg-coral-subtle rounded transition"
              title={`Delete ${doc.filename} from memory`}
              aria-label={`Delete ${doc.filename}`}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Metadata Chips */}
      <div className="flex items-center gap-1.5 mt-2.5 flex-wrap text-[11px]">
        <span className="px-2 py-0.5 rounded bg-tint border border-border text-slateText-secondary font-medium">
          {doc.page_count} page{doc.page_count === 1 ? "" : "s"}
        </span>
        <span className="px-2 py-0.5 rounded bg-teal-subtle text-teal-dark border border-teal/20 font-medium">
          {doc.chunk_count} chunk{doc.chunk_count === 1 ? "" : "s"}
        </span>
        <span className="px-2 py-0.5 rounded bg-slate-100 text-slateText-muted border border-slate-200 font-mono text-[10px]">
          {formatBytes(doc.file_size_bytes)}
        </span>
      </div>
    </div>
  );
};
