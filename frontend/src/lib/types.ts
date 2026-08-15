/**
 * Mirrors the Pydantic response models in backend/app/schemas.py.
 * Keep the two in sync when the API changes.
 */

export type JobStatus = "queued" | "processing" | "done" | "failed";
export type Verdict = "real" | "fake";
export type ModalityKey = "visual" | "audio" | "lipsync";

export interface ModalityScore {
  /** P(manipulated) for this branch, 0-1. */
  score: number;
  label: string;
  explanation: string;
}

export interface AnalysisResult {
  verdict: Verdict;
  /** Confidence in `verdict`, 0-1. */
  confidence: number;
  modalities: Partial<Record<ModalityKey, ModalityScore>>;
  gradcam_frames: string[];
  thumbnail_url: string | null;
  frames_analyzed: number;
  duration_seconds: number;
  model_version: string;
  processing_time_ms: number;
  notes: string;
}

export interface JobCreated {
  job_id: string;
  filename: string;
  size_bytes: number;
  status: JobStatus;
}

export interface JobStatusResponse {
  job_id: string;
  filename: string;
  status: JobStatus;
  stage: string;
  /** 0-100. */
  progress: number;
  error: string | null;
  created_at: string;
  completed_at: string | null;
  size_bytes: number;
  video_url: string | null;
  thumbnail_url: string | null;
  result: AnalysisResult | null;
}

export interface HistoryItem {
  job_id: string;
  filename: string;
  status: JobStatus;
  created_at: string;
  verdict: Verdict | null;
  confidence: number | null;
  visual_score: number | null;
  audio_score: number | null;
  lipsync_score: number | null;
  thumbnail_url: string | null;
  size_bytes: number;
}

export interface HistoryPage {
  items: HistoryItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface PipelineInfo {
  name: string;
  version: string;
  loaded: boolean;
  branches: string[];
  note: string | null;
}

export interface HealthResponse {
  status: "ok" | "degraded";
  models_loaded: boolean;
  pipeline: PipelineInfo;
  jobs_in_flight: number;
  version: string;
}

export interface DeleteResponse {
  job_id: string;
  deleted: boolean;
}
