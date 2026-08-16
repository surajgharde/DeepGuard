/** Display helpers shared across pages. */

import type { ModalityKey } from "@/lib/types";

export const STAGE_ORDER = [
  "extracting_frames",
  "visual_analysis",
  "audio_analysis",
  "lipsync_analysis",
  "fusion",
] as const;

const STAGE_LABELS: Record<string, string> = {
  queued: "Queued",
  extracting_frames: "Extracting frames",
  visual_analysis: "Visual analysis",
  audio_analysis: "Audio analysis",
  lipsync_analysis: "Lip-sync analysis",
  fusion: "Fusion",
  complete: "Complete",
  failed: "Failed",
};

export function stageLabel(stage: string): string {
  return STAGE_LABELS[stage] ?? stage.replace(/_/g, " ");
}

export const MODALITY_META: Record<
  ModalityKey,
  { title: string; branch: string; blurb: string }
> = {
  visual: {
    title: "Visual",
    branch: "EfficientNet-B0 on face crops",
    blurb: "Frame-level texture and blending artefacts",
  },
  audio: {
    title: "Audio",
    branch: "Wav2Vec2 embeddings + MLP",
    blurb: "Spectral and prosodic synthesis markers",
  },
  lipsync: {
    title: "Lip-sync",
    branch: "SyncNet-style AV sync scoring",
    blurb: "Alignment between lip motion and speech",
  },
};

export const MODALITY_KEYS: readonly ModalityKey[] = ["visual", "audio", "lipsync"];

export function formatPercent(value: number, digits = 1): string {
  return `${(value * 100).toFixed(digits)}%`;
}

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const size = bytes / 1024 ** exponent;
  return `${size.toFixed(exponent === 0 ? 0 : 1)} ${units[exponent] ?? "B"}`;
}

/** Backend timestamps are UTC; SQLite may return them without an offset. */
export function parseIso(iso: string): Date {
  return new Date(iso.endsWith("Z") || /[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`);
}

export function formatDate(iso: string): string {
  const date = parseIso(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatRelative(iso: string): string {
  const date = parseIso(iso);
  const seconds = (Date.now() - date.getTime()) / 1000;
  if (Number.isNaN(seconds)) return "";
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} h ago`;
  return `${Math.floor(seconds / 86400)} d ago`;
}

export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export interface ScoreTone {
  /** Text colour class. */
  text: string;
  /** Solid fill for progress bars. */
  bar: string;
  /** Tinted background for icon chips. */
  soft: string;
  /** Border colour class for outlined surfaces. */
  border: string;
  /** One-word plain-English reading of the score. */
  word: string;
  /** CSS colour expression, for SVG and inline styles. */
  css: string;
}

/** Colour ramp for a manipulation score: low = clean (green), high = fake (red). */
export function scoreTone(score: number): ScoreTone {
  if (score < 0.35) {
    return {
      text: "text-real",
      bar: "bg-real",
      soft: "bg-real/10",
      border: "border-real/35",
      word: "Clean",
      css: "rgb(var(--real))",
    };
  }
  if (score < 0.65) {
    return {
      text: "text-warn",
      bar: "bg-warn",
      soft: "bg-warn/10",
      border: "border-warn/35",
      word: "Unclear",
      css: "rgb(var(--warn))",
    };
  }
  return {
    text: "text-fake",
    bar: "bg-fake",
    soft: "bg-fake/10",
    border: "border-fake/35",
    word: "Suspect",
    css: "rgb(var(--fake))",
  };
}

/** Turns a 0-1 confidence into wording a non-specialist can act on. */
export function confidenceWording(confidence: number): string {
  if (confidence >= 0.9) return "Very high certainty";
  if (confidence >= 0.75) return "High certainty";
  if (confidence >= 0.6) return "Moderate certainty";
  return "Low certainty — treat as inconclusive";
}

export function truncateMiddle(text: string, max = 34): string {
  if (text.length <= max) return text;
  const half = Math.floor((max - 1) / 2);
  return `${text.slice(0, half)}…${text.slice(text.length - half)}`;
}
