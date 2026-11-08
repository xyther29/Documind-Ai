import React, { useState, useRef, useEffect } from "react";
import { Trash2 } from "lucide-react";
import type { DocumentMeta } from "../types/api";
import { formatBytes, formatDate } from "../lib/utils";
import { useReducedMotion } from "../hooks/useReducedMotion";

export interface DocumentCardProps {
  document: DocumentMeta;
  isSelected: boolean;
  onSelect: (docId: string) => void;
  onDelete: (docId: string, filename: string) => Promise<void>;
}

const MAX_TILT_DEG = 3.5;

export const DocumentCard: React.FC<DocumentCardProps> = ({
  document: doc,
  isSelected,
  onSelect,
  onDelete,
}) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const cardRef = useRef<HTMLDivElement>(null);
  const isReducedMotion = useReducedMotion();

  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;

    if (isReducedMotion) {
      card.style.setProperty("--tilt-x", "0deg");
      card.style.setProperty("--tilt-y", "0deg");
      card.style.setProperty("--sheen-opacity", "0");
      card.style.willChange = "auto";
      return;
    }

    let rafId: number | null = null;

    const handlePointerEnter = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      card.style.willChange = "transform";
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;

      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }

      rafId = requestAnimationFrame(() => {
        const rect = card.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;

        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const normX = Math.max(-1, Math.min(1, (x / rect.width) * 2 - 1));
        const normY = Math.max(-1, Math.min(1, (y / rect.height) * 2 - 1));

        const rotateX = (-normY * MAX_TILT_DEG).toFixed(2);
        const rotateY = (normX * MAX_TILT_DEG).toFixed(2);
        const sheenX = (((normX + 1) / 2) * 100).toFixed(1);
        const sheenY = (((normY + 1) / 2) * 100).toFixed(1);

        card.style.setProperty("--tilt-x", `${rotateX}deg`);
        card.style.setProperty("--tilt-y", `${rotateY}deg`);
        card.style.setProperty("--sheen-x", `${sheenX}%`);
        card.style.setProperty("--sheen-y", `${sheenY}%`);
        card.style.setProperty("--sheen-opacity", "1");

        rafId = null;
      });
    };

    const handlePointerLeave = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }

      card.style.willChange = "auto";
      card.style.setProperty("--tilt-x", "0deg");
      card.style.setProperty("--tilt-y", "0deg");
      card.style.setProperty("--sheen-opacity", "0");
    };

    card.addEventListener("pointerenter", handlePointerEnter);
    card.addEventListener("pointermove", handlePointerMove, { passive: true });
    card.addEventListener("pointerleave", handlePointerLeave, { passive: true });
    card.addEventListener("pointercancel", handlePointerLeave, { passive: true });

    return () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      card.style.willChange = "auto";
      card.removeEventListener("pointerenter", handlePointerEnter);
      card.removeEventListener("pointermove", handlePointerMove);
      card.removeEventListener("pointerleave", handlePointerLeave);
      card.removeEventListener("pointercancel", handlePointerLeave);
    };
  }, [isReducedMotion]);

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
      ref={cardRef}
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
      style={{
        transform: isReducedMotion
          ? "none"
          : "perspective(1000px) rotateX(var(--tilt-x, 0deg)) rotateY(var(--tilt-y, 0deg)) translateZ(0)",
        touchAction: "pan-y",
        transition: isReducedMotion
          ? "none"
          : "transform 0.35s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.18s cubic-bezier(0.2, 0, 0, 1), background-color 0.18s cubic-bezier(0.2, 0, 0, 1), box-shadow 0.18s cubic-bezier(0.2, 0, 0, 1)",
      }}
      className={`group relative border rounded-lg p-3 text-left cursor-pointer select-none overflow-hidden ${
        isSelected
          ? "border-electric bg-selection shadow-sm border-l-4 border-l-electric"
          : "border-border bg-surface hover:border-border-secondary hover:shadow-card"
      }`}
    >
      {/* Specular sheen overlay */}
      {!isReducedMotion && (
        <div
          aria-hidden="true"
          style={{
            background:
              "radial-gradient(circle at var(--sheen-x, 50%) var(--sheen-y, 50%), rgba(255, 255, 255, 0.35) 0%, rgba(255, 255, 255, 0) 60%)",
            opacity: "var(--sheen-opacity, 0)",
            transition: "opacity 0.25s ease",
          }}
          className="pointer-events-none absolute inset-0 z-10 rounded-lg"
        />
      )}

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
