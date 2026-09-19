import { apiFetch } from "./api";
import { apiV1Root } from "./datasets";

export interface CategorySummary {
  category_id: string;
  name: string;
  count: number;
  share: number;
  avg_confidence: number;
}

export interface ScenarioSummary {
  scenario_id: string;
  name: string | null;
  description: string | null;
  size: number;
  share: number;
  quality: Record<string, unknown>;
  category_ids: string[];
  generation_status: string;
  is_noise: boolean;
}

export interface FindingSummary {
  rule_id: string;
  type: string;
  severity: string;
  count: number;
  examples: string[];
}

export interface InsightSummary {
  insight_id: string;
  type: string;
  statement: string;
  evidence_refs: string[];
  confidence: number;
  limitations: string[];
}

export interface RecommendationSummary {
  recommendation_id: string;
  action: string;
  rationale: string;
  linked_insight_id: string | null;
  priority_basis: string;
  caveats: string[];
}

export interface DistributionPoint {
  key: string;
  label: string;
  count: number;
  share: number;
}

export interface SegmentPoint {
  value: string;
  count: number;
  share: number;
  is_missing: boolean;
}

export interface ScenarioDetail extends ScenarioSummary {
  typical_phrasings: string[];
  caveats: string[];
  evidence_count: number;
  samples: Array<{
    record_id: string;
    masked_text: string;
    similarity_to_centroid: number;
    selection_reason: string | null;
  }>;
}

export interface RunOverview {
  run_id: string;
  dataset_id: string;
  status: string;
  total_records: number;
  denominator: number;
  top_categories: CategorySummary[];
  top_scenarios: ScenarioSummary[];
  top_findings: FindingSummary[];
  insights: InsightSummary[];
  recommendations: RecommendationSummary[];
  trend: { available: boolean; reason: string | null };
  data_quality: {
    accepted: number;
    accepted_with_warnings: number;
    rejected: number;
    total_rows: number;
    warning_counts: Record<string, number>;
    fields: Array<{ field: string; present: number; missing: number; completeness: number }>;
  };
  activity: {
    valid_timestamp_records: number;
    missing_timestamp_records: number;
    by_date: DistributionPoint[];
    by_hour: DistributionPoint[];
  };
  segments: Record<string, SegmentPoint[]>;
  risk_summary: {
    total_findings: number;
    affected_records: number;
    affected_share: number;
    by_severity: Array<{ key: string; count: number }>;
    by_type: Array<{ key: string; count: number }>;
  };
  degradations: { code: string; affected: string[]; details?: Record<string, unknown> }[];
  limitations: string[];
}

export async function fetchRunOverview(runId: string): Promise<RunOverview | null> {
  try {
    const response = await apiFetch(`${apiV1Root()}/runs/${runId}/overview`);
    if (!response.ok) return null;
    return (await response.json()) as RunOverview;
  } catch {
    return null;
  }
}

export async function fetchScenarioDetail(
  runId: string,
  scenarioId: string,
): Promise<ScenarioDetail | null> {
  try {
    const response = await apiFetch(`${apiV1Root()}/runs/${runId}/scenarios/${scenarioId}`);
    if (!response.ok) return null;
    return (await response.json()) as ScenarioDetail;
  } catch {
    return null;
  }
}
