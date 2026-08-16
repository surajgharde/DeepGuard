"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Icon, type IconName } from "@/components/Icon";
import { ProgressView } from "@/components/ProgressView";
import { useToast } from "@/components/ToastProvider";
import { UploadZone } from "@/components/UploadZone";
import { useJobPolling } from "@/hooks/useJobPolling";
import { errorMessage, uploadVideo } from "@/lib/api";
import { MAX_UPLOAD_MB } from "@/lib/config";

const PIPELINE_STEPS: { title: string; detail: string; icon: IconName }[] = [
  {
    title: "Visual",
    detail: "EfficientNet-B0 over detected face crops, frame by frame.",
    icon: "eye",
  },
  {
    title: "Audio",
    detail: "Wav2Vec2 embeddings classified by a lightweight MLP head.",
    icon: "waveform",
  },
  {
    title: "Lip-sync",
    detail: "SyncNet-style scoring of audio-visual alignment.",
    icon: "lips",
  },
  {
    title: "Fusion",
    detail: "Branch scores combined into a single calibrated verdict.",
    icon: "layers",
  },
];

export default function AnalyzePage(): JSX.Element {
  const router = useRouter();
  const toast = useToast();

  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadPercent, setUploadPercent] = useState(0);
  const [jobId, setJobId] = useState<string | null>(null);
  const startedAtRef = useRef<number>(Date.now());

  const { job, error } = useJobPolling(jobId);

  // Once inference completes, hand over to the full result page.
  useEffect(() => {
    if (!job) return;
    if (job.status === "done") {
      router.push(`/result/${job.job_id}`);
    } else if (job.status === "failed") {
      toast.error(job.error ?? "Analysis failed.");
    }
  }, [job, router, toast]);

  useEffect(() => {
    if (error) toast.error(error);
    // Only announce a polling error once per change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error]);

  const handleAnalyze = async (): Promise<void> => {
    if (!file) return;
    setUploading(true);
    setUploadPercent(0);
    try {
      const created = await uploadVideo(file, setUploadPercent);
      startedAtRef.current = Date.now();
      setJobId(created.job_id);
      toast.info("Upload complete — analysis started.");
    } catch (caught) {
      toast.error(errorMessage(caught));
    } finally {
      setUploading(false);
    }
  };

  const reset = (): void => {
    setFile(null);
    setJobId(null);
    setUploadPercent(0);
  };

  const running =
    jobId !== null && (job === null || job.status === "queued" || job.status === "processing");

  return (
    <div className="stack-page">
      {/* ---------------------------------------------------------------- hero */}
      <section className="relative overflow-hidden">
        <div className="max-w-2xl">
          <span className="eyebrow">
            <Icon name="sparkle" className="h-3 w-3 text-accent" weight={2} />
            Multimodal detection
          </span>
          <h1 className="mt-5 text-[2rem] font-bold leading-[1.1] tracking-tight text-fg sm:text-5xl">
            Is this video <span className="text-gradient">authentic</span>?
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-muted sm:text-[17px]">
            Upload a clip and DeepGuard runs three independent detectors — visual artefacts, audio
            synthesis markers and lip-sync alignment — then fuses them into one verdict with a
            per-modality breakdown you can actually read.
          </p>

          <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs text-faint">
            {[
              "Runs entirely on your own backend",
              "Grad-CAM evidence for every decision",
              "Exportable PDF report",
            ].map((point) => (
              <li key={point} className="flex items-center gap-1.5">
                <Icon name="check" className="h-3.5 w-3.5 text-real" weight={2.6} />
                {point}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ------------------------------------------------------ upload / progress */}
      {running ? (
        <ProgressView
          filename={file?.name ?? job?.filename ?? "video"}
          stage={job?.stage ?? "queued"}
          progress={job?.progress ?? 0}
          startedAt={startedAtRef.current}
          status={job?.status === "processing" ? "processing" : "queued"}
        />
      ) : (
        <section className="space-y-4">
          <UploadZone
            file={file}
            disabled={uploading}
            onSelect={setFile}
            onClear={reset}
            onReject={(reason) => toast.error(reason)}
          />

          {uploading && (
            <div className="card p-4 animate-fade-up">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-muted">
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-accent/25 border-t-accent" />
                  Uploading to backend…
                </span>
                <span className="font-mono tabular-nums text-fg">{uploadPercent}%</span>
              </div>
              <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-panel2">
                <div
                  className="h-full rounded-full bg-accent transition-[width] duration-200"
                  style={{ width: `${uploadPercent}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void handleAnalyze()}
              disabled={!file || uploading}
              className="btn-primary"
            >
              <Icon name="shield-check" className="h-4 w-4" weight={2.1} />
              {uploading ? "Uploading…" : "Analyze video"}
            </button>
            {file && !uploading && (
              <button type="button" onClick={reset} className="btn-ghost">
                Reset
              </button>
            )}
            <p className="text-xs text-faint">
              MP4, AVI or MOV · max {MAX_UPLOAD_MB} MB · nothing leaves your machine
            </p>
          </div>

          {!file && (
            <p className="text-xs text-faint">
              Nothing to analyse yet?{" "}
              <Link href="/history" className="text-accent underline-offset-4 hover:underline">
                Browse past analyses
              </Link>
              .
            </p>
          )}

          {job?.status === "failed" && (
            <div className="flex items-start gap-3 rounded-2xl border border-fake/35 bg-fake/[0.07] p-4 text-sm">
              <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0 text-fake" />
              <div>
                <p className="font-medium text-fake">Analysis failed</p>
                <p className="mt-1 text-muted">{job.error ?? "Unknown error."}</p>
              </div>
            </div>
          )}
        </section>
      )}

      {/* ------------------------------------------------------------ explainer */}
      <section className="space-y-5">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="section-title">How it works</h2>
          <Link
            href="/about"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-accent transition-colors hover:text-accent2"
          >
            Read the method
            <Icon name="arrow-right" className="h-3.5 w-3.5" />
          </Link>
        </div>

        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {PIPELINE_STEPS.map((step, index) => (
            <li key={step.title} className="card-interactive group p-5">
              <div className="flex items-center justify-between">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/10 text-accent transition-transform duration-300 ease-out group-hover:scale-110">
                  <Icon name={step.icon} className="h-[18px] w-[18px]" />
                </span>
                <span className="font-mono text-[11px] text-faint">
                  {String(index + 1).padStart(2, "0")}
                </span>
              </div>
              <h3 className="mt-3.5 text-sm font-semibold text-fg">{step.title}</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-muted">{step.detail}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
