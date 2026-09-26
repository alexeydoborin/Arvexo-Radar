import { apiFetch, describeApiFailure } from "./api";
import { apiV1Root } from "./datasets";

export interface ReportSummary {
  report_id: string;
  run_id: string;
  status: string;
  format: string;
  checksum: string | null;
  generated_at: string | null;
  safe_error: string | null;
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

export async function createReport(runId: string): Promise<ReportSummary> {
  const response = await apiFetch(`${apiV1Root()}/runs/${runId}/reports`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  return unwrap<ReportSummary>(response, "Не удалось запустить генерацию отчёта");
}

export async function getReport(reportId: string): Promise<ReportSummary> {
  const response = await apiFetch(`${apiV1Root()}/reports/${reportId}`);
  return unwrap<ReportSummary>(response, "Не удалось получить статус отчёта");
}

const TERMINAL_REPORT_STATUSES = new Set(["generated", "failed"]);

export async function pollReportUntilDone(
  reportId: string,
  { intervalMs = 1500, timeoutMs = 60000 }: { intervalMs?: number; timeoutMs?: number } = {},
): Promise<ReportSummary> {
  const start = Date.now();
  for (;;) {
    const report = await getReport(reportId);
    if (TERMINAL_REPORT_STATUSES.has(report.status)) return report;
    if (Date.now() - start >= timeoutMs) throw new Error("Отчёт не был сформирован за отведённое время.");
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

export async function downloadReportPdf(reportId: string, filename = `radar-report-${reportId}.pdf`): Promise<void> {
  const response = await apiFetch(`${apiV1Root()}/reports/${reportId}/download`);
  if (!response.ok) throw new Error(`Не удалось скачать PDF-отчёт (HTTP ${response.status})`);
  const blob = await response.blob();
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}
