"use client";

import { useEffect, useState } from "react";

import { STAGE_ORDER, formatElapsed, stageLabel, truncateMiddle } from "@/lib/format";

interface ProgressViewProps {
  filename: string;
  stage: string;
  progress: number;
  /** Epoch ms when the job was submitted; drives the elapsed-time counter. */
  startedAt: number;
  status: "queued" | "processing";
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
    const timer = window.setInterval(() => setElapsed(Date.now() - startedAt), 500);
    return () => window.clearInterval(timer);
  }, [startedAt]);

  const currentIndex = STAGE_ORDER.indexOf(stage as (typeof STAGE_ORDER)[number]);

  return (
    <section className="animate-fade-up rounded-2xl border border-line bg-panel p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.18em] text-faint">
            {status === "queued" ? "Queued" : "Analysing"}
          </p>
          <h2 className="mt-1 truncate text-xl font-medium text-fg" title={filename}>
            {truncateMiddle(filename, 48)}
          </h2>
        </div>
        <div className="text-right">
          <p className="font-mono text-3xl tabular-nums text-fg">{progress.toFixed(0)}%</p>
          <p className="mt-1 text-sm text-faint tabular-nums">elapsed {formatElapsed(elapsed)}</p>
        </div>
      </div>

      <div className="mt-6 h-2.5 overflow-hidden rounded-full bg-panel2">
        <div
          className="relative h-full rounded-full bg-gradient-to-r from-accent to-accent2 transition-[width] duration-700 ease-out"
          style={{ width: `${Math.max(2, progress)}%` }}
        >
          <span className="absolute inset-0 overflow-hidden rounded-full">
            <span className="block h-full w-1/3 animate-shimmer bg-gradient-to-r from-transparent via-white/35 to-transparent" />
          </span>
        </div>
      </div>

      <p className="mt-4 text-sm text-muted">
        Current stage: <span className="text-fg">{stageLabel(stage)}</span>
      </p>

      <ol className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {STAGE_ORDER.map((key, index) => {
          const done = currentIndex > index || progress >= 100;
          const active = currentIndex === index;
          return (
            <li
              key={key}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-xs transition-colors ${
                active
                  ? "border-accent/50 bg-accent/10 text-fg"
                  : done
                    ? "border-real/30 bg-real/5 text-real"
                    : "border-line bg-panel2/50 text-faint"
              }`}
            >
              <span
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                  done ? "border-real bg-real/20" : active ? "border-accent" : "border-line2"
                }`}
              >
                {done ? (
                  <svg
                    className="h-2.5 w-2.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                ) : active ? (
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
                ) : null}
              </span>
              <span className="truncate">{stageLabel(key)}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
