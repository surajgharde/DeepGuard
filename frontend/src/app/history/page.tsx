"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

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
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const load = useCallback(
    async (target: number) => {
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
    },
    [],
  );

  useEffect(() => {
    void load(page);
  }, [load, page]);

  const handleDelete = async (item: HistoryItem): Promise<void> => {
    setPendingDelete(item.job_id);
    try {
      await deleteJob(item.job_id);
      toast.success(`Deleted "${item.filename}".`);
      const remaining = (data?.items.length ?? 1) - 1;
      if (remaining === 0 && page > 1) {
        setPage((current) => current - 1);
      } else {
        await load(page);
      }
    } catch (caught) {
      toast.error(errorMessage(caught));
    } finally {
      setPendingDelete(null);
    }
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-3">
          <p className="section-title">History</p>
          <h1 className="text-3xl font-semibold tracking-tight text-fg">Past analyses</h1>
          <p className="max-w-xl text-sm text-muted">
            Every submitted clip, its verdict and confidence. Open one to review the full
            multimodal breakdown.
          </p>
        </div>
        <Link href="/" className="btn-primary">
          New analysis
        </Link>
      </header>

      {error && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-fake/40 bg-fake/10 p-4 text-sm text-fake">
          <span>{error}</span>
          <button type="button" onClick={() => void load(page)} className="btn-ghost">
            Retry
          </button>
        </div>
      )}

      {loading && !data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="h-64 animate-pulse rounded-2xl bg-panel" />
          ))}
        </div>
      ) : data && data.items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-panel/50 p-14 text-center">
          <p className="text-lg text-fg">No analyses yet</p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
            Upload your first clip and it will appear here with its verdict and Grad-CAM
            evidence.
          </p>
          <Link href="/" className="btn-primary mt-6 inline-flex">
            Analyze a video
          </Link>
        </div>
      ) : (
        data && (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {data.items.map((item) => (
                <HistoryCard
                  key={item.job_id}
                  item={item}
                  deleting={pendingDelete === item.job_id}
                  onDelete={() => void handleDelete(item)}
                />
              ))}
            </div>

            <div className="flex items-center justify-between gap-4 border-t border-line pt-5 text-sm">
              <p className="text-faint">
                {data.total} {data.total === 1 ? "analysis" : "analyses"} · page {data.page} of{" "}
                {data.total_pages}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn-ghost"
                  disabled={data.page <= 1 || loading}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  disabled={data.page >= data.total_pages || loading}
                  onClick={() => setPage((current) => current + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )
      )}
    </div>
  );
}

function HistoryCard({
  item,
  deleting,
  onDelete,
}: {
  item: HistoryItem;
  deleting: boolean;
  onDelete: () => void;
}): JSX.Element {
  const isFake = item.verdict === "fake";

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-2xl border border-line bg-panel transition-colors hover:border-line2">
      <Link href={`/result/${item.job_id}`} className="block">
        <div className="relative aspect-video w-full overflow-hidden bg-black">
          {item.thumbnail_url ? (
            <img
              src={item.thumbnail_url}
              alt=""
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-faint">
              <svg
                className="h-8 w-8"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                aria-hidden="true"
              >
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="m10 9 5 3-5 3V9Z" />
              </svg>
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-panel to-transparent" />
          <div className="absolute left-3 top-3">
            <VerdictBadge verdict={item.verdict} status={item.status} />
          </div>
          {item.confidence !== null && item.status === "done" && (
            <span
              className={`absolute right-3 top-3 rounded-full bg-canvas/75 px-2 py-1 font-mono text-[11px] tabular-nums ${
                isFake ? "text-fake" : "text-real"
              }`}
            >
              {formatPercent(item.confidence, 0)}
            </span>
          )}
        </div>

        <div className="space-y-2 p-4">
          <h2 className="truncate text-sm font-medium text-fg" title={item.filename}>
            {item.filename}
          </h2>
          <p className="text-xs text-faint">
            {formatDate(item.created_at)} · {formatRelative(item.created_at)} ·{" "}
            {formatBytes(item.size_bytes)}
          </p>

          {item.status === "done" && (
            <div className="flex gap-1.5 pt-1">
              {(
                [
                  ["V", item.visual_score],
                  ["A", item.audio_score],
                  ["L", item.lipsync_score],
                ] as const
              ).map(([initial, score]) => (
                <span
                  key={initial}
                  className="flex flex-1 items-center gap-1.5 rounded-md bg-panel2 px-2 py-1 text-[10px] text-faint"
                  title={`${initial === "V" ? "Visual" : initial === "A" ? "Audio" : "Lip-sync"} manipulation score`}
                >
                  <span>{initial}</span>
                  <span className="h-1 flex-1 overflow-hidden rounded-full bg-line">
                    <span
                      className={`block h-full rounded-full ${
                        (score ?? 0) >= 0.5 ? "bg-fake" : "bg-real"
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
        disabled={deleting}
        aria-label={`Delete analysis of ${item.filename}`}
        className="absolute bottom-3 right-3 rounded-lg border border-line bg-panel/90 p-2 text-faint opacity-0 transition-all hover:border-fake/50 hover:text-fake focus-visible:opacity-100 group-hover:opacity-100 disabled:opacity-40"
      >
        <svg
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" />
        </svg>
      </button>
    </article>
  );
}
