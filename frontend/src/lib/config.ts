/** Client configuration, entirely env-driven (see .env.example). */

function readEnv(value: string | undefined, fallback: string): string {
  return value && value.trim().length > 0 ? value.trim() : fallback;
}

export const API_BASE_URL = readEnv(
  process.env.NEXT_PUBLIC_API_URL,
  "http://localhost:8000",
).replace(/\/+$/, "");

export const POLL_INTERVAL_MS = Number.parseInt(
  readEnv(process.env.NEXT_PUBLIC_POLL_INTERVAL_MS, "2000"),
  10,
);

export const MAX_UPLOAD_MB = Number.parseInt(
  readEnv(process.env.NEXT_PUBLIC_MAX_UPLOAD_MB, "100"),
  10,
);

export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

export const ALLOWED_EXTENSIONS: readonly string[] = readEnv(
  process.env.NEXT_PUBLIC_ALLOWED_EXTENSIONS,
  ".mp4,.avi,.mov",
)
  .split(",")
  .map((item) => item.trim().toLowerCase())
  .filter(Boolean);

export const ACCEPT_ATTRIBUTE = ALLOWED_EXTENSIONS.join(",");
