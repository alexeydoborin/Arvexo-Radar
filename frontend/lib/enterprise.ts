import { apiFetch } from "./api";

export type DataStatus = "actual" | "estimate" | "mixed" | "demo";

export interface KpiValue {
  key: string;
  label: string;
  value: number;
  unit: string;
  change_percent: number | null;
  data_status: DataStatus;
  formula: string;
  source: string;
  assumption?: string | null;
}

export interface AgentAnalytics {
  id: string;
  name: string;
  purpose: string;
  departments: string[];
  roles: string[];
  model: string;
  tools: string[];
  mau: number;
  requests: number;
  tool_calls: number;
  total_tokens: number;
  cost: number;
  error_rate: number;
  latency_ms: number;
  time_saved_hours: number;
  fte_saved: number;
  money_saved: number;
  net_benefit: number;
  roi: number | null;
  payback_ratio: number | null;
  period: string;
  status: "profitable" | "needs_review" | "loss_making" | "insufficient_data";
  data_status: DataStatus;
  confidence: number;
}

export interface OverviewData {
  period: { date_from: string; date_to: string; label: string };
  provenance: { data_mode: "live" | "demo" | "mixed"; estimated_share: number; source: string; limitations: string[] };
  usage_and_cost: KpiValue[];
  business_effect: KpiValue[];
  is_profitable: boolean;
  executive_conclusion: string;
  requests_by_day: { date: string; requests: number }[];
  cost_and_savings_by_month: { month: string; cost: number; money_saved: number }[];
  top_agents: AgentAnalytics[];
  top_scenarios: Array<Record<string, string | number | boolean>>;
  issues_and_recommendations: Array<Record<string, string | boolean>>;
  best_practices: Array<Record<string, unknown>>;
  applied_filters: Record<string, string>;
}

export interface AnalyticsEnvelope<T> {
  period: OverviewData["period"];
  provenance: OverviewData["provenance"];
  items: T[];
  summary: Record<string, unknown>;
  applied_filters: Record<string, string>;
}

export interface MethodologyData {
  average_monthly_fte_cost: number;
  monthly_work_hours_per_fte: number;
  monthly_work_minutes_per_fte: number;
  include_development_team: boolean;
  electricity_price_per_kwh: number;
  hardware_depreciation_months: number;
  currency: string;
  calculation_period: "month" | "quarter" | "year";
  profitability_thresholds: Record<string, number>;
  best_practice_rules: Record<string, number>;
  model_tariffs: Array<Record<string, string | number | boolean | null>>;
  scenario_benchmarks: Array<Record<string, string | number | boolean | null>>;
  data_status: DataStatus;
}

function apiRoot(): string {
  const configured = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api";
  return configured.replace(/\/$/, "").replace(/\/v1$/, "");
}

export type EnterpriseFilters = Partial<Record<"department" | "role" | "user" | "agent" | "model" | "scenario" | "tool" | "date_from" | "date_to", string>>;

function withFilters(path: string, filters: EnterpriseFilters = {}): string {
  const parameters = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => { if (value) parameters.set(key, value); });
  const query = parameters.toString();
  return query ? `${path}?${query}` : path;
}

export interface DataResult<T> {
  data: T | null;
  demo: boolean;
  error?: string;
}

async function request<T>(path: string, init?: RequestInit): Promise<DataResult<T>> {
  try {
    const response = await apiFetch(`${apiRoot()}${path}`, { ...init, signal: AbortSignal.timeout(4000), headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
    if (!response.ok) throw new Error(`Radar API вернул ошибку ${response.status}`);
    return { data: await response.json() as T, demo: false };
  } catch (caught) {
    // No fabricated numbers here (docs/11-dashboard.md UI-AC-09): if the API
    // is unreachable or the run has no data yet, the UI must show that
    // honestly instead of a successful-looking demo screen.
    return { data: null, demo: false, error: caught instanceof Error ? caught.message : "Radar API недоступен" };
  }
}

export const fetchOverview = (filters: EnterpriseFilters = {}) => request<OverviewData>(withFilters("/analytics/overview", filters));
export const fetchAgents = (filters: EnterpriseFilters = {}) => request<AnalyticsEnvelope<AgentAnalytics>>(withFilters("/analytics/agents", filters));
export const fetchDepartments = (filters: EnterpriseFilters = {}) => request<AnalyticsEnvelope<Record<string, number | string>>>(withFilters("/analytics/departments", filters));
export const fetchTools = (filters: EnterpriseFilters = {}) => request<AnalyticsEnvelope<Record<string, number | string>>>(withFilters("/analytics/tools", filters));
export const fetchMethodology = () => request<MethodologyData>("/methodology");

export async function saveMethodology(value: MethodologyData): Promise<MethodologyData> {
  const payload = {
    average_monthly_fte_cost: value.average_monthly_fte_cost,
    monthly_work_hours_per_fte: value.monthly_work_hours_per_fte,
    include_development_team: value.include_development_team,
    electricity_price_per_kwh: value.electricity_price_per_kwh,
    hardware_depreciation_months: value.hardware_depreciation_months,
    currency: value.currency,
    calculation_period: value.calculation_period,
    profitability_thresholds: value.profitability_thresholds,
    best_practice_rules: value.best_practice_rules,
  };
  const result = await request<MethodologyData>("/methodology", { method: "PUT", body: JSON.stringify(payload) });
  if (!result.data) throw new Error(result.error ?? "Не удалось сохранить методику");
  return result.data;
}
