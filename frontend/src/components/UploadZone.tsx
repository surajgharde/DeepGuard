"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Icon } from "@/components/Icon";
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
  const dragDepth = useRef(0);
  const [dragging, setDragging] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState<number | null>(null);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      setDuration(null);
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

  // dragenter/dragleave fire for every child element; a depth counter keeps the
  // highlight from flickering as the pointer crosses the inner nodes.
  const handleDragEnter = (event: React.DragEvent): void => {
    event.preventDefault();
    if (disabled) return;
    dragDepth.current += 1;
    setDragging(true);
  };

  const handleDragLeave = (event: React.DragEvent): void => {
    event.preventDefault();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragging(false);
  };

  const handleDrop = (event: React.DragEvent): void => {
    event.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    if (disabled) return;
    accept(event.dataTransfer.files[0]);
  };

  const hiddenInput = (
    <input
      ref={inputRef}
      type="file"
      accept={ACCEPT_ATTRIBUTE}
      className="sr-only"
      tabIndex={-1}
      onChange={(event) => {
        accept(event.target.files?.[0]);
        event.target.value = "";
      }}
    />
  );

  if (file && previewUrl) {
    return (
      <div className="card overflow-hidden animate-fade-up">
        <div className="grid md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <div className="relative aspect-video bg-black">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video
              src={previewUrl}
              controls
              preload="metadata"
              className="h-full w-full object-contain"
              onLoadedMetadata={(event) => {
                const value = event.currentTarget.duration;
                setDuration(Number.isFinite(value) ? value : null);
              }}
            />
            <span className="pointer-events-none absolute left-3 top-3 flex items-center gap-1.5 rounded-lg bg-black/65 px-2 py-1 text-[11px] font-medium text-white backdrop-blur">
              <Icon name="check" className="h-3 w-3" weight={2.6} />
              Ready
            </span>
          </div>

          <div className="flex flex-col justify-between gap-6 p-5 sm:p-6">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
                  <Icon name="file" className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="section-title">Selected file</p>
                  <p className="mt-1 break-all text-[15px] font-medium leading-snug text-fg">
                    {file.name}
                  </p>
                </div>
              </div>

              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-line pt-4 text-sm">
                <Meta label="Size" value={formatBytes(file.size)} />
                <Meta label="Type" value={file.type || "unknown"} />
                <Meta
                  label="Duration"
                  value={duration === null ? "—" : `${duration.toFixed(1)} s`}
                />
                <Meta label="Limit" value={`${MAX_UPLOAD_MB} MB`} />
              </dl>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={disabled}
                className="btn-secondary"
              >
                <Icon name="refresh" className="h-4 w-4" />
                Choose another
              </button>
              <button
                type="button"
                onClick={onClear}
                disabled={disabled}
                className="btn-ghost"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
        {hiddenInput}
      </div>
    );
  }

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(event) => {
        if (!disabled && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          inputRef.current?.click();
        }
      }}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label={`Upload a video for analysis. ${ALLOWED_EXTENSIONS.join(", ")}, up to ${MAX_UPLOAD_MB} megabytes.`}
      aria-disabled={disabled}
      className={`group relative flex cursor-pointer flex-col items-center justify-center gap-6 overflow-hidden rounded-2xl border-2 border-dashed px-6 py-14 text-center transition-all duration-300 ease-out sm:py-20 ${
        dragging
          ? "scale-[1.005] border-accent bg-accent/[0.07] shadow-glow"
          : "border-line2/70 bg-panel/60 hover:border-accent/50 hover:bg-panel"
      } ${disabled ? "pointer-events-none opacity-50" : ""}`}
    >
      {/* Soft aura that only shows while dragging. */}
      <span
        aria-hidden
        className={`pointer-events-none absolute inset-0 bg-gradient-to-br from-accent/10 via-transparent to-accent2/10 transition-opacity duration-300 ${
          dragging ? "opacity-100" : "opacity-0"
        }`}
      />

      <span className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-line bg-panel text-accent shadow-soft transition-transform duration-300 ease-out group-hover:-translate-y-0.5">
        {dragging && (
          <span className="absolute inset-0 rounded-2xl border-2 border-accent animate-pulse-ring" />
        )}
        <Icon name="upload" className="h-7 w-7" weight={1.7} />
      </span>

      <div className="relative space-y-2">
        <p className="text-lg font-medium text-fg sm:text-xl">
          {dragging ? (
            "Drop to upload"
          ) : (
            <>
              Drag a video here, or{" "}
              <span className="text-accent underline decoration-accent/40 underline-offset-4 transition-colors group-hover:decoration-accent">
                browse files
              </span>
            </>
          )}
        </p>
        <p className="text-sm text-muted">
          Three detectors run on it — visual, audio and lip-sync — then fuse into one verdict.
        </p>
      </div>

      <div className="relative flex flex-wrap items-center justify-center gap-2">
        {ALLOWED_EXTENSIONS.map((extension) => (
          <span key={extension} className="chip uppercase">
            {extension.replace(".", "")}
          </span>
        ))}
        <span className="chip">max {MAX_UPLOAD_MB} MB</span>
      </div>

      {hiddenInput}
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] uppercase tracking-wider text-faint">{label}</dt>
      <dd className="mt-0.5 truncate text-sm text-fg" title={value}>
        {value}
      </dd>
    </div>
  );
}
