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

/** Colour ramp for a manipulation score: low = clean (green), high = fake (red). */
export function scoreTone(score: number): { text: string; bar: string; ring: string } {
  if (score < 0.35) return { text: "text-real", bar: "bg-real", ring: "#10b981" };
  if (score < 0.65) return { text: "text-warn", bar: "bg-warn", ring: "#f59e0b" };
  return { text: "text-fake", bar: "bg-fake", ring: "#f43f5e" };
}

export function truncateMiddle(text: string, max = 34): string {
  if (text.length <= max) return text;
  const half = Math.floor((max - 1) / 2);
  return `${text.slice(0, half)}…${text.slice(text.length - half)}`;
}
