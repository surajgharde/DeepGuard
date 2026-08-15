"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

import { ConfidenceGauge } from "@/components/ConfidenceGauge";
import { DownloadReportButton } from "@/components/DownloadReportButton";
import { GradCamStrip } from "@/components/GradCamStrip";
import { ModalityCard } from "@/components/ModalityCard";
import { ProgressView } from "@/components/ProgressView";
import { useToast } from "@/components/ToastProvider";
import { VerdictBanner } from "@/components/VerdictBanner";
import { useJobPolling } from "@/hooks/useJobPolling";
import { deleteJob, errorMessage } from "@/lib/api";
import { MODALITY_KEYS, formatBytes, formatDate, parseIso } from "@/lib/format";

export default function ResultPage(): JSX.Element {
  const params = useParams<{ jobId: string }>();
  const jobId = typeof params.jobId === "string" ? params.jobId : null;

  const router = useRouter();
  const toast = useToast();
  const { job, loading, error, refresh } = useJobPolling(jobId);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async (): Promise<void> => {
    if (!job) return;
    setDeleting(true);
    try {
      await deleteJob(job.job_id);
      toast.success("Analysis deleted.");
      router.push("/history");
    } catch (caught) {
      toast.error(errorMessage(caught));
      setDeleting(false);
    }
  };

  if (loading && !job) {
    return <SkeletonResult />;
  }

  if (!job) {
    return (
      <StateCard
        title={error ? "Could not load this analysis" : "Analysis not found"}
        body={error ?? "This job no longer exists — it may have been deleted."}
        action={
          <div className="flex gap-3">
            <button type="button" onClick={refresh} className="btn-ghost">
              Retry
            </button>
            <Link href="/history" className="btn-primary">
              Back to history
            </Link>
          </div>
        }
      />
    );
  }

  if (job.status === "failed") {
    return (
      <StateCard
        title="Analysis failed"
        body={job.error ?? "The pipeline stopped unexpectedly."}
        tone="fake"
        action={
          <div className="flex gap-3">
            <Link href="/" className="btn-primary">
              Try another video
            </Link>
            <button
              type="button"
              onClick={() => void handleDelete()}
              disabled={deleting}
              className="btn-ghost"
            >
              Delete job
            </button>
          </div>
        }
      />
    );
  }

  if (job.status !== "done" || !job.result) {
    return (
      <div className="space-y-6">
        <BackLink />
        <ProgressView
          filename={job.filename}
          stage={job.stage}
          progress={job.progress}
          startedAt={parseIso(job.created_at).getTime()}
          status={job.status === "processing" ? "processing" : "queued"}
        />
      </div>
    );
  }

  const result = job.result;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <BackLink />
        <div className="flex flex-wrap gap-3">
          <DownloadReportButton job={job} />
          <button
            type="button"
            onClick={() => void handleDelete()}
            disabled={deleting}
            className="btn-ghost"
          >
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>

      <VerdictBanner
        verdict={result.verdict}
        confidence={result.confidence}
        filename={job.filename}
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
        <section className="card flex flex-col items-center gap-5 p-6">
          <h2 className="section-title self-start">Overall confidence</h2>
          <ConfidenceGauge value={result.confidence} verdict={result.verdict} />
          <dl className="grid w-full grid-cols-2 gap-3 text-sm">
            <Stat label="Clip length" value={`${result.duration_seconds.toFixed(1)} s`} />
            <Stat label="Frames" value={String(result.frames_analyzed)} />
            <Stat label="Inference" value={`${(result.processing_time_ms / 1000).toFixed(1)} s`} />
            <Stat label="File size" value={formatBytes(job.size_bytes)} />
          </dl>
        </section>

        <section className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-5 py-3">
            <h2 className="section-title">Source clip</h2>
            <span className="truncate pl-4 text-xs text-faint" title={job.filename}>
              {job.filename}
            </span>
          </div>
          {job.video_url ? (
            /* eslint-disable-next-line jsx-a11y/media-has-caption */
            <video
              src={job.video_url}
              controls
              preload="metadata"
              poster={job.thumbnail_url ?? undefined}
              className="aspect-video w-full bg-black object-contain"
            />
          ) : (
            <div className="relative flex aspect-video w-full items-center justify-center bg-black">
              {job.thumbnail_url && (
                <img
                  src={job.thumbnail_url}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover opacity-30"
                />
              )}
              <p className="relative max-w-xs px-6 text-center text-sm text-muted">
                Source video is not stored for this record (seeded demo entry).
              </p>
            </div>
          )}
        </section>
      </div>

      <section className="space-y-4">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="section-title">Per-modality breakdown</h2>
          <p className="text-xs text-faint">higher score = stronger manipulation evidence</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {MODALITY_KEYS.map((key, index) => {
            const modality = result.modalities[key];
            if (!modality) return null;
            return (
              <ModalityCard key={key} branch={key} data={modality} delayMs={index * 120} />
            );
          })}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="section-title">Grad-CAM frames</h2>
          <p className="text-xs text-faint">regions influencing the visual decision</p>
        </div>
        <GradCamStrip frames={result.gradcam_frames} />
      </section>

      <section className="card p-5">
        <h2 className="section-title">Run metadata</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Job ID" value={job.job_id.slice(0, 8)} mono />
          <Stat label="Submitted" value={formatDate(job.created_at)} />
          <Stat
            label="Completed"
            value={job.completed_at ? formatDate(job.completed_at) : "—"}
          />
          <Stat label="Model version" value={result.model_version} mono />
        </dl>
        {result.notes && <p className="mt-5 text-xs leading-relaxed text-faint">{result.notes}</p>}
      </section>
    </div>
  );
}

function BackLink(): JSX.Element {
  return (
    <Link
      href="/history"
      className="inline-flex items-center gap-2 text-sm text-muted transition-colors hover:text-fg"
    >
      <svg
        className="h-4 w-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M19 12H5m0 0 7 7m-7-7 7-7" />
      </svg>
      All analyses
    </Link>
  );
}

function Stat({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}): JSX.Element {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wider text-faint">{label}</dt>
      <dd className={`mt-1 truncate text-sm text-fg ${mono ? "font-mono" : ""}`} title={value}>
        {value}
      </dd>
    </div>
  );
}

function StateCard({
  title,
  body,
  action,
  tone = "neutral",
}: {
  title: string;
  body: string;
  action: JSX.Element;
  tone?: "neutral" | "fake";
}): JSX.Element {
  return (
    <div
      className={`mx-auto max-w-xl rounded-2xl border p-8 text-center ${
        tone === "fake" ? "border-fake/40 bg-fake/[0.06]" : "border-line bg-panel"
      }`}
    >
      <h1 className="text-xl font-medium text-fg">{title}</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted">{body}</p>
      <div className="mt-6 flex justify-center">{action}</div>
    </div>
  );
}

function SkeletonResult(): JSX.Element {
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="h-32 animate-pulse rounded-2xl bg-panel" />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
        <div className="h-72 animate-pulse rounded-2xl bg-panel" />
        <div className="h-72 animate-pulse rounded-2xl bg-panel" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {[0, 1, 2].map((index) => (
          <div key={index} className="h-52 animate-pulse rounded-2xl bg-panel" />
        ))}
      </div>
    </div>
  );
}
