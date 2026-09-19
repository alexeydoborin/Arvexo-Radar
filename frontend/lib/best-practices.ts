import { apiFetch } from "./api";

export type BestPracticeStatus =
  | "detected"
  | "under_review"
  | "approved"
  | "rejected"
  | "published"
  | "scaling"
  | "archived";

export interface BestPractice {
  id: string;
  title: string;
  short_description: string;
  department: string;
  department_origin?: string;
  scenario: string;
  scenario_id?: string;
  created_at: string;
  detected_at: string;
  status: BestPracticeStatus;
  confidence_score: number;
  impact_score: number;
  adoption_count: number;
  estimated_time_saved: number;
  estimated_fte_saved: number;
  estimated_money_saved?: number;
  tags: string[];
  recommendation: string;
  user_count: number;
  usage_count: number;
  average_rating: number | null;
  success_rate: number;
  error_rate: number;
  growth_rate: number;
  departments: string[];
  models: string[];
  detection_evidence: Record<string, unknown>;
  published_at: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  recommended_departments?: string[];
  is_estimated?: boolean;
}

export interface BestPracticeTop {
  new: BestPractice[];
  fast_growing: BestPractice[];
  most_effective: BestPractice[];
  by_department: Record<string, BestPractice[]>;
  by_model: Record<string, BestPractice[]>;
}

function apiRoot(): string {
  const configured = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api";
  return configured.replace(/\/$/, "").replace(/\/v1$/, "");
}

export async function fetchPractices(): Promise<{ items: BestPractice[]; error?: string }> {
  try {
    const response = await apiFetch(`${apiRoot()}/best-practices`, { signal: AbortSignal.timeout(3500) });
    if (!response.ok) throw new Error(`Radar API вернул ошибку ${response.status}`);
    const payload = await response.json();
    return { items: payload.items };
  } catch (caught) {
    // No fabricated best practices (docs/11-dashboard.md UI-AC-09): an
    // unreachable API means "no data yet", not a successful demo catalog.
    return { items: [], error: caught instanceof Error ? caught.message : "Radar API недоступен" };
  }
}

export async function fetchPracticeTop(): Promise<BestPracticeTop | null> {
  try {
    const response = await apiFetch(`${apiRoot()}/best-practices/top`, { signal: AbortSignal.timeout(3500) });
    if (!response.ok) throw new Error(`Radar API вернул ошибку ${response.status}`);
    return await response.json();
  } catch {
    return null;
  }
}

export async function recommendPractice(practice: BestPractice): Promise<BestPractice> {
  let current = practice;
  if (current.status !== "approved" && current.status !== "published") {
    const approved = await apiFetch(`${apiRoot()}/best-practices/${practice.id}/approve`, { method: "POST" });
    if (!approved.ok) throw new Error("Не удалось согласовать практику");
    current = await approved.json();
  }
  if (current.status === "published") return current;
  const published = await apiFetch(`${apiRoot()}/best-practices/${practice.id}/publish`, { method: "POST" });
  if (!published.ok) throw new Error("Не удалось опубликовать практику");
  return await published.json();
}
