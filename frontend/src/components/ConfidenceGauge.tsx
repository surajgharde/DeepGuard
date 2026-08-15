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

const SWEEP = 270; // degrees of arc
const RADIUS = 54;

/** Radial gauge for the overall confidence, animated on mount. */
export function ConfidenceGauge({
  value,
  verdict,
  size = 168,
}: ConfidenceGaugeProps): JSX.Element {
  const [displayed, setDisplayed] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => setDisplayed(value), 80);
    return () => window.clearTimeout(timer);
  }, [value]);

  const circumference = 2 * Math.PI * RADIUS;
  const arcLength = circumference * (SWEEP / 360);
  const color = verdict === "fake" ? "#f43f5e" : "#10b981";

  return (
    <div className="flex flex-col items-center">
      <svg
        width={size}
        height={size}
        viewBox="0 0 140 140"
        role="img"
        aria-label={`Confidence ${formatPercent(value)}`}
      >
        <defs>
          <linearGradient id="gauge-gradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.55" />
            <stop offset="100%" stopColor={color} />
          </linearGradient>
        </defs>

        <g transform="rotate(135 70 70)">
          <circle
            cx="70"
            cy="70"
            r={RADIUS}
            fill="none"
            stroke="#1d2836"
            strokeWidth="11"
            strokeLinecap="round"
            strokeDasharray={`${arcLength} ${circumference}`}
          />
          <circle
            cx="70"
            cy="70"
            r={RADIUS}
            fill="none"
            stroke="url(#gauge-gradient)"
            strokeWidth="11"
            strokeLinecap="round"
            strokeDasharray={`${arcLength * displayed} ${circumference}`}
            style={{ transition: "stroke-dasharray 1.1s cubic-bezier(0.16, 1, 0.3, 1)" }}
          />
        </g>

        <text
          x="70"
          y="68"
          textAnchor="middle"
          className="fill-fg font-mono"
          style={{ fontSize: "26px" }}
        >
          {formatPercent(value, 0)}
        </text>
        <text
          x="70"
          y="88"
          textAnchor="middle"
          className="fill-current text-faint"
          style={{ fontSize: "10px", letterSpacing: "0.16em" }}
        >
          CONFIDENCE
        </text>
      </svg>
    </div>
  );
}
