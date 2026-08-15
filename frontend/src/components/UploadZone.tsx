"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { ACCEPT_ATTRIBUTE, ALLOWED_EXTENSIONS, MAX_UPLOAD_BYTES, MAX_UPLOAD_MB } from "@/lib/config";
import { formatBytes } from "@/lib/format";

interface UploadZoneProps {
  file: File | null;
  disabled: boolean;
  onSelect: (file: File) => void;
  onClear: () => void;
  onReject: (reason: string) => void;
}

function validate(file: File): string | null {
  const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    return `Unsupported format "${extension || "unknown"}". Allowed: ${ALLOWED_EXTENSIONS.join(", ")}.`;
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return `"${file.name}" is ${formatBytes(file.size)} — the limit is ${MAX_UPLOAD_MB} MB.`;
  }
  if (file.size === 0) return "That file is empty.";
  return null;
}

export function UploadZone({
  file,
  disabled,
  onSelect,
  onClear,
  onReject,
}: UploadZoneProps): JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const accept = useCallback(
    (candidate: File | undefined) => {
      if (!candidate) return;
      const problem = validate(candidate);
      if (problem) {
        onReject(problem);
        return;
      }
      onSelect(candidate);
    },
    [onReject, onSelect],
  );

  const handleDrop = (event: React.DragEvent<HTMLDivElement>): void => {
    event.preventDefault();
    setDragging(false);
    if (disabled) return;
    accept(event.dataTransfer.files[0]);
  };

  if (file && previewUrl) {
    return (
      <div className="animate-fade-up overflow-hidden rounded-2xl border border-line bg-panel">
        <div className="grid gap-0 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          <div className="relative aspect-video bg-black">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video
              src={previewUrl}
              controls
              className="h-full w-full object-contain"
              preload="metadata"
            />
          </div>
          <div className="flex flex-col justify-between gap-6 p-6">
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.18em] text-faint">Selected file</p>
              <p className="break-all text-lg font-medium text-fg">{file.name}</p>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-faint">Size</dt>
                  <dd className="text-muted">{formatBytes(file.size)}</dd>
                </div>
                <div>
                  <dt className="text-faint">Type</dt>
                  <dd className="text-muted">{file.type || "unknown"}</dd>
                </div>
              </dl>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={onClear}
                disabled={disabled}
                className="rounded-lg border border-line px-4 py-2 text-sm text-muted transition-colors hover:border-line2 hover:text-fg disabled:opacity-40"
              >
                Choose another
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(event) => {
        if (!disabled && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          inputRef.current?.click();
        }
      }}
      role="button"
      tabIndex={0}
      aria-label="Upload a video for analysis"
      className={`group relative flex cursor-pointer flex-col items-center justify-center gap-5 rounded-2xl border-2 border-dashed px-6 py-16 text-center transition-all sm:py-24 ${
        dragging
          ? "border-accent bg-accent/5"
          : "border-line bg-panel/50 hover:border-line2 hover:bg-panel"
      } ${disabled ? "pointer-events-none opacity-50" : ""}`}
    >
      <span className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-line2 bg-panel2 text-accent2">
        {dragging && (
          <span className="absolute inset-0 rounded-2xl border border-accent animate-pulse-ring" />
        )}
        <svg
          className="h-7 w-7"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 16V4m0 0L8 8m4-4 4 4" />
          <path d="M20 16v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2" />
        </svg>
      </span>

      <div className="space-y-2">
        <p className="text-lg font-medium text-fg">
          Drop a video here, or <span className="text-accent2 underline-offset-4 group-hover:underline">browse</span>
        </p>
        <p className="text-sm text-muted">
          {ALLOWED_EXTENSIONS.join(", ").toUpperCase().replace(/\./g, "")} · up to {MAX_UPLOAD_MB} MB
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_ATTRIBUTE}
        className="hidden"
        onChange={(event) => {
          accept(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
    </div>
  );
}
