"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { errorMessage, getJob } from "@/lib/api";
import { POLL_INTERVAL_MS } from "@/lib/config";
import type { JobStatusResponse } from "@/lib/types";

interface UseJobPolling {
  job: JobStatusResponse | null;
  loading: boolean;
  error: string | null;
  /** Re-fetch immediately (e.g. after a transient network error). */
  refresh: () => void;
}

/**
 * Poll GET /api/jobs/{id} every POLL_INTERVAL_MS while the job is in flight,
 * stopping as soon as it reaches a terminal state.
 */
export function useJobPolling(jobId: string | null): UseJobPolling {
  const [job, setJob] = useState<JobStatusResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(jobId !== null);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const timerRef = useRef<number | null>(null);

  const refresh = useCallback(() => setNonce((value) => value + 1), []);

  useEffect(() => {
    if (!jobId) {
      setJob(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const clear = (): void => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    const tick = async (): Promise<void> => {
      try {
        const data = await getJob(jobId);
        if (cancelled) return;
        setJob(data);
        setError(null);
        setLoading(false);

        if (data.status === "queued" || data.status === "processing") {
          timerRef.current = window.setTimeout(() => void tick(), POLL_INTERVAL_MS);
        }
      } catch (caught) {
        if (cancelled) return;
        setError(errorMessage(caught));
        setLoading(false);
        // Keep retrying on transient failures, but back off a little.
        timerRef.current = window.setTimeout(() => void tick(), POLL_INTERVAL_MS * 2);
      }
    };

    void tick();

    return () => {
      cancelled = true;
      clear();
    };
  }, [jobId, nonce]);

  return { job, loading, error, refresh };
}
