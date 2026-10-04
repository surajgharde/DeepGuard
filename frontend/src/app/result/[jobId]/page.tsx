"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

import { ConfidenceGauge } from "@/components/ConfidenceGauge";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DownloadReportButton } from "@/components/DownloadReportButton";
import { GradCamStrip } from "@/components/GradCamStrip";
import { Icon } from "@/components/Icon";
import { MethodNotice } from "@/components/MethodNotice";
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
  const [confirming, setConfirming] = useState(false);
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
      setConfirming(false);
    }
  };

  const copyLink = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Link copied to clipboard.");
    } catch {
      toast.error("Could not access the clipboard.");
    }
  };

  if (loading && !job) return <SkeletonResult />;

  if (!job) {
    return (
      <StateCard
        icon="alert"
        title={error ? "Could not load this analysis" : "Analysis not found"}
        body={error ?? "This job no longer exists — it may have been deleted."}
        action={
          <>
            <button type="button" onClick={refresh} className="btn-secondary">
              <Icon name="refresh" className="h-4 w-4" />
              Retry
            </button>
            <Link href="/history" className="btn-primary">
              Back to history
            </Link>
          </>
        }
      />
    );
  }

  if (job.status === "failed") {
    return (
      <>
        <StateCard
          icon="alert"
          tone="fake"
          title="Analysis failed"
          body={job.error ?? "The pipeline stopped unexpectedly."}
          action={
            <>
              <Link href="/" className="btn-primary">
                <Icon name="upload" className="h-4 w-4" weight={2} />
                Try another video
              </Link>
              <button type="button" onClick={() => setConfirming(true)} className="btn-secondary">
                Delete job
              </button>
            </>
          }
        />
        <ConfirmDialog
          open={confirming}
          title="Delete this analysis?"
          body="The job record and any stored files are removed from the server. This cannot be undone."
          detail={job.filename}
          confirmLabel="Delete permanently"
          busy={deleting}
          onConfirm={() => void handleDelete()}
          onCancel={() => setConfirming(false)}
        />
      </>
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
      {/* --------------------------------------------------------- action bar */}
      <div className="sticky top-16 z-30 -mx-5 flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3 glass sm:-mx-8 sm:px-8">
        <BackLink />
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void copyLink()}
            className="btn-secondary"
            title="Copy a link to this result"
          >
            <Icon name="copy" className="h-4 w-4" />
            <span className="hidden sm:inline">Copy link</span>
          </button>
          <DownloadReportButton job={job} />
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="btn-icon border border-line hover:border-fake/50 hover:bg-fake/10 hover:text-fake"
            aria-label="Delete this analysis"
            title="Delete this analysis"
          >
            <Icon name="trash" className="h-4 w-4" />
          </button>
        </div>
      </div>

      <VerdictBanner
        verdict={result.verdict}
        confidence={result.confidence}
        filename={job.filename}
      />

      <MethodNotice modelVersion={result.model_version} />

      {/* ------------------------------------------------------ gauge + source */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,330px)_minmax(0,1fr)]">
        <section className="card flex flex-col gap-5 p-6">
          <h2 className="section-title">Overall confidence</h2>
          <div className="flex justify-center py-1">
            <ConfidenceGauge value={result.confidence} verdict={result.verdict} />
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-4 border-t border-line pt-5">
            <Stat label="Clip length" value={`${result.duration_seconds.toFixed(1)} s`} />
            <Stat label="Frames analysed" value={String(result.frames_analyzed)} />
            <Stat label="Inference" value={`${(result.processing_time_ms / 1000).toFixed(1)} s`} />
            <Stat label="File size" value={formatBytes(job.size_bytes)} />
          </dl>
        </section>

        <section className="card flex flex-col overflow-hidden">
          <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-3">
            <h2 className="section-title">Source clip</h2>
            <span className="truncate text-xs text-faint" title={job.filename}>
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
              className="aspect-video w-full flex-1 bg-black object-contain"
            />
          ) : (
            <div className="relative flex aspect-video w-full flex-1 items-center justify-center bg-black">
              {job.thumbnail_url && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={job.thumbnail_url}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover opacity-25"
                />
              )}
              <p className="relative max-w-xs px-6 text-center text-sm text-white/70">
                Source video is not stored for this record (seeded demo entry).
              </p>
            </div>
          )}
        </section>
      </div>

      {/* ------------------------------------------------------------ branches */}
      <section className="space-y-4">
        <SectionHeading
          title="Per-modality breakdown"
          hint="higher score = stronger manipulation evidence"
        />
        <div className="grid gap-4 md:grid-cols-3">
          {MODALITY_KEYS.map((key, index) => {
            const modality = result.modalities[key];
            if (!modality) return null;
            return <ModalityCard key={key} branch={key} data={modality} delayMs={index * 130} />;
          })}
        </div>
      </section>

      {/* ------------------------------------------------------- artefact map */}
      <section className="space-y-4">
        <SectionHeading
          title="Artefact map"
          hint="measured suspicion per region — click to enlarge"
        />
        <GradCamStrip frames={result.gradcam_frames} />
      </section>

      {/* ------------------------------------------------------------ metadata */}
      <section className="card p-5 sm:p-6">
        <h2 className="section-title">Run metadata</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Job ID" value={job.job_id.slice(0, 8)} mono />
          <Stat label="Submitted" value={formatDate(job.created_at)} />
          <Stat label="Completed" value={job.completed_at ? formatDate(job.completed_at) : "—"} />
          <Stat label="Model version" value={result.model_version} mono />
        </dl>
        {result.notes && (
          <p className="mt-5 border-t border-line pt-4 text-xs leading-relaxed text-faint">
            {result.notes}
          </p>
        )}
      </section>

      <ConfirmDialog
        open={confirming}
        title="Delete this analysis?"
        body="The job record, the uploaded video and every generated Grad-CAM frame are removed from the server. This cannot be undone."
        detail={job.filename}
        confirmLabel="Delete permanently"
        busy={deleting}
        onConfirm={() => void handleDelete()}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}

function SectionHeading({ title, hint }: { title: string; hint: string }): JSX.Element {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <h2 className="section-title">{title}</h2>
      <p className="text-xs text-faint">{hint}</p>
    </div>
  );
}

function BackLink(): JSX.Element {
  return (
    <Link
      href="/history"
      className="group inline-flex items-center gap-2 rounded-lg text-sm font-medium text-muted transition-colors hover:text-fg"
    >
      <Icon
        name="arrow-left"
        className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-0.5"
      />
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
    <div className="min-w-0">
      <dt className="text-[10.5px] font-semibold uppercase tracking-wider text-faint">{label}</dt>
      <dd
        className={`mt-1 truncate text-sm font-medium text-fg ${mono ? "font-mono" : ""}`}
        title={value}
      >
        {value}
      </dd>
    </div>
  );
}

function StateCard({
  icon,
  title,
  body,
  action,
  tone = "neutral",
}: {
  icon: "alert" | "info";
  title: string;
  body: string;
  action: JSX.Element;
  tone?: "neutral" | "fake";
}): JSX.Element {
  const danger = tone === "fake";
  return (
    <div
      className={`mx-auto max-w-xl rounded-2xl border p-8 text-center shadow-soft animate-fade-up sm:p-10 ${
        danger ? "border-fake/35 bg-fake/[0.06]" : "card"
      }`}
    >
      <span
        className={`mx-auto flex h-12 w-12 items-center justify-center rounded-2xl ${
          danger ? "bg-fake/10 text-fake" : "bg-panel2 text-muted"
        }`}
      >
        <Icon name={icon} className="h-5 w-5" />
      </span>
      <h1 className="mt-5 text-xl font-semibold text-fg">{title}</h1>
      <p className="mx-auto mt-2.5 max-w-md text-sm leading-relaxed text-muted">{body}</p>
      <div className="mt-7 flex flex-wrap justify-center gap-3">{action}</div>
    </div>
  );
}

function SkeletonResult(): JSX.Element {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading analysis">
      <div className="skeleton h-10 w-40 rounded-xl" />
      <div className="skeleton h-40" />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,330px)_minmax(0,1fr)]">
        <div className="skeleton h-[22rem]" />
        <div className="skeleton h-[22rem]" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {[0, 1, 2].map((index) => (
          <div key={index} className="skeleton h-56" />
        ))}
      </div>
    </div>
  );
}
