"use client";

import { useState } from "react";

import { useToast } from "@/components/ToastProvider";
import { errorMessage } from "@/lib/api";
import { downloadReport } from "@/lib/report";
import type { JobStatusResponse } from "@/lib/types";

export function DownloadReportButton({ job }: { job: JobStatusResponse }): JSX.Element {
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const handleClick = async (): Promise<void> => {
    setBusy(true);
    try {
      await downloadReport(job);
      toast.success("Report downloaded.");
    } catch (caught) {
      toast.error(`Could not build the report: ${errorMessage(caught)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void handleClick()}
      disabled={busy || !job.result}
      className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-accent to-accent2 px-4 py-2.5 text-sm font-medium text-canvas transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
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
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <path d="m7 10 5 5 5-5M12 15V3" />
      </svg>
      {busy ? "Building PDF…" : "Download report"}
    </button>
  );
}
