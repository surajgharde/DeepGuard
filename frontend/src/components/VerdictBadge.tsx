import { Icon } from "@/components/Icon";
import type { JobStatus, Verdict } from "@/lib/types";

interface VerdictBadgeProps {
  verdict: Verdict | null;
  status: JobStatus;
  size?: "sm" | "md";
}

export function VerdictBadge({ verdict, status, size = "sm" }: VerdictBadgeProps): JSX.Element {
  const padding = size === "md" ? "px-3 py-1.5 text-xs" : "px-2.5 py-1 text-[11px]";
  const base = `inline-flex items-center gap-1.5 rounded-full border font-semibold uppercase tracking-wider backdrop-blur ${padding}`;

  if (status === "failed") {
    return (
      <span className={`${base} border-fake/35 bg-fake/10 text-fake`}>
        <Icon name="close" className="h-3 w-3" weight={2.6} />
        Failed
      </span>
    );
  }

  if (status !== "done" || !verdict) {
    return (
      <span className={`${base} border-line2 bg-panel2/90 text-muted`}>
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full rounded-full bg-accent/50 animate-ping" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
        </span>
        {status === "queued" ? "Queued" : "Running"}
      </span>
    );
  }

  const isFake = verdict === "fake";
  return (
    <span
      className={`${base} ${
        isFake ? "border-fake/35 bg-fake/10 text-fake" : "border-real/35 bg-real/10 text-real"
      }`}
    >
      <Icon
        name={isFake ? "shield-alert" : "shield-check"}
        className="h-3 w-3"
        weight={2.4}
      />
      {isFake ? "Fake" : "Real"}
    </span>
  );
}
