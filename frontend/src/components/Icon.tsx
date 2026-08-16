/**
 * One stroke-based icon set for the whole app.
 *
 * Keeping the paths in a single map means every icon shares the same grid,
 * stroke width and join style — previously each component inlined its own SVG
 * with slightly different weights.
 */

export type IconName =
  | "shield"
  | "shield-check"
  | "shield-alert"
  | "upload"
  | "video"
  | "eye"
  | "waveform"
  | "lips"
  | "layers"
  | "check"
  | "close"
  | "alert"
  | "info"
  | "trash"
  | "download"
  | "arrow-left"
  | "arrow-right"
  | "chevron-down"
  | "menu"
  | "sun"
  | "moon"
  | "monitor"
  | "copy"
  | "clock"
  | "history"
  | "book"
  | "sparkle"
  | "expand"
  | "refresh"
  | "file";

const PATHS: Record<IconName, string[]> = {
  shield: ["M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"],
  "shield-check": ["M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z", "m9 12 2 2 4-4"],
  "shield-alert": ["M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z", "M12 8v4.5", "M12 16h.01"],
  upload: ["M12 16V4", "m8 8 4-4 4 4", "M20 16v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2"],
  video: ["M2 6a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6Z", "m15 10 7-4v12l-7-4"],
  eye: ["M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z", "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"],
  waveform: ["M12 3v18", "M7.5 7v10", "M17 7v10", "M3 10.5v3", "M21 10.5v3"],
  lips: ["M4 12s3-4.5 8-4.5S20 12 20 12s-3 4.5-8 4.5S4 12 4 12Z", "M7.5 12h9"],
  layers: ["m12 3 9 5-9 5-9-5 9-5Z", "m3 13 9 5 9-5", "m3 17 9 5 9-5"],
  check: ["M20 6 9 17l-5-5"],
  close: ["M18 6 6 18", "m6 6 12 12"],
  alert: ["M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z", "M12 9v4", "M12 17h.01"],
  info: ["M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z", "M12 16v-4.5", "M12 8h.01"],
  trash: ["M3 6h18", "M8 6V4h8v2", "m19 6-1 14H6L5 6", "M10 11v6", "M14 11v6"],
  download: ["M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4", "m7 10 5 5 5-5", "M12 15V3"],
  "arrow-left": ["M19 12H5", "m12 19-7-7 7-7"],
  "arrow-right": ["M5 12h14", "m12 5 7 7-7 7"],
  "chevron-down": ["m6 9 6 6 6-6"],
  menu: ["M3 6h18", "M3 12h18", "M3 18h18"],
  sun: [
    "M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z",
    "M12 2v2",
    "M12 20v2",
    "m4.9 4.9 1.5 1.5",
    "m17.6 17.6 1.5 1.5",
    "M2 12h2",
    "M20 12h2",
    "m4.9 19.1 1.5-1.5",
    "m17.6 6.4 1.5-1.5",
  ],
  moon: ["M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"],
  monitor: ["M3 5a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5Z", "M8 20h8", "M12 16v4"],
  copy: ["M9 9a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2V9Z", "M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"],
  clock: ["M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z", "M12 6.5V12l3.5 2"],
  history: ["M3 12a9 9 0 1 0 2.6-6.4", "M3 4v4h4", "M12 7.5V12l3.5 2"],
  book: ["M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5Z", "M8 7h7", "M8 11h7"],
  sparkle: ["m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Z", "M19 15.5 19.8 18l2.2.8-2.2.8L19 22l-.8-2.4-2.2-.8 2.2-.8.8-2.4Z"],
  expand: ["M15 3h6v6", "M9 21H3v-6", "M21 3l-7 7", "M3 21l7-7"],
  refresh: ["M21 12a9 9 0 1 1-2.6-6.4", "M21 4v4h-4"],
  file: ["M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z", "M14 3v5h5"],
};

interface IconProps {
  name: IconName;
  className?: string;
  /** Stroke width on the 24px grid. */
  weight?: number;
  title?: string;
}

export function Icon({ name, className = "h-5 w-5", weight = 1.8, title }: IconProps): JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={weight}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {title && <title>{title}</title>}
      {PATHS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
