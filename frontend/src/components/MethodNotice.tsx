import { Icon } from "@/components/Icon";

interface MethodNoticeProps {
  /** `model_version` from the result payload, e.g. "heuristic-1.0.0". */
  modelVersion: string;
}

/**
 * States plainly how a result was produced.
 *
 * The scores on this page do not come from a trained detector, and a page full
 * of gauges and percentages implies one. This says so before the reader gets
 * to the verdict, rather than in small print underneath it.
 */
export function MethodNotice({ modelVersion }: MethodNoticeProps): JSX.Element | null {
  if (modelVersion.startsWith("mock-")) {
    return (
      <Notice
        tone="fake"
        title="Demo mode — these numbers are randomly generated"
        body="The mock pipeline never opens the video. Its verdict is a coin flip and its
              scores are drawn from a random distribution. Set DEEPGUARD_PIPELINE=heuristic
              to analyse the file for real."
      />
    );
  }

  if (modelVersion.startsWith("heuristic-")) {
    return (
      <Notice
        tone="warn"
        title="Heuristic signal analysis — not a trained detector"
        body="Every score here was measured from this file and is reproducible. But the
              decision thresholds are hand-set rather than learned from labelled deepfakes,
              so this result has no validated accuracy figure. Treat it as forensic evidence
              to weigh, not proof — and do not cite it as an experimental result."
      />
    );
  }

  return null;
}

function Notice({
  tone,
  title,
  body,
}: {
  tone: "warn" | "fake";
  title: string;
  body: string;
}): JSX.Element {
  const danger = tone === "fake";
  return (
    <aside
      className={`flex gap-3.5 rounded-xl border p-4 sm:p-5 ${
        danger ? "border-fake/40 bg-fake/[0.07]" : "border-warn/40 bg-warn/[0.07]"
      }`}
    >
      <Icon
        name="alert"
        className={`mt-0.5 h-5 w-5 shrink-0 ${danger ? "text-fake" : "text-warn"}`}
      />
      <div className="min-w-0">
        <p className={`text-sm font-semibold ${danger ? "text-fake" : "text-warn"}`}>{title}</p>
        <p className="mt-1.5 text-xs leading-relaxed text-muted">{body}</p>
      </div>
    </aside>
  );
}
