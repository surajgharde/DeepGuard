import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About",
  description:
    "How DeepGuard combines visual, audio and lip-sync evidence to detect manipulated video.",
};

const BRANCHES = [
  {
    name: "Visual branch",
    model: "EfficientNet-B0",
    body:
      "Faces are detected and cropped frame by frame, then classified by an EfficientNet-B0 " +
      "backbone fine-tuned on manipulated and authentic face crops. It responds to blending " +
      "seams, inconsistent skin texture and frequency artefacts left by generative models. " +
      "Grad-CAM is used to expose which regions drove each frame-level decision.",
  },
  {
    name: "Audio branch",
    model: "Wav2Vec2 + MLP",
    body:
      "The audio track is embedded with a pre-trained Wav2Vec2 encoder and classified by a " +
      "lightweight MLP head. Synthetic and converted speech tends to leave characteristic " +
      "traces in the spectral envelope, formant transitions and periodicity that survive " +
      "re-encoding.",
  },
  {
    name: "Lip-sync branch",
    model: "SyncNet-style AV scoring",
    body:
      "A SyncNet-style two-stream network compares short windows of mouth-region video " +
      "against the corresponding audio to score audio-visual alignment. Face-swap and " +
      "voice-cloning pipelines frequently break this coupling even when each stream looks " +
      "convincing in isolation.",
  },
] as const;

export default function AboutPage(): JSX.Element {
  return (
    <div className="space-y-12">
      <header className="max-w-3xl space-y-4">
        <p className="section-title">About</p>
        <h1 className="text-3xl font-semibold tracking-tight text-fg sm:text-4xl">
          A multimodal approach to deepfake detection
        </h1>
        <p className="text-base leading-relaxed text-muted">
          Single-modality detectors generalise poorly: a visual model can be defeated by heavy
          compression, and an audio model says nothing about a face swap over genuine speech.
          DeepGuard instead scores a clip along three independent axes — appearance, voice and
          the alignment between them — and fuses those signals into one verdict. Because each
          branch reports its own score and rationale, a result is interpretable: you can see
          whether the evidence came from pixels, from the waveform, or from the mismatch between
          them.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        {BRANCHES.map((branch) => (
          <article key={branch.name} className="card flex flex-col gap-3 p-6">
            <div>
              <h2 className="text-base font-medium text-fg">{branch.name}</h2>
              <p className="mt-1 font-mono text-[11px] text-accent2">{branch.model}</p>
            </div>
            <p className="text-sm leading-relaxed text-muted">{branch.body}</p>
          </article>
        ))}
      </section>

      <section className="card space-y-4 p-7">
        <h2 className="text-lg font-medium text-fg">Fusion and calibration</h2>
        <p className="max-w-3xl text-sm leading-relaxed text-muted">
          The three branch scores are combined by a fusion classifier that learns how much to
          trust each modality given their agreement pattern. The output is a single probability
          of manipulation, reported as a verdict plus a confidence value. Disagreement between
          branches is not hidden — it is surfaced in the per-modality cards, since a clip where
          only the lip-sync branch objects tells a very different story from one where all three
          agree.
        </p>
      </section>

      <section className="rounded-2xl border border-warn/30 bg-warn/[0.06] p-6">
        <h2 className="text-sm font-medium text-warn">Scope and limitations</h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">
          DeepGuard is a dissertation prototype. Scores are indicative rather than forensic
          proof, performance degrades on heavily compressed or very short clips, and results
          should always be read alongside provenance and contextual evidence. While the mock
          pipeline is active, all scores shown in the interface are synthetic and must not be
          cited as experimental results.
        </p>
      </section>
    </div>
  );
}
