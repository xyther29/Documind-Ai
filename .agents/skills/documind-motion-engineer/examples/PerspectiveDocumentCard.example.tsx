/**
 * Reference Implementation: PerspectiveDocumentCard.example.tsx
 * 
 * Demonstrates:
 * 1. Zero-dependency 3D perspective tilt driven by native Pointer Events.
 * 2. Dynamic specular sheen/glare reflection tracking the pointer.
 * 3. Zero React re-renders during mouse move (direct CSS custom property propagation).
 * 4. Full mouse, pen, and touch compatibility with passive listeners.
 * 5. Complete cleanup of requestAnimationFrame and event listeners on unmount.
 * 6. Native prefers-reduced-motion fallback to static elevation.
 * 7. DocuMind navy-and-white editorial design tokens.
 */

import React, { useRef, useEffect, useState, useCallback } from "react";
import { FileText, Sparkles, Layers } from "lucide-react";

export interface PerspectiveCardProps {
  title: string;
  pageCount: number;
  chunkCount: number;
  fileSizeBytes: number;
  maxTiltDeg?: number;
  className?: string;
  onClick?: () => void;
}

export const PerspectiveDocumentCard: React.FC<PerspectiveCardProps> = ({
  title,
  pageCount,
  chunkCount,
  fileSizeBytes,
  maxTiltDeg = 7.0,
  className = "",
  onClick,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isReducedMotion, setIsReducedMotion] = useState(false);

  // 1. Detect prefers-reduced-motion via matchMedia
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;

    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    setIsReducedMotion(mql.matches);

    const handler = (e: MediaQueryListEvent) => setIsReducedMotion(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  // 2. High-performance pointer tracking without React state updates
  useEffect(() => {
    const card = cardRef.current;
    if (!card || isReducedMotion) return;

    let rafId: number | null = null;

    const handlePointerMove = (e: PointerEvent) => {
      // Ignore touch gestures to preserve native fluid scrolling
      if (e.pointerType === "touch") return;

      if (rafId !== null) cancelAnimationFrame(rafId);

      rafId = requestAnimationFrame(() => {
        const rect = card.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;

        // Normalized relative coordinates: -1.0 to +1.0
        const normX = Math.max(-1, Math.min(1, ((e.clientX - rect.left) / rect.width) * 2 - 1));
        const normY = Math.max(-1, Math.min(1, ((e.clientY - rect.top) / rect.height) * 2 - 1));

        // Physics equations for 3D rotation & specular lighting
        const rotateX = (-normY * maxTiltDeg).toFixed(2);
        const rotateY = (normX * maxTiltDeg).toFixed(2);
        const sheenX = (((normX + 1) / 2) * 100).toFixed(1);
        const sheenY = (((normY + 1) / 2) * 100).toFixed(1);

        // Update CSS custom properties directly on the element style
        card.style.setProperty("--tilt-x", `${rotateX}deg`);
        card.style.setProperty("--tilt-y", `${rotateY}deg`);
        card.style.setProperty("--sheen-x", `${sheenX}%`);
        card.style.setProperty("--sheen-y", `${sheenY}%`);
        card.style.setProperty("--sheen-opacity", "0.14");
        card.style.setProperty("--card-shadow", "0 14px 28px rgba(20, 45, 78, 0.12), 0 4px 10px rgba(20, 45, 78, 0.06)");

        rafId = null;
      });
    };

    const handlePointerLeave = () => {
      if (rafId !== null) cancelAnimationFrame(rafId);

      // Smoothly spring back to rest position
      card.style.setProperty("--tilt-x", "0deg");
      card.style.setProperty("--tilt-y", "0deg");
      card.style.setProperty("--sheen-opacity", "0");
      card.style.setProperty("--card-shadow", "0 1px 3px rgba(20, 45, 78, 0.06)");
    };

    card.addEventListener("pointermove", handlePointerMove, { passive: true });
    card.addEventListener("pointerleave", handlePointerLeave, { passive: true });

    // Complete cleanup on unmount or mode switch
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      card.removeEventListener("pointermove", handlePointerMove);
      card.removeEventListener("pointerleave", handlePointerLeave);
    };
  }, [maxTiltDeg, isReducedMotion]);

  const formattedSize =
    fileSizeBytes < 1024 * 1024
      ? `${(fileSizeBytes / 1024).toFixed(1)} KB`
      : `${(fileSizeBytes / (1024 * 1024)).toFixed(1)} MB`;

  return (
    <div
      style={{ perspective: "1000px" }}
      className={`relative select-none ${className}`}
    >
      <div
        ref={cardRef}
        onClick={onClick}
        tabIndex={0}
        role="button"
        aria-label={`Document card: ${title}`}
        style={{
          transform: isReducedMotion
            ? "none"
            : "rotateX(var(--tilt-x, 0deg)) rotateY(var(--tilt-y, 0deg)) translateZ(0)",
          boxShadow: "var(--card-shadow, 0 1px 3px rgba(20, 45, 78, 0.06))",
          transition: isReducedMotion
            ? "none"
            : "transform 0.35s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.35s ease",
          touchAction: "pan-y",
        }}
        className="group relative overflow-hidden rounded-lg border border-[#D7E0EB] bg-white p-4 transition-colors hover:border-[#3478F6]/60 focus-visible:outline-2 focus-visible:outline-[#3478F6] focus-visible:outline-offset-2 cursor-pointer"
      >
        {/* Dynamic Specular Sheen (GPU accelerated radial gradient) */}
        {!isReducedMotion && (
          <div
            aria-hidden="true"
            style={{
              background:
                "radial-gradient(circle at var(--sheen-x, 50%) var(--sheen-y, 50%), rgba(255, 255, 255, 0.45) 0%, rgba(255, 255, 255, 0) 65%)",
              opacity: "var(--sheen-opacity, 0)",
              transition: "opacity 0.25s ease",
            }}
            className="pointer-events-none absolute inset-0 z-10"
          />
        )}

        {/* Card Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#EFF6FF] border border-[#3478F6]/20 text-[#3478F6] transition-transform duration-200 group-hover:scale-105">
              <FileText className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h4 className="truncate text-sm font-bold text-[#142D4E] group-hover:text-[#3478F6] transition-colors">
                {title}
              </h4>
              <span className="text-[11px] font-medium text-[#7E90A5]">
                {formattedSize}
              </span>
            </div>
          </div>

          <span className="inline-flex items-center gap-1 rounded bg-[#E6F6F5] border border-[#0F9D91]/20 px-2 py-0.5 font-mono text-[10px] font-bold text-[#0B7A70]">
            <Sparkles className="h-3 w-3 text-[#0F9D91]" />
            <span>Indexed</span>
          </span>
        </div>

        {/* Card Metrics Footer */}
        <div className="mt-4 flex items-center gap-4 border-t border-[#D7E0EB]/60 pt-3 text-xs text-[#586B80]">
          <div className="flex items-center gap-1.5 font-medium">
            <span className="text-[#142D4E] font-bold">{pageCount}</span>
            <span>pages</span>
          </div>
          <div className="flex items-center gap-1.5 font-medium">
            <Layers className="h-3.5 w-3.5 text-[#7E90A5]" />
            <span className="text-[#142D4E] font-bold">{chunkCount}</span>
            <span>chunks</span>
          </div>
        </div>
      </div>
    </div>
  );
};
