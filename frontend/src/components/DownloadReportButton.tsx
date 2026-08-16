"use client";

import { useState } from "react";

import { Icon } from "@/components/Icon";
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
      className="btn-primary"
    >
      {busy ? (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-on-accent/30 border-t-on-accent" />
      ) : (
        <Icon name="download" className="h-4 w-4" weight={2} />
      )}
      {busy ? "Building PDF…" : "Download report"}
    </button>
  );
}
