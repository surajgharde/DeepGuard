"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { ProgressView } from "@/components/ProgressView";
import { useToast } from "@/components/ToastProvider";
import { UploadZone } from "@/components/UploadZone";
import { useJobPolling } from "@/hooks/useJobPolling";
import { errorMessage, uploadVideo } from "@/lib/api";
import { MAX_UPLOAD_MB } from "@/lib/config";

const PIPELINE_STEPS = [
  {
    title: "Visual branch",
    detail: "EfficientNet-B0 over detected face crops, frame by frame.",
  },
  {
    title: "Audio branch",
    detail: "Wav2Vec2 embeddings classified by a lightweight MLP head.",
  },
  {
    title: "Lip-sync branch",
    detail: "SyncNet-style scoring of audio-visual alignment.",
  },
  {
    title: "Fusion",
    detail: "Branch scores combined into a single calibrated verdict.",
  },
] as const;

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

  const running = jobId !== null && (job === null || job.status === "queued" || job.status === "processing");

  return (
    <div className="space-y-10">
      <section className="max-w-2xl space-y-4">
        <p className="section-title">Analyze</p>
        <h1 className="text-3xl font-semibold tracking-tight text-fg sm:text-4xl">
          Is this video authentic?
        </h1>
        <p className="text-base leading-relaxed text-muted">
          Upload a clip and DeepGuard runs three independent detectors — visual artefacts, audio
          synthesis markers and lip-sync alignment — then fuses them into a single verdict with a
          per-modality breakdown.
        </p>
      </section>

      {running ? (
        <ProgressView
          filename={file?.name ?? job?.filename ?? "video"}
          stage={job?.stage ?? "queued"}
          progress={job?.progress ?? 0}
          startedAt={startedAtRef.current}
          status={job?.status === "processing" ? "processing" : "queued"}
        />
      ) : (
        <section className="space-y-5">
          <UploadZone
            file={file}
            disabled={uploading}
            onSelect={setFile}
            onClear={reset}
            onReject={(reason) => toast.error(reason)}
          />

          {uploading && (
            <div className="rounded-xl border border-line bg-panel p-4">
              <div className="flex items-center justify-between text-sm text-muted">
                <span>Uploading…</span>
                <span className="font-mono tabular-nums">{uploadPercent}%</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-panel2">
                <div
                  className="h-full rounded-full bg-accent2 transition-[width] duration-200"
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
              {uploading ? "Uploading…" : "Analyze video"}
            </button>
            {file && (
              <button type="button" onClick={reset} disabled={uploading} className="btn-ghost">
                Reset
              </button>
            )}
            <p className="text-xs text-faint">
              MP4, AVI or MOV · max {MAX_UPLOAD_MB} MB · processed locally by your backend
            </p>
          </div>

          {job?.status === "failed" && (
            <div className="rounded-xl border border-fake/40 bg-fake/10 p-4 text-sm text-fake">
              Analysis failed: {job.error ?? "unknown error"}
            </div>
          )}
        </section>
      )}

      <section className="space-y-4">
        <h2 className="section-title">How it works</h2>
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {PIPELINE_STEPS.map((step, index) => (
            <li key={step.title} className="card p-5">
              <span className="font-mono text-xs text-accent2">
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-2 text-sm font-medium text-fg">{step.title}</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-muted">{step.detail}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
