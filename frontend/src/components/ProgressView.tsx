"use client";

import { useEffect, useState } from "react";

import { Icon, type IconName } from "@/components/Icon";
import { STAGE_ORDER, formatElapsed, stageLabel, truncateMiddle } from "@/lib/format";

interface ProgressViewProps {
  filename: string;
  stage: string;
  progress: number;
  /** Epoch ms when the job was submitted; drives the elapsed-time counter. */
  startedAt: number;
  status: "queued" | "processing";
}

const STAGE_ICONS: Record<string, IconName> = {
  extracting_frames: "video",
  visual_analysis: "eye",
  audio_analysis: "waveform",
  lipsync_analysis: "lips",
  fusion: "layers",
};

/** Rough remaining time from the observed rate so far. */
function estimateRemaining(elapsedMs: number, progress: number): string | null {
  if (progress < 8 || progress >= 100 || elapsedMs < 1500) return null;
  const total = (elapsedMs / progress) * 100;
  const remaining = Math.max(0, total - elapsedMs);
  if (remaining < 1000) return "almost done";
  return `~${formatElapsed(remaining)} left`;
}

export function ProgressView({
  filename,
  stage,
  progress,
  startedAt,
  status,
}: ProgressViewProps): JSX.Element {
  const [elapsed, setElapsed] = useState(() => Date.now() - startedAt);

  useEffect(() => {
    setElapsed(Date.now() - startedAt);
    const timer = window.setInterval(() => setElapsed(Date.now() - startedAt), 500);
    return () => window.clearInterval(timer);
  }, [startedAt]);

  const currentIndex = STAGE_ORDER.indexOf(stage as (typeof STAGE_ORDER)[number]);
  const eta = estimateRemaining(elapsed, progress);

  return (
    <section
      className="card overflow-hidden animate-fade-up"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="relative p-6 sm:p-8">
        <span
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-16 h-52 w-52 rounded-full bg-accent/10 blur-3xl"
        />

        <div className="relative flex flex-wrap items-start justify-between gap-5">
          <div className="min-w-0 flex-1">
            <span className="eyebrow">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-accent/40 animate-ping" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
              </span>
              {status === "queued" ? "Queued" : "Analysing"}
            </span>
            <h2 className="mt-3 truncate text-xl font-semibold tracking-tight text-fg sm:text-2xl" title={filename}>
              {truncateMiddle(filename, 46)}
            </h2>
            <p className="mt-1.5 text-sm text-muted">
              Running {stageLabel(stage).toLowerCase()} — you can leave this page open.
            </p>
          </div>

          <div className="text-right">
            <p className="font-mono text-4xl font-medium tabular-nums text-fg sm:text-5xl">
              {progress.toFixed(0)}
              <span className="text-2xl text-faint sm:text-3xl">%</span>
            </p>
            <p className="mt-1.5 flex items-center justify-end gap-1.5 text-xs tabular-nums text-faint">
              <Icon name="clock" className="h-3.5 w-3.5" />
              {formatElapsed(elapsed)}
              {eta && <span className="text-muted">· {eta}</span>}
            </p>
          </div>
        </div>

        <div
          className="mt-7 h-2.5 overflow-hidden rounded-full bg-panel2"
          role="progressbar"
          aria-valuenow={Math.round(progress)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Analysis progress"
        >
          <div
            className="relative h-full rounded-full bg-gradient-to-r from-accent to-accent2 transition-[width] duration-700 ease-out"
            style={{ width: `${Math.max(2, progress)}%` }}
          >
            <span className="absolute inset-0 overflow-hidden rounded-full">
              <span className="block h-full w-1/4 animate-shimmer bg-gradient-to-r from-transparent via-white/45 to-transparent" />
            </span>
          </div>
        </div>
      </div>

      <ol className="grid gap-px border-t border-line bg-line sm:grid-cols-2 lg:grid-cols-5">
        {STAGE_ORDER.map((key, index) => {
          const done = currentIndex > index || progress >= 100;
          const active = currentIndex === index;
          return (
            <li
              key={key}
              aria-current={active ? "step" : undefined}
              className={`flex items-center gap-2.5 px-4 py-3.5 transition-colors duration-300 ${
                active ? "bg-accent/[0.08]" : "bg-panel"
              }`}
            >
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors duration-300 ${
                  done
                    ? "bg-real/10 text-real"
                    : active
                      ? "bg-accent/15 text-accent"
                      : "bg-panel2 text-faint"
                }`}
              >
                {done ? (
                  <Icon name="check" className="h-3.5 w-3.5" weight={2.6} />
                ) : (
                  <Icon
                    name={STAGE_ICONS[key] ?? "layers"}
                    className={`h-3.5 w-3.5 ${active ? "animate-pulse" : ""}`}
                  />
                )}
              </span>
              <span
                className={`truncate text-xs font-medium ${
                  done ? "text-real" : active ? "text-fg" : "text-faint"
                }`}
              >
                {stageLabel(key)}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
