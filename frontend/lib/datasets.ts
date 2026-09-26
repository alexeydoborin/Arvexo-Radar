import { apiFetch, describeApiFailure } from "./api";

export interface DatasetSummary {
  id: string;
  display_name: string;
  status: string;
  created_at: string;
}

export interface ValidationSummary {
  dataset_id: string;
  dataset_version_id: string;
  accepted: number;
  accepted_with_warnings: number;
  rejected: number;
  total_rows: number;
  dataset_rejection_code: string | null;
  unknown_fields: string[];
  conflicting_request_ids: string[];
  schema_mapping: Record<string, string>;
  analysis_blocked: boolean;
  analysis_blocked_reason: string | null;
}

export interface RunSummary {
  run_id: string;
  dataset_id: string;
  status: string;
  stage: string | null;
  degradations: { code: string; affected: string[]; details?: Record<string, unknown> }[];
  provenance: Record<string, unknown>;
}

export function apiV1Root(): string {
  const configured = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";
  return configured.replace(/\/$/, "");
}

async function unwrap<T>(response: Response, failureMessage: string): Promise<T> {
  if (!response.ok) {
    let detail = "";
    try {
      const body = await response.json();
      detail = body?.detail?.message ?? body?.detail ?? "";
    } catch {
      // response body was not JSON — ignore and fall back to the generic message
    }
    throw new Error(detail || describeApiFailure(response.status) || `${failureMessage} (HTTP ${response.status})`);
  }
  return response.json() as Promise<T>;
}

export async function uploadDataset(file: File): Promise<DatasetSummary> {
  const form = new FormData();
  form.append("file", file);
  form.append("display_name", file.name);
  const response = await apiFetch(`${apiV1Root()}/datasets`, { method: "POST", body: form });
  return unwrap<DatasetSummary>(response, "Не удалось загрузить датасет");
}

export async function getValidationSummary(datasetId: string): Promise<ValidationSummary> {
  const response = await apiFetch(`${apiV1Root()}/datasets/${datasetId}/validation`);
  return unwrap<ValidationSummary>(response, "Не удалось получить сводку валидации");
}

export async function createRun(datasetId: string): Promise<RunSummary> {
  const response = await apiFetch(`${apiV1Root()}/datasets/${datasetId}/runs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  return unwrap<RunSummary>(response, "Не удалось запустить анализ");
}

export async function getRun(runId: string): Promise<RunSummary> {
  const response = await apiFetch(`${apiV1Root()}/runs/${runId}`);
  return unwrap<RunSummary>(response, "Не удалось получить статус анализа");
}

const TERMINAL_RUN_STATUSES = new Set(["completed", "degraded", "failed", "cancelled"]);
const RESULT_RUN_STATUSES = new Set(["completed", "degraded"]);

export function hasAnalysisResults(status: string): boolean {
  return RESULT_RUN_STATUSES.has(status);
}

export async function pollRunUntilDone(
  runId: string,
  // LLM-backed stages (scenario naming, insight/recommendation wording) can
  // comfortably take 100s+ even for a ~100-row dataset depending on
  // provider latency and worker queue depth — a 2min timeout was cutting it
  // too close and produced a false "did not finish" error on a run that was
  // still healthily in progress. 10min gives real headroom.
  { intervalMs = 1500, timeoutMs = 600000 }: { intervalMs?: number; timeoutMs?: number } = {},
): Promise<RunSummary> {
  const start = Date.now();
  for (;;) {
    const run = await getRun(runId);
    if (TERMINAL_RUN_STATUSES.has(run.status)) return run;
    if (Date.now() - start >= timeoutMs) throw new Error("Анализ не завершился за отведённое время.");
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}
