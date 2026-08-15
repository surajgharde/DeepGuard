/** Typed client for the DeepGuard API. No URLs are hardcoded -- see lib/config.ts. */

import { API_BASE_URL } from "@/lib/config";
import type {
  DeleteResponse,
  HealthResponse,
  HistoryPage,
  JobCreated,
  JobStatusResponse,
} from "@/lib/types";

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }

  /** True when the backend could not be reached at all. */
  get isNetworkError(): boolean {
    return this.status === 0;
  }
}

const OFFLINE_MESSAGE = `Cannot reach the DeepGuard API at ${API_BASE_URL}. Is the backend running?`;

async function extractDetail(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (body && typeof body === "object" && "detail" in body) {
      const detail = (body as { detail: unknown }).detail;
      if (typeof detail === "string") return detail;
      if (Array.isArray(detail) && detail.length > 0) return JSON.stringify(detail[0]);
    }
  } catch {
    /* fall through to the generic message */
  }
  return `Request failed with status ${response.status}.`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: { Accept: "application/json", ...(init?.headers ?? {}) },
      cache: "no-store",
    });
  } catch {
    throw new ApiError(OFFLINE_MESSAGE, 0);
  }

  if (!response.ok) {
    throw new ApiError(await extractDetail(response), response.status);
  }

  return (await response.json()) as T;
}

/**
 * Upload a video and start analysis.
 *
 * Uses XHR rather than fetch so the drag-and-drop zone can show real upload
 * progress for large files.
 */
export function uploadVideo(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<JobCreated> {
  return new Promise<JobCreated>((resolve, reject) => {
    const form = new FormData();
    form.append("file", file);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE_URL}/api/analyze`);
    xhr.responseType = "json";

    xhr.upload.onprogress = (event) => {
      if (onProgress && event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      const body: unknown = xhr.response;
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(body as JobCreated);
        return;
      }
      const detail =
        body && typeof body === "object" && "detail" in body
          ? String((body as { detail: unknown }).detail)
          : `Upload failed with status ${xhr.status}.`;
      reject(new ApiError(detail, xhr.status));
    };

    xhr.onerror = () => reject(new ApiError(OFFLINE_MESSAGE, 0));
    xhr.onabort = () => reject(new ApiError("Upload cancelled.", 0));
    xhr.send(form);
  });
}

export function getJob(jobId: string): Promise<JobStatusResponse> {
  return request<JobStatusResponse>(`/api/jobs/${encodeURIComponent(jobId)}`);
}

export function deleteJob(jobId: string): Promise<DeleteResponse> {
  return request<DeleteResponse>(`/api/jobs/${encodeURIComponent(jobId)}`, { method: "DELETE" });
}

export function getHistory(page = 1, pageSize = 12): Promise<HistoryPage> {
  return request<HistoryPage>(`/api/history?page=${page}&page_size=${pageSize}`);
}

export function getHealth(): Promise<HealthResponse> {
  return request<HealthResponse>("/health");
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Something went wrong.";
}
