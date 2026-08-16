"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Icon } from "@/components/Icon";
import { useToast } from "@/components/ToastProvider";
import { VerdictBadge } from "@/components/VerdictBadge";
import { deleteJob, errorMessage, getHistory } from "@/lib/api";
import { formatBytes, formatDate, formatPercent, formatRelative } from "@/lib/format";
import type { HistoryPage as HistoryPageData, HistoryItem } from "@/lib/types";

const PAGE_SIZE = 9;

export default function HistoryPage(): JSX.Element {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [data, setData] = useState<HistoryPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [target, setTarget] = useState<HistoryItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async (target: number) => {
    setLoading(true);
    try {
      const result = await getHistory(target, PAGE_SIZE);
      setData(result);
      setError(null);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(page);
  }, [load, page]);

  const confirmDelete = async (): Promise<void> => {
    if (!target) return;
    setDeleting(true);
    try {
      await deleteJob(target.job_id);
      toast.success(`Deleted "${target.filename}".`);
      setTarget(null);
      const remaining = (data?.items.length ?? 1) - 1;
      if (remaining === 0 && page > 1) setPage((current) => current - 1);
      else await load(page);
    } catch (caught) {
      toast.error(errorMessage(caught));
    } finally {
      setDeleting(false);
    }
  };

  const summary = data
    ? {
        real: data.items.filter((item) => item.verdict === "real").length,
        fake: data.items.filter((item) => item.verdict === "fake").length,
        failed: data.items.filter((item) => item.status === "failed").length,
      }
    : null;

  return (
    <div className="stack-page">
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div className="space-y-3">
          <span className="eyebrow">
            <Icon name="history" className="h-3 w-3 text-accent" weight={2} />
            History
          </span>
          <h1 className="text-3xl font-bold tracking-tight text-fg sm:text-4xl">Past analyses</h1>
          <p className="max-w-xl text-sm leading-relaxed text-muted">
            Every submitted clip, its verdict and confidence. Open one to review the full
            multimodal breakdown and Grad-CAM evidence.
          </p>
        </div>
        <Link href="/" className="btn-primary">
          <Icon name="upload" className="h-4 w-4" weight={2} />
          New analysis
        </Link>
      </header>

      {summary && data && data.items.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="chip">
            <strong className="font-semibold text-fg">{data.total}</strong> total
          </span>
          <span className="chip border-real/25 bg-real/10 text-real">{summary.real} real</span>
          <span className="chip border-fake/25 bg-fake/10 text-fake">{summary.fake} fake</span>
          {summary.failed > 0 && (
            <span className="chip border-warn/25 bg-warn/10 text-warn">
              {summary.failed} failed
            </span>
          )}
          <span className="text-faint">on this page</span>
        </div>
      )}

      {error && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-fake/35 bg-fake/[0.07] p-4 text-sm">
          <span className="flex items-center gap-2.5 text-fake">
            <Icon name="alert" className="h-4 w-4 shrink-0" />
            {error}
          </span>
          <button type="button" onClick={() => void load(page)} className="btn-secondary">
            <Icon name="refresh" className="h-4 w-4" />
            Retry
          </button>
        </div>
      )}

      {loading && !data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="skeleton h-[17rem]" />
          ))}
        </div>
      ) : data && data.items.length === 0 ? (
        <EmptyState />
      ) : (
        data && (
          <>
            <div
              className={`grid gap-4 transition-opacity duration-200 sm:grid-cols-2 lg:grid-cols-3 ${
                loading ? "opacity-50" : "opacity-100"
              }`}
            >
              {data.items.map((item) => (
                <HistoryCard key={item.job_id} item={item} onDelete={() => setTarget(item)} />
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line pt-6 text-sm">
              <p className="text-faint">
                {data.total} {data.total === 1 ? "analysis" : "analyses"} · page{" "}
                <span className="tabular-nums text-fg">{data.page}</span> of{" "}
                <span className="tabular-nums">{data.total_pages}</span>
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={data.page <= 1 || loading}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                >
                  <Icon name="arrow-left" className="h-4 w-4" />
                  Previous
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={data.page >= data.total_pages || loading}
                  onClick={() => setPage((current) => current + 1)}
                >
                  Next
                  <Icon name="arrow-right" className="h-4 w-4" />
                </button>
              </div>
            </div>
          </>
        )
      )}

      <ConfirmDialog
        open={target !== null}
        title="Delete this analysis?"
        body="The job record, the uploaded video and every generated Grad-CAM frame are removed from the server. This cannot be undone."
        detail={target?.filename}
        confirmLabel="Delete permanently"
        busy={deleting}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setTarget(null)}
      />
    </div>
  );
}

function EmptyState(): JSX.Element {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-panel/50 p-12 text-center sm:p-16">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10 text-accent">
        <Icon name="video" className="h-6 w-6" />
      </span>
      <p className="mt-5 text-lg font-semibold text-fg">No analyses yet</p>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted">
        Upload your first clip and it will appear here with its verdict, per-modality scores and
        Grad-CAM evidence.
      </p>
      <Link href="/" className="btn-primary mt-6">
        <Icon name="upload" className="h-4 w-4" weight={2} />
        Analyze a video
      </Link>
    </div>
  );
}

function HistoryCard({
  item,
  onDelete,
}: {
  item: HistoryItem;
  onDelete: () => void;
}): JSX.Element {
  const isFake = item.verdict === "fake";

  return (
    <article className="card-interactive group relative flex flex-col overflow-hidden">
      <Link href={`/result/${item.job_id}`} className="flex flex-1 flex-col rounded-2xl">
        <div className="relative aspect-video w-full overflow-hidden bg-black">
          {item.thumbnail_url ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={item.thumbnail_url}
              alt=""
              className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.06]"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-panel2 text-faint">
              <Icon name="video" className="h-8 w-8" weight={1.4} />
            </div>
          )}

          <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/70 to-transparent" />

          <div className="absolute left-3 top-3">
            <VerdictBadge verdict={item.verdict} status={item.status} />
          </div>

          {item.confidence !== null && item.status === "done" && (
            <span
              className={`absolute right-3 top-3 rounded-full bg-black/60 px-2 py-1 font-mono text-[11px] tabular-nums backdrop-blur ${
                isFake ? "text-fake" : "text-real"
              }`}
              title="Confidence in the verdict"
            >
              {formatPercent(item.confidence, 0)}
            </span>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-2.5 p-4">
          <h2
            className="truncate text-sm font-semibold text-fg transition-colors group-hover:text-accent"
            title={item.filename}
          >
            {item.filename}
          </h2>
          <p className="text-[11px] text-faint" title={formatDate(item.created_at)}>
            {formatRelative(item.created_at)} · {formatBytes(item.size_bytes)}
          </p>

          {item.status === "done" && (
            <div className="mt-auto flex gap-1.5 pt-1.5">
              {(
                [
                  ["V", "Visual", item.visual_score],
                  ["A", "Audio", item.audio_score],
                  ["L", "Lip-sync", item.lipsync_score],
                ] as const
              ).map(([initial, label, score]) => (
                <span
                  key={initial}
                  className="flex flex-1 items-center gap-1.5 rounded-lg bg-panel2 px-2 py-1.5 text-[10px] font-medium text-faint"
                  title={`${label} manipulation score: ${formatPercent(score ?? 0, 0)}`}
                >
                  <span>{initial}</span>
                  <span className="h-1 flex-1 overflow-hidden rounded-full bg-line">
                    <span
                      className={`block h-full rounded-full ${
                        (score ?? 0) >= 0.65
                          ? "bg-fake"
                          : (score ?? 0) >= 0.35
                            ? "bg-warn"
                            : "bg-real"
                      }`}
                      style={{ width: `${Math.round((score ?? 0) * 100)}%` }}
                    />
                  </span>
                </span>
              ))}
            </div>
          )}
        </div>
      </Link>

      <button
        type="button"
        onClick={onDelete}
        aria-label={`Delete analysis of ${item.filename}`}
        className="absolute bottom-3 right-3 flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-panel text-faint opacity-0 shadow-soft transition-all duration-200 hover:border-fake/50 hover:bg-fake/10 hover:text-fake focus-visible:opacity-100 group-hover:opacity-100"
      >
        <Icon name="trash" className="h-4 w-4" />
      </button>
    </article>
  );
}
