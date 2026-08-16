"use client";

import { useEffect, useState } from "react";

import { formatPercent } from "@/lib/format";
import type { Verdict } from "@/lib/types";

interface ConfidenceGaugeProps {
  /** 0-1 */
  value: number;
  verdict: Verdict;
  size?: number;
}

const SWEEP = 260; // degrees of arc
const RADIUS = 56;

/**
 * Radial gauge for the overall confidence, animated on mount.
 *
 * Colours come from the CSS palette variables rather than hardcoded hex so the
 * gauge follows the light/dark theme.
 */
export function ConfidenceGauge({
  value,
  verdict,
  size = 184,
}: ConfidenceGaugeProps): JSX.Element {
  const [displayed, setDisplayed] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => setDisplayed(value), 90);
    return () => window.clearTimeout(timer);
  }, [value]);

  const circumference = 2 * Math.PI * RADIUS;
  const arcLength = circumference * (SWEEP / 360);
  const stroke = verdict === "fake" ? "rgb(var(--fake))" : "rgb(var(--real))";
  const rotation = 90 + (360 - SWEEP) / 2;

  return (
    <div className="relative flex items-center justify-center">
      <svg
        width={size}
        height={size}
        viewBox="0 0 140 140"
        role="img"
        aria-label={`Confidence ${formatPercent(value)} that the verdict is ${verdict}`}
      >
        <defs>
          <linearGradient id="gauge-fill" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.45" />
            <stop offset="100%" stopColor={stroke} stopOpacity="1" />
          </linearGradient>
        </defs>

        <g transform={`rotate(${rotation} 70 70)`}>
          <circle
            cx="70"
            cy="70"
            r={RADIUS}
            fill="none"
            className="stroke-panel2"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${arcLength} ${circumference}`}
          />
          <circle
            cx="70"
            cy="70"
            r={RADIUS}
            fill="none"
            stroke="url(#gauge-fill)"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${arcLength * displayed} ${circumference}`}
            style={{ transition: "stroke-dasharray 1.2s cubic-bezier(0.16, 1, 0.3, 1)" }}
          />
        </g>
      </svg>

      {/* Centre readout as real text so it scales with the user's font settings. */}
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="font-mono text-[28px] font-medium leading-none tabular-nums"
          style={{ color: stroke }}
        >
          {formatPercent(value, 0)}
        </span>
        <span className="mt-1.5 text-[9.5px] font-semibold uppercase tracking-[0.18em] text-faint">
          Confidence
        </span>
      </div>
    </div>
  );
}
