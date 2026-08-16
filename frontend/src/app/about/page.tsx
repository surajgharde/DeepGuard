import type { Metadata } from "next";
import Link from "next/link";

import { Icon, type IconName } from "@/components/Icon";

export const metadata: Metadata = {
  title: "Method",
  description:
    "How DeepGuard combines visual, audio and lip-sync evidence to detect manipulated video.",
};

const BRANCHES: { name: string; model: string; icon: IconName; body: string }[] = [
  {
    name: "Visual branch",
    model: "EfficientNet-B0",
    icon: "eye",
    body:
      "Faces are detected and cropped frame by frame, then classified by an EfficientNet-B0 " +
      "backbone fine-tuned on manipulated and authentic face crops. It responds to blending " +
      "seams, inconsistent skin texture and frequency artefacts left by generative models. " +
      "Grad-CAM is used to expose which regions drove each frame-level decision.",
  },
  {
    name: "Audio branch",
    model: "Wav2Vec2 + MLP",
    icon: "waveform",
    body:
      "The audio track is embedded with a pre-trained Wav2Vec2 encoder and classified by a " +
      "lightweight MLP head. Synthetic and converted speech tends to leave characteristic " +
      "traces in the spectral envelope, formant transitions and periodicity that survive " +
      "re-encoding.",
  },
  {
    name: "Lip-sync branch",
    model: "SyncNet-style AV scoring",
    icon: "lips",
    body:
      "A SyncNet-style two-stream network compares short windows of mouth-region video " +
      "against the corresponding audio to score audio-visual alignment. Face-swap and " +
      "voice-cloning pipelines frequently break this coupling even when each stream looks " +
      "convincing in isolation.",
  },
];

const READING_GUIDE = [
  {
    term: "Modality score",
    definition:
      "P(manipulated) for that branch, 0–100%. Higher means stronger manipulation evidence from that signal alone.",
  },
  {
    term: "Confidence",
    definition:
      "How certain the fusion classifier is in the verdict it reported — not the probability that the clip is fake.",
  },
  {
    term: "Disagreement",
    definition:
      "When one branch objects and two do not, treat the result as inconclusive rather than as a weak positive.",
  },
];

export default function AboutPage(): JSX.Element {
  return (
    <div className="stack-page">
      <header className="max-w-3xl space-y-4">
        <span className="eyebrow">
          <Icon name="book" className="h-3 w-3 text-accent" weight={2} />
          Method
        </span>
        <h1 className="text-3xl font-bold leading-tight tracking-tight text-fg sm:text-4xl">
          A multimodal approach to deepfake detection
        </h1>
        <p className="text-base leading-relaxed text-muted">
          Single-modality detectors generalise poorly: a visual model can be defeated by heavy
          compression, and an audio model says nothing about a face swap over genuine speech.
          DeepGuard instead scores a clip along three independent axes — appearance, voice and the
          alignment between them — and fuses those signals into one verdict. Because each branch
          reports its own score and rationale, a result is interpretable: you can see whether the
          evidence came from pixels, from the waveform, or from the mismatch between them.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        {BRANCHES.map((branch) => (
          <article key={branch.name} className="card-interactive flex flex-col gap-4 p-6">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent/10 text-accent">
              <Icon name={branch.icon} className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-base font-semibold text-fg">{branch.name}</h2>
              <p className="mt-1 font-mono text-[11px] text-accent">{branch.model}</p>
            </div>
            <p className="text-sm leading-relaxed text-muted">{branch.body}</p>
          </article>
        ))}
      </section>

      <section className="card p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
            <Icon name="layers" className="h-5 w-5" />
          </span>
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-fg">Fusion and calibration</h2>
            <p className="max-w-3xl text-sm leading-relaxed text-muted">
              The three branch scores are combined by a fusion classifier that learns how much to
              trust each modality given their agreement pattern. The output is a single probability
              of manipulation, reported as a verdict plus a confidence value. Disagreement between
              branches is not hidden — it is surfaced in the per-modality cards, since a clip where
              only the lip-sync branch objects tells a very different story from one where all
              three agree.
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="section-title">Reading a result</h2>
        <dl className="grid gap-4 sm:grid-cols-3">
          {READING_GUIDE.map((entry) => (
            <div key={entry.term} className="card p-5">
              <dt className="text-sm font-semibold text-fg">{entry.term}</dt>
              <dd className="mt-2 text-sm leading-relaxed text-muted">{entry.definition}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="rounded-2xl border border-warn/30 bg-warn/[0.06] p-6">
        <div className="flex items-start gap-3.5">
          <Icon name="alert" className="mt-0.5 h-5 w-5 shrink-0 text-warn" />
          <div>
            <h2 className="text-sm font-semibold text-warn">Scope and limitations</h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">
              DeepGuard is a dissertation prototype. Scores are indicative rather than forensic
              proof, performance degrades on heavily compressed or very short clips, and results
              should always be read alongside provenance and contextual evidence. While the mock
              pipeline is active, all scores shown in the interface are synthetic and must not be
              cited as experimental results.
            </p>
          </div>
        </div>
      </section>

      <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-panel p-6">
        <div>
          <p className="text-sm font-semibold text-fg">Ready to try it?</p>
          <p className="mt-1 text-sm text-muted">
            Upload a clip and watch all three branches run in real time.
          </p>
        </div>
        <Link href="/" className="btn-primary">
          <Icon name="upload" className="h-4 w-4" weight={2} />
          Analyze a video
        </Link>
      </section>
    </div>
  );
}
