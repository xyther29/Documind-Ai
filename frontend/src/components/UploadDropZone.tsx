import React, { useRef, useState } from "react";
import { UploadCloud, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { uploadDocument, type UploadProgress, type AuthMode } from "../lib/api";
import { formatBytes } from "../lib/utils";
import type { DocumentMeta } from "../types/api";

interface UploadDropZoneProps {
  onUploadSuccess: (newDoc: DocumentMeta) => void;
  disabled?: boolean;
  mode?: AuthMode;
}

export const UploadDropZone: React.FC<UploadDropZoneProps> = ({
  onUploadSuccess,
  disabled = false,
  mode,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [activeFile, setActiveFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successDoc, setSuccessDoc] = useState<DocumentMeta | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);

  const isUploading = progress?.phase === "uploading" || progress?.phase === "processing";

  async function handleFile(file: File) {
    if (disabled || isUploading) return;

    setErrorMessage(null);
    setSuccessDoc(null);
    setActiveFile(file);

    try {
      const uploadedDoc = await uploadDocument(
        file,
        (p) => {
          setProgress(p);
        },
        0,
        mode
      );

      setSuccessDoc(uploadedDoc);
      onUploadSuccess(uploadedDoc);

      // Auto-clear success banner after 5 seconds
      setTimeout(() => {
        setSuccessDoc((prev) => (prev?.doc_id === uploadedDoc.doc_id ? null : prev));
        setProgress(null);
        setActiveFile(null);
      }, 5000);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to upload document");
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  function onFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  }

  function onDragEnter(e: React.DragEvent) {
    e.preventDefault();
    dragCounterRef.current += 1;
    if (e.dataTransfer.types.includes("Files")) {
      setIsDragOver(true);
    }
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }

  function onDragLeave(e: React.DragEvent) {
    e.preventDefault();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setIsDragOver(false);
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    dragCounterRef.current = 0;
    setIsDragOver(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFile(file);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-bold uppercase tracking-wider text-navy">
          Upload Document
        </h2>
        <span className="text-[11px] text-slateText-muted">Max 10 MB PDF</span>
      </div>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={onFileInputChange}
        disabled={disabled || isUploading}
        aria-label="Select PDF file to upload"
      />

      {/* Drop Zone */}
      <div
        role="button"
        tabIndex={disabled || isUploading ? -1 : 0}
        onClick={() => {
          if (!disabled && !isUploading) fileInputRef.current?.click();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (!disabled && !isUploading) fileInputRef.current?.click();
          }
        }}
        onDragEnter={onDragEnter}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={`relative border-2 border-dashed rounded-lg p-5 text-center transition cursor-pointer select-none ${
          isDragOver
            ? "border-electric bg-selection shadow-[0_0_0_4px_rgba(52,120,246,0.15)] scale-[1.01]"
            : "border-border hover:border-electric/70 bg-surface hover:bg-tint"
        } ${isUploading ? "opacity-75 cursor-wait" : ""}`}
        aria-busy={isUploading}
      >
        <div className="flex flex-col items-center justify-center gap-2">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
              isDragOver ? "bg-electric text-white" : "bg-tint text-slateText-secondary"
            }`}
          >
            {isUploading ? (
              <Loader2 className="w-5 h-5 animate-spin text-electric" />
            ) : (
              <UploadCloud className="w-5 h-5" />
            )}
          </div>

          <div>
            <p className="text-xs font-semibold text-navy">
              {isDragOver ? "Drop PDF file here" : "Drag & drop PDF here, or click to browse"}
            </p>
            <p className="text-[11px] text-slateText-muted mt-0.5">
              Only text-based PDFs up to 10 MB are accepted
            </p>
          </div>
        </div>
      </div>

      {/* Upload Progress & Processing Status Card */}
      {isUploading && progress && activeFile && (
        <div className="bg-surface border border-border rounded p-3 shadow-sm animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="font-semibold text-navy truncate max-w-[200px]" title={activeFile.name}>
              {activeFile.name}
            </span>
            <span className="font-mono text-electric font-bold text-[11px]">
              {progress.phase === "uploading" ? `${progress.percent}%` : "Processing"}
            </span>
          </div>

          {/* Progress Bar Track */}
          <div className="h-1.5 bg-border rounded-full overflow-hidden relative">
            {progress.phase === "uploading" ? (
              <div
                className="h-full bg-electric transition-all duration-150 rounded-full"
                style={{ width: `${progress.percent}%` }}
              />
            ) : (
              /* Indeterminate Server-side Chunking Bar */
              <div className="h-full bg-amber rounded-full animate-pulse w-full" />
            )}
          </div>

          <div className="flex items-center gap-1.5 mt-2 text-[11px] text-slateText-secondary font-medium">
            {progress.phase === "processing" ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin text-amber" />
                <span>Extracting pages and building TF-IDF chunk index...</span>
              </>
            ) : (
              <span>{progress.message || `Uploading ${formatBytes(activeFile.size)}...`}</span>
            )}
          </div>
        </div>
      )}

      {/* Success Notification */}
      {successDoc && (
        <div className="p-3 bg-teal-subtle border border-teal/30 rounded text-teal-dark text-xs flex items-start gap-2 shadow-sm animate-in fade-in duration-200">
          <CheckCircle2 className="w-4 h-4 text-teal shrink-0 mt-0.5" />
          <div className="flex-1">
            <strong className="block font-semibold">
              {successDoc.filename} uploaded successfully
            </strong>
            <span className="text-[11px] text-teal-dark/90">
              {successDoc.page_count} page{successDoc.page_count === 1 ? "" : "s"} · {successDoc.chunk_count} passage chunks indexed
            </span>
          </div>
        </div>
      )}

      {/* Error Notification */}
      {errorMessage && (
        <div className="p-3 bg-coral-subtle border border-coral/30 rounded text-coral-dark text-xs flex items-start gap-2 shadow-sm animate-in fade-in duration-200">
          <AlertTriangle className="w-4 h-4 text-coral shrink-0 mt-0.5" />
          <div className="flex-1">
            <strong className="block font-semibold">Upload failed</strong>
            <span className="text-[11px] text-coral-dark/90">{errorMessage}</span>
          </div>
        </div>
      )}
    </div>
  );
};
