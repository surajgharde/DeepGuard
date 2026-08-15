/** PDF summary generation (jsPDF). Runs entirely client-side. */

import { jsPDF } from "jspdf";

import { MODALITY_KEYS, MODALITY_META, formatBytes, formatDate, formatPercent } from "@/lib/format";
import type { JobStatusResponse } from "@/lib/types";

const INK = { r: 17, g: 24, b: 39 };
const MUTED = { r: 107, g: 114, b: 128 };
const REAL = { r: 16, g: 185, b: 129 };
const FAKE = { r: 244, g: 63, b: 94 };

async function fetchAsDataUrl(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** Build and download a one-page summary for a completed job. */
export async function downloadReport(job: JobStatusResponse): Promise<void> {
  const result = job.result;
  if (!result) throw new Error("This job has no result to report on yet.");

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 48;
  let y = margin;

  // Header
  doc.setFillColor(6, 9, 15);
  doc.rect(0, 0, pageWidth, 74, "F");
  doc.setTextColor(231, 238, 251);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("DeepGuard", margin, 40);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(147, 162, 184);
  doc.text("Multimodal deepfake detection report", margin, 58);
  doc.text(`Generated ${new Date().toLocaleString()}`, pageWidth - margin, 58, { align: "right" });

  y = 108;

  // Verdict banner
  const isFake = result.verdict === "fake";
  const tone = isFake ? FAKE : REAL;
  doc.setFillColor(tone.r, tone.g, tone.b);
  doc.roundedRect(margin, y, pageWidth - margin * 2, 58, 6, 6, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text(isFake ? "LIKELY MANIPULATED" : "LIKELY AUTHENTIC", margin + 18, y + 30);
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text(
    `Verdict: ${result.verdict.toUpperCase()}   ·   Confidence: ${formatPercent(result.confidence)}`,
    margin + 18,
    y + 48,
  );
  y += 84;

  // File metadata
  doc.setTextColor(INK.r, INK.g, INK.b);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Analysed file", margin, y);
  y += 16;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const meta: Array<[string, string]> = [
    ["File name", job.filename],
    ["Job ID", job.job_id],
    ["Submitted", formatDate(job.created_at)],
    ["Size", formatBytes(job.size_bytes)],
    ["Clip duration", `${result.duration_seconds.toFixed(1)} s`],
    ["Frames analysed", String(result.frames_analyzed)],
    ["Model version", result.model_version],
    ["Processing time", `${(result.processing_time_ms / 1000).toFixed(1)} s`],
  ];
  for (const [label, value] of meta) {
    doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
    doc.text(label, margin, y);
    doc.setTextColor(INK.r, INK.g, INK.b);
    doc.text(value, margin + 120, y);
    y += 15;
  }

  y += 12;

  // Per-modality scores
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Per-modality manipulation scores", margin, y);
  y += 18;

  const barWidth = 180;
  for (const key of MODALITY_KEYS) {
    const modality = result.modalities[key];
    if (!modality) continue;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(INK.r, INK.g, INK.b);
    doc.text(MODALITY_META[key].title, margin, y);

    doc.setFillColor(229, 231, 235);
    doc.roundedRect(margin + 90, y - 8, barWidth, 9, 4, 4, "F");
    const filled = Math.max(2, barWidth * modality.score);
    const barTone = modality.score >= 0.5 ? FAKE : REAL;
    doc.setFillColor(barTone.r, barTone.g, barTone.b);
    doc.roundedRect(margin + 90, y - 8, filled, 9, 4, 4, "F");

    doc.setFont("helvetica", "normal");
    doc.text(`${formatPercent(modality.score)}  ${modality.label}`, margin + 90 + barWidth + 12, y);
    y += 14;

    doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
    doc.setFontSize(9);
    const lines = doc.splitTextToSize(modality.explanation, pageWidth - margin * 2 - 90);
    doc.text(lines, margin + 90, y);
    y += lines.length * 11 + 10;
  }

  // Grad-CAM strip (best effort: skip silently if images cannot be fetched)
  const frames = result.gradcam_frames.slice(0, 4);
  if (frames.length > 0) {
    y += 4;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(INK.r, INK.g, INK.b);
    doc.text("Grad-CAM: regions influencing the visual decision", margin, y);
    y += 12;

    const dataUrls = await Promise.all(frames.map(fetchAsDataUrl));
    const usable = dataUrls.filter((item): item is string => item !== null);
    if (usable.length > 0) {
      const gap = 10;
      const imgWidth = (pageWidth - margin * 2 - gap * (usable.length - 1)) / usable.length;
      const imgHeight = imgWidth * (9 / 16);
      usable.forEach((dataUrl, index) => {
        doc.addImage(dataUrl, "JPEG", margin + index * (imgWidth + gap), y, imgWidth, imgHeight);
      });
      y += imgHeight + 16;
    }
  }

  // Footer
  const footerY = doc.internal.pageSize.getHeight() - 40;
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, footerY - 14, pageWidth - margin, footerY - 14);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
  const disclaimer = result.notes
    ? result.notes
    : "Automated analysis. Interpret alongside provenance and contextual evidence.";
  doc.text(doc.splitTextToSize(disclaimer, pageWidth - margin * 2), margin, footerY);

  doc.save(`deepguard-report-${job.job_id.slice(0, 8)}.pdf`);
}
