"use client";

import { useEffect, useState } from "react";

import { MODALITY_META, formatPercent, scoreTone } from "@/lib/format";
import type { ModalityKey, ModalityScore } from "@/lib/types";

interface ModalityCardProps {
  branch: ModalityKey;
  data: ModalityScore;
  /** Stagger the bar animation across the three cards. */
  delayMs?: number;
}

const ICONS: Record<ModalityKey, string> = {
  visual:
    "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  audio: "M12 2v20M7 6v12M17 6v12M2.5 9.5v5M21.5 9.5v5",
  lipsync: "M4 12s3-4 8-4 8 4 8 4-3 4-8 4-8-4-8-4Z M8 12h8",
};

export function ModalityCard({ branch, data, delayMs = 0 }: ModalityCardProps): JSX.Element {
  const [width, setWidth] = useState(0);
  const meta = MODALITY_META[branch];
  const tone = scoreTone(data.score);

  useEffect(() => {
    const timer = window.setTimeout(() => setWidth(data.score), 120 + delayMs);
    return () => window.clearTimeout(timer);
  }, [data.score, delayMs]);

  return (
    <article className="flex flex-col gap-4 rounded-2xl border border-line bg-panel p-5 transition-colors hover:border-line2">
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className={`flex h-9 w-9 items-center justify-center rounded-xl bg-panel2 ${tone.text}`}>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d={ICONS[branch]} />
            </svg>
          </span>
          <div>
            <h3 className="text-base font-medium text-fg">{meta.title}</h3>
            <p className="text-[11px] text-faint">{meta.branch}</p>
          </div>
        </div>
        <span className={`font-mono text-lg tabular-nums ${tone.text}`}>
          {formatPercent(data.score, 0)}
        </span>
      </header>

      <div>
        <div className="h-2 overflow-hidden rounded-full bg-panel2">
          <div
            className={`h-full rounded-full ${tone.bar}`}
            style={{
              width: `${Math.max(2, width * 100)}%`,
              transition: "width 1s cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px] text-faint">
          <span>authentic</span>
          <span className={tone.text}>{data.label}</span>
          <span>manipulated</span>
        </div>
      </div>

      <p className="text-sm leading-relaxed text-muted">{data.explanation}</p>
      <p className="mt-auto border-t border-line pt-3 text-[11px] text-faint">{meta.blurb}</p>
    </article>
  );
}
