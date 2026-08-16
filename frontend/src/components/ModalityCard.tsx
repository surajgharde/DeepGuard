"use client";

import { useEffect, useState } from "react";

import { Icon, type IconName } from "@/components/Icon";
import { MODALITY_META, formatPercent, scoreTone } from "@/lib/format";
import type { ModalityKey, ModalityScore } from "@/lib/types";

interface ModalityCardProps {
  branch: ModalityKey;
  data: ModalityScore;
  /** Stagger the bar animation across the three cards. */
  delayMs?: number;
}

const ICONS: Record<ModalityKey, IconName> = {
  visual: "eye",
  audio: "waveform",
  lipsync: "lips",
};

export function ModalityCard({ branch, data, delayMs = 0 }: ModalityCardProps): JSX.Element {
  const [width, setWidth] = useState(0);
  const meta = MODALITY_META[branch];
  const tone = scoreTone(data.score);

  useEffect(() => {
    const timer = window.setTimeout(() => setWidth(data.score), 140 + delayMs);
    return () => window.clearTimeout(timer);
  }, [data.score, delayMs]);

  return (
    <article className="card-interactive flex flex-col gap-4 p-5">
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className={`flex h-10 w-10 items-center justify-center rounded-xl ${tone.soft} ${tone.text}`}
          >
            <Icon name={ICONS[branch]} className="h-[18px] w-[18px]" />
          </span>
          <div>
            <h3 className="text-[15px] font-semibold text-fg">{meta.title}</h3>
            <p className="mt-0.5 text-[11px] text-faint">{meta.branch}</p>
          </div>
        </div>
        <div className="text-right">
          <span className={`font-mono text-xl font-medium tabular-nums ${tone.text}`}>
            {formatPercent(data.score, 0)}
          </span>
          <p className={`text-[10px] font-semibold uppercase tracking-wider ${tone.text}`}>
            {tone.word}
          </p>
        </div>
      </header>

      <div>
        <div
          className="h-2 overflow-hidden rounded-full bg-panel2"
          role="meter"
          aria-valuenow={Math.round(data.score * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${meta.title} manipulation score`}
        >
          <div
            className={`h-full rounded-full ${tone.bar}`}
            style={{
              width: `${Math.max(2, width * 100)}%`,
              transition: "width 1.1s cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-[10.5px] text-faint">
          <span>authentic</span>
          <span className={`font-medium ${tone.text}`}>{data.label}</span>
          <span>manipulated</span>
        </div>
      </div>

      <p className="text-sm leading-relaxed text-muted">{data.explanation}</p>
      <p className="mt-auto border-t border-line pt-3 text-[11px] leading-relaxed text-faint">
        {meta.blurb}
      </p>
    </article>
  );
}
