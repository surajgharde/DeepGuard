import type { JobStatus, Verdict } from "@/lib/types";

interface VerdictBadgeProps {
  verdict: Verdict | null;
  status: JobStatus;
}

export function VerdictBadge({ verdict, status }: VerdictBadgeProps): JSX.Element {
  if (status === "failed") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-fake/30 bg-fake/10 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider text-fake">
        Failed
      </span>
    );
  }

  if (status !== "done" || !verdict) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-line2 bg-panel2 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider text-muted">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent2" />
        {status === "queued" ? "Queued" : "Running"}
      </span>
    );
  }

  const isFake = verdict === "fake";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider ${
        isFake
          ? "border-fake/35 bg-fake/10 text-fake"
          : "border-real/35 bg-real/10 text-real"
      }`}
    >
      {isFake ? "Fake" : "Real"}
    </span>
  );
}
