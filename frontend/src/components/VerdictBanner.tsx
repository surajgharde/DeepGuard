import { formatPercent } from "@/lib/format";
import type { Verdict } from "@/lib/types";

interface VerdictBannerProps {
  verdict: Verdict;
  confidence: number;
  filename: string;
}

export function VerdictBanner({
  verdict,
  confidence,
  filename,
}: VerdictBannerProps): JSX.Element {
  const isFake = verdict === "fake";

  return (
    <section
      className={`animate-fade-up relative overflow-hidden rounded-2xl border p-7 sm:p-9 ${
        isFake ? "border-fake/40 bg-fake/[0.07]" : "border-real/40 bg-real/[0.07]"
      }`}
      aria-live="polite"
    >
      <div
        className={`pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full blur-3xl ${
          isFake ? "bg-fake/20" : "bg-real/20"
        }`}
      />

      <div className="relative flex flex-wrap items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <span
            className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border ${
              isFake ? "border-fake/40 bg-fake/15 text-fake" : "border-real/40 bg-real/15 text-real"
            }`}
          >
            <svg
              className="h-8 w-8"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
              {isFake ? <path d="m14.5 9.5-5 5m0-5 5 5" /> : <path d="m9 12 2 2 4-4" />}
            </svg>
          </span>

          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-faint">Overall verdict</p>
            <h1
              className={`mt-1 text-4xl font-semibold tracking-tight sm:text-5xl ${
                isFake ? "text-fake" : "text-real"
              }`}
            >
              {isFake ? "FAKE" : "REAL"}
            </h1>
            <p className="mt-2 max-w-xl text-sm text-muted">
              {isFake
                ? "Multimodal evidence indicates this clip has been manipulated."
                : "No consistent manipulation evidence was found across the three branches."}
            </p>
          </div>
        </div>

        <div className="text-right">
          <p className="text-xs uppercase tracking-[0.2em] text-faint">Confidence</p>
          <p
            className={`mt-1 font-mono text-4xl tabular-nums ${isFake ? "text-fake" : "text-real"}`}
          >
            {formatPercent(confidence)}
          </p>
          <p className="mt-2 max-w-[16rem] truncate text-xs text-faint" title={filename}>
            {filename}
          </p>
        </div>
      </div>
    </section>
  );
}
