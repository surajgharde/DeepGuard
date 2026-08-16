import { Icon } from "@/components/Icon";
import { confidenceWording, formatPercent } from "@/lib/format";
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
  const tone = isFake ? "fake" : "real";

  return (
    <section
      className={`relative overflow-hidden rounded-2xl border p-6 shadow-soft animate-fade-up sm:p-9 ${
        isFake ? "border-fake/35 bg-fake/[0.06]" : "border-real/35 bg-real/[0.06]"
      }`}
      aria-live="polite"
    >
      <span
        aria-hidden
        className={`pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full blur-3xl ${
          isFake ? "bg-fake/20" : "bg-real/20"
        }`}
      />

      <div className="relative flex flex-col gap-7 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4 sm:items-center sm:gap-5">
          <span
            className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border sm:h-16 sm:w-16 ${
              isFake
                ? "border-fake/35 bg-fake/10 text-fake"
                : "border-real/35 bg-real/10 text-real"
            }`}
          >
            <Icon
              name={isFake ? "shield-alert" : "shield-check"}
              className="h-7 w-7 sm:h-8 sm:w-8"
              weight={1.9}
            />
          </span>

          <div className="min-w-0">
            <p className="section-title">Overall verdict</p>
            <h1
              className="mt-1 text-4xl font-bold tracking-tight sm:text-5xl"
              style={{ color: `rgb(var(--${tone}))` }}
            >
              {isFake ? "Likely fake" : "Likely authentic"}
            </h1>
            <p className="mt-2.5 max-w-xl text-sm leading-relaxed text-muted">
              {isFake
                ? "Multimodal evidence indicates this clip has been manipulated. Review the per-branch breakdown below to see where the evidence came from."
                : "No consistent manipulation evidence was found across the visual, audio and lip-sync branches."}
            </p>
          </div>
        </div>

        <div className="shrink-0 border-t border-line pt-5 sm:border-l sm:border-t-0 sm:pl-8 sm:pt-0 sm:text-right">
          <p className="section-title">Confidence</p>
          <p
            className="mt-1 font-mono text-4xl font-medium tabular-nums sm:text-5xl"
            style={{ color: `rgb(var(--${tone}))` }}
          >
            {formatPercent(confidence, 0)}
          </p>
          <p className="mt-1.5 text-xs font-medium text-muted">{confidenceWording(confidence)}</p>
          <p
            className="mt-2 max-w-[15rem] truncate text-xs text-faint sm:ml-auto"
            title={filename}
          >
            {filename}
          </p>
        </div>
      </div>
    </section>
  );
}
