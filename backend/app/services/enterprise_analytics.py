from __future__ import annotations

import copy
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

from app.demo_enterprise import (
    DEMO_ADOPTIONS,
    DEMO_AGENTS,
    DEMO_BENCHMARKS,
    DEMO_COST_COMPONENTS,
    DEMO_DEPARTMENTS,
    DEMO_INSIGHTS,
    DEMO_METHODOLOGY,
    DEMO_MODEL_TARIFFS,
    DEMO_MONTHS,
    DEMO_PERIOD_FROM,
    DEMO_PERIOD_TO,
    DEMO_PRACTICES,
    DEMO_SCENARIOS,
    DEMO_TOOLS,
    request_series,
)
from app.schemas.enterprise import (
    CostComponentInput,
    MethodologyUpdate,
    PracticeAdoptionInput,
)


@dataclass(frozen=True, slots=True)
class EnterpriseFilters:
    date_from: datetime | None = None
    date_to: datetime | None = None
    department: str | None = None
    role: str | None = None
    user: str | None = None
    agent: str | None = None
    model: str | None = None
    scenario: str | None = None
    tool: str | None = None

    def applied(self) -> dict[str, str]:
        values = {
            "date_from": self.date_from.isoformat() if self.date_from else None,
            "date_to": self.date_to.isoformat() if self.date_to else None,
            "department": self.department,
            "role": self.role,
            "user": self.user,
            "agent": self.agent,
            "model": self.model,
            "scenario": self.scenario,
            "tool": self.tool,
        }
        return {key: value for key, value in values.items() if value is not None}


def _period() -> dict[str, object]:
    return {
        "date_from": DEMO_PERIOD_FROM,
        "date_to": DEMO_PERIOD_TO,
        "label": "Июль 2026",
    }


def _provenance(estimated_share: float = 0.34) -> dict[str, object]:
    return {
        "data_mode": "demo",
        "data_status": "demo",
        "estimated_share": estimated_share,
        "source": "Связный синтетический набор Radar Enterprise MVP",
        "limitations": [
            "Демо-данные не являются доказательством причинно-следственной экономии.",
            "Фактическая экономия требует утверждённого бизнес-бенчмарка.",
        ],
    }


def _normalize(value: str) -> str:
    return value.casefold().strip()


MAX_COST_COMPONENTS = 200


class EnterpriseAnalyticsService:
    """Demo adapter implementing the complete analytics contract.

    It intentionally exposes its provenance. A production adapter can feed the
    same calculations from telemetry, HR, FinOps and business systems.
    """

    def __init__(self) -> None:
        self._methodology = copy.deepcopy(DEMO_METHODOLOGY)
        self._cost_components = copy.deepcopy(DEMO_COST_COMPONENTS)
        self._practices = copy.deepcopy(DEMO_PRACTICES)
        self._adoptions = copy.deepcopy(DEMO_ADOPTIONS)

    @staticmethod
    def _period_overlaps(filters: EnterpriseFilters) -> bool:
        start = filters.date_from or datetime.min.replace(tzinfo=UTC)
        end = filters.date_to or datetime.max.replace(tzinfo=UTC)
        return start < DEMO_PERIOD_TO and end > DEMO_PERIOD_FROM

    def _agents(self, filters: EnterpriseFilters) -> list[dict[str, Any]]:
        if not self._period_overlaps(filters) or filters.user:
            return []
        result = copy.deepcopy(DEMO_AGENTS)
        if filters.department:
            needle = _normalize(filters.department)
            result = [row for row in result if any(_normalize(item) == needle for item in row["departments"])]
        if filters.role:
            needle = _normalize(filters.role)
            result = [row for row in result if any(_normalize(item) == needle for item in row["roles"])]
        if filters.agent:
            needle = _normalize(filters.agent)
            result = [row for row in result if needle in {_normalize(str(row["id"])), _normalize(str(row["name"]))}]
        if filters.model:
            result = [row for row in result if _normalize(str(row["model"])) == _normalize(filters.model)]
        if filters.tool:
            needle = _normalize(filters.tool)
            result = [row for row in result if any(_normalize(item) == needle for item in row["tools"])]
        if filters.scenario:
            matching_agents = {
                row["agent_id"]
                for row in DEMO_SCENARIOS
                if _normalize(filters.scenario) in {
                    _normalize(str(row["scenario_id"])),
                    _normalize(str(row["name"])),
                }
            }
            result = [row for row in result if row["id"] in matching_agents]
        return result

    def overview(self, filters: EnterpriseFilters) -> dict[str, Any]:
        agents = self._agents(filters)
        requests = sum(int(row["requests"]) for row in agents)
        mau = sum(int(row["mau"]) for row in agents)
        cost = sum(float(row["cost"]) for row in agents)
        hours = sum(float(row["time_saved_hours"]) for row in agents)
        fte = sum(float(row["fte_saved"]) for row in agents)
        saved = sum(float(row["money_saved"]) for row in agents)
        net = saved - cost
        roi = net / cost * 100 if cost else None
        scale = requests / 28400 if requests else 0
        daily = request_series()
        if scale != 1:
            daily = [{**row, "requests": round(int(row["requests"]) * scale)} for row in daily]

        usage_kpis = [
            {"key": "mau", "label": "MAU", "value": mau, "unit": "польз.", "change_percent": 8.4, "data_status": "actual", "formula": "count(distinct user_id_hash) за 30 дней", "source": "LLM gateway telemetry"},
            {"key": "requests", "label": "AI-запросы", "value": requests, "unit": "запр.", "change_percent": 12.6, "data_status": "actual", "formula": "count(request_id)", "source": "LLM gateway telemetry"},
            {"key": "active_agents", "label": "Активные AI-агенты", "value": len(agents), "unit": "агента", "change_percent": None, "data_status": "actual", "formula": "count(distinct agent_id с запросами)", "source": "LLM gateway telemetry"},
            {"key": "total_ai_cost", "label": "Затраты на AI (A)", "value": cost, "unit": "₽", "change_percent": 8.3, "data_status": "mixed", "formula": "Σ включённых Cost Component", "source": "Тарифы моделей + FinOps + договоры", "assumption": "Команда разработки исключена настройкой методики"},
        ]
        effect_kpis = [
            {"key": "time_saved", "label": "Экономия времени", "value": hours, "unit": "ч", "change_percent": 16.9, "data_status": "mixed", "formula": "Σ(tasks × minutes_saved_per_task) / 60", "source": "Scenario Benchmark + usage"},
            {"key": "fte_saved", "label": "Высвобожденный FTE", "value": fte, "unit": "FTE", "change_percent": 16.9, "data_status": "mixed", "formula": "time_saved_minutes / monthly_work_minutes_per_fte", "source": "Методика Radar", "assumption": "Эквивалент высвобождённого времени, не сокращение штата"},
            {"key": "money_saved", "label": "Денежная экономия (B)", "value": saved, "unit": "₽", "change_percent": 17.0, "data_status": "mixed", "formula": "fte_saved × average_monthly_fte_cost", "source": "Scenario Benchmark + методика"},
            {"key": "roi", "label": "ROI", "value": roi or 0, "unit": "%", "change_percent": 12.1, "data_status": "mixed", "formula": "(B − A) / A × 100%", "source": "Расчёт Radar", "assumption": "При A = 0 ROI не рассчитывается"},
            {"key": "net_benefit", "label": "Чистый эффект", "value": net, "unit": "₽", "change_percent": 29.4, "data_status": "mixed", "formula": "B − A", "source": "Расчёт Radar"},
        ]
        profitable = saved > cost
        return {
            "period": _period(),
            "provenance": _provenance(),
            "usage_and_cost": usage_kpis,
            "business_effect": effect_kpis,
            "is_profitable": profitable,
            "executive_conclusion": (
                f"B > A: AI окупается. Чистый эффект {net:,.0f} ₽ за месяц."
                if profitable
                else "B ≤ A: требуется оптимизация затрат и сценариев."
            ).replace(",", " "),
            "requests_by_day": daily,
            "cost_and_savings_by_month": copy.deepcopy(DEMO_MONTHS) if not filters.applied() else [{"month": "2026-07", "cost": cost, "money_saved": saved}],
            "top_agents": sorted(agents, key=lambda row: float(row["requests"]), reverse=True)[:4],
            "top_scenarios": [row for row in DEMO_SCENARIOS if any(row["agent_id"] == agent["id"] for agent in agents)][:4],
            "issues_and_recommendations": copy.deepcopy(DEMO_INSIGHTS),
            "best_practices": copy.deepcopy(self._practices[:3]),
            "applied_filters": filters.applied(),
        }

    def usage(self, filters: EnterpriseFilters) -> dict[str, Any]:
        agents = self._agents(filters)
        requests = sum(int(row["requests"]) for row in agents)
        users = sum(int(row["mau"]) for row in agents)
        role_counts: dict[str, int] = {}
        for agent in agents:
            per_role = round(int(agent["mau"]) / max(len(agent["roles"]), 1))
            for role in agent["roles"]:
                role_counts[str(role)] = role_counts.get(str(role), 0) + per_role
        return {
            "period": _period(),
            "provenance": _provenance(0.0),
            "items": [
                {"dimension": "agent", "name": row["name"], "requests": row["requests"], "mau": row["mau"], "requests_per_user": row["requests"] / row["mau"]}
                for row in agents
            ],
            "summary": {
                "total_requests": requests,
                "successful_requests": sum(int(row["successful_requests"]) for row in agents),
                "failed_requests": sum(int(row["failed_requests"]) for row in agents),
                "success_rate": sum(int(row["successful_requests"]) for row in agents) / requests * 100 if requests else 0,
                "error_rate": sum(int(row["failed_requests"]) for row in agents) / requests * 100 if requests else 0,
                "dau": round(users * 0.42),
                "wau": round(users * 0.73),
                "mau": users,
                "unique_users": users,
                "requests_per_user": requests / users if users else 0,
                "requests_by_role": [{"role": key, "mau": value} for key, value in sorted(role_counts.items(), key=lambda item: item[1], reverse=True)],
            },
            "applied_filters": filters.applied(),
        }

    def agents(self, filters: EnterpriseFilters) -> dict[str, Any]:
        items = self._agents(filters)
        return {"period": _period(), "provenance": _provenance(), "items": items, "summary": {"count": len(items), "profitable": sum(row["status"] == "profitable" for row in items), "loss_making": sum(row["status"] == "loss_making" for row in items), "insufficient_data": sum(row["status"] == "insufficient_data" for row in items)}, "applied_filters": filters.applied()}

    def models(self, filters: EnterpriseFilters) -> dict[str, Any]:
        grouped: dict[str, dict[str, Any]] = {}
        for agent in self._agents(filters):
            row = grouped.setdefault(str(agent["model"]), {"model": agent["model"], "requests": 0, "prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0, "cost": 0.0, "successful_requests": 0, "failed_requests": 0, "agents": []})
            for key in ("requests", "prompt_tokens", "completion_tokens", "total_tokens", "successful_requests", "failed_requests"):
                row[key] += int(agent[key])
            row["cost"] += float(agent["cost"])
            row["agents"].append(agent["name"])
        for row in grouped.values():
            row["success_rate"] = row["successful_requests"] / row["requests"] if row["requests"] else 0
            row["error_rate"] = row["failed_requests"] / row["requests"] if row["requests"] else 0
        return {"period": _period(), "provenance": _provenance(0.18), "items": list(grouped.values()), "summary": {"tariffs": copy.deepcopy(DEMO_MODEL_TARIFFS)}, "applied_filters": filters.applied()}

    def tools(self, filters: EnterpriseFilters) -> dict[str, Any]:
        allowed_agents = {row["id"] for row in self._agents(filters)}
        items = [copy.deepcopy(row) for row in DEMO_TOOLS if any(agent in allowed_agents for agent in row["agents"])]
        if filters.tool:
            items = [row for row in items if _normalize(str(row["tool_name"])) == _normalize(filters.tool)]
        return {"period": _period(), "provenance": _provenance(0.12), "items": items, "summary": {"tool_calls": sum(int(row["usages"]) for row in items), "most_used": items[0]["tool_name"] if items else None}, "applied_filters": filters.applied()}

    def departments(self, filters: EnterpriseFilters) -> dict[str, Any]:
        items = copy.deepcopy(DEMO_DEPARTMENTS) if self._period_overlaps(filters) and not filters.user else []
        if filters.department:
            items = [row for row in items if _normalize(str(row["department"])) == _normalize(filters.department)]
        return {"period": _period(), "provenance": _provenance(), "items": items, "summary": {"departments": len(items), "low_adoption": [row["department"] for row in items if row["adoption_rate"] < 0.6], "scaling_potential": [row["department"] for row in items if row["confirmed_saving_share"] < 0.6]}, "applied_filters": filters.applied()}

    def costs(self, filters: EnterpriseFilters) -> dict[str, Any]:
        components = [row for row in self._cost_components if row["category"] != "development_team" or self._methodology["include_development_team"]]
        total = sum(float(row["amount"]) for row in components)
        estimated = sum(float(row["amount"]) for row in components if row["is_estimated"])
        return {"period": _period(), "provenance": _provenance(estimated / total if total else 0), "items": copy.deepcopy(components), "summary": {"total_ai_cost": total, "actual_cost": total - estimated, "estimated_cost": estimated, "currency": "RUB", "formula": "Token + Inference + Infrastructure + Hardware + Electricity + Subscription + Support + Other"}, "applied_filters": filters.applied()}

    def business_effect(self, filters: EnterpriseFilters) -> dict[str, Any]:
        agents = self._agents(filters)
        items = [{key: row[key] for key in ("id", "name", "time_saved_minutes", "time_saved_hours", "fte_saved", "money_saved", "cost", "net_benefit", "roi", "payback_ratio", "status", "data_status", "confidence")} for row in agents]
        total_cost = sum(float(row["cost"]) for row in agents)
        money_saved = sum(float(row["money_saved"]) for row in agents)
        return {"period": _period(), "provenance": _provenance(), "items": items, "summary": {"time_saved_minutes": sum(float(row["time_saved_minutes"]) for row in agents), "time_saved_hours": sum(float(row["time_saved_hours"]) for row in agents), "fte_saved": sum(float(row["fte_saved"]) for row in agents), "money_saved": money_saved, "total_ai_cost": total_cost, "net_benefit": money_saved - total_cost, "roi": (money_saved - total_cost) / total_cost * 100 if total_cost else None, "payback_ratio": money_saved / total_cost if total_cost else None, "is_profitable": money_saved > total_cost, "fte_definition": "Эквивалент высвобождённого рабочего времени, не количество уволенных сотрудников."}, "applied_filters": filters.applied()}

    def roi(self, filters: EnterpriseFilters) -> dict[str, Any]:
        payload = self.business_effect(filters)
        payload["summary"] = {key: payload["summary"][key] for key in ("total_ai_cost", "money_saved", "net_benefit", "roi", "payback_ratio", "is_profitable")}
        return payload

    def insights(self, filters: EnterpriseFilters) -> dict[str, Any]:
        return {"period": _period(), "provenance": _provenance(), "items": copy.deepcopy(DEMO_INSIGHTS), "summary": {"engine": "rule-based-v1"}, "applied_filters": filters.applied()}

    def methodology(self) -> dict[str, Any]:
        return {**copy.deepcopy(self._methodology), "model_tariffs": copy.deepcopy(DEMO_MODEL_TARIFFS), "scenario_benchmarks": copy.deepcopy(DEMO_BENCHMARKS)}

    def update_methodology(self, value: MethodologyUpdate) -> dict[str, Any]:
        self._methodology.update(value.model_dump())
        self._methodology["monthly_work_minutes_per_fte"] = value.monthly_work_hours_per_fte * 60
        self._methodology["data_status"] = "demo"
        return self.methodology()

    def list_cost_components(self) -> list[dict[str, Any]]:
        return copy.deepcopy(self._cost_components)

    def create_cost_component(self, value: CostComponentInput) -> dict[str, Any] | None:
        # Held in process memory: bound it so the list cannot grow without limit.
        if len(self._cost_components) >= MAX_COST_COMPONENTS:
            return None
        row = {"id": str(uuid.uuid4()), **value.model_dump(mode="json")}
        self._cost_components.append(row)
        return copy.deepcopy(row)

    def update_cost_component(self, component_id: str, value: CostComponentInput) -> dict[str, Any] | None:
        for index, row in enumerate(self._cost_components):
            if row["id"] == component_id:
                updated = {"id": component_id, **value.model_dump(mode="json")}
                self._cost_components[index] = updated
                return copy.deepcopy(updated)
        return None

    def delete_cost_component(self, component_id: str) -> bool:
        before = len(self._cost_components)
        self._cost_components = [row for row in self._cost_components if row["id"] != component_id]
        return len(self._cost_components) != before

    def practices(self) -> list[dict[str, Any]]:
        return copy.deepcopy(self._practices)

    def practice(self, practice_id: str) -> dict[str, Any] | None:
        return next((copy.deepcopy(row) for row in self._practices if row["id"] == practice_id), None)

    def transition_practice(self, practice_id: str, action: str, actor: str) -> dict[str, Any] | None:
        row = next((item for item in self._practices if item["id"] == practice_id), None)
        if row is None:
            return None
        targets = {"review": "under_review", "approve": "approved", "reject": "rejected", "publish": "published"}
        row["status"] = targets[action]
        if action == "approve":
            row["approved_by"] = actor
            row["approved_at"] = datetime.now(UTC).isoformat()
        return copy.deepcopy(row)

    def recommend_practice(self, practice_id: str, departments: list[str], owner: str | None, comment: str | None) -> dict[str, Any] | None:
        row = next((item for item in self._practices if item["id"] == practice_id), None)
        if row is None:
            return None
        row["status"] = "scaling"
        row["recommended_departments"] = sorted(set(row["recommended_departments"] + departments))
        adoption_rows = self._adoptions.setdefault(practice_id, [])
        existing = {item["target_department"] for item in adoption_rows}
        for department in departments:
            if department not in existing:
                adoption_rows.append({"id": str(uuid.uuid4()), "practice_id": practice_id, "target_department": department, "status": "recommended", "recommended_at": datetime.now(UTC).isoformat(), "accepted_at": None, "first_usage_at": None, "active_users": 0, "usages": 0, "time_saved_after_adoption": 0, "money_saved_after_adoption": 0, "owner": owner, "comment": comment})
        row["adoption_count"] = len(adoption_rows)
        return copy.deepcopy(row)

    def adoptions(self, practice_id: str) -> list[dict[str, Any]] | None:
        if self.practice(practice_id) is None:
            return None
        return copy.deepcopy(self._adoptions.get(practice_id, []))

    def upsert_adoption(self, practice_id: str, value: PracticeAdoptionInput) -> dict[str, Any] | None:
        if self.practice(practice_id) is None:
            return None
        rows = self._adoptions.setdefault(practice_id, [])
        row = next((item for item in rows if item["target_department"] == value.target_department), None)
        now = datetime.now(UTC).isoformat()
        if row is None:
            row = {"id": str(uuid.uuid4()), "practice_id": practice_id, "recommended_at": now, "accepted_at": None, "first_usage_at": None}
            rows.append(row)
        row.update(value.model_dump())
        if value.status in {"accepted", "pilot", "adopted"} and row.get("accepted_at") is None:
            row["accepted_at"] = now
        if value.usages > 0 and row.get("first_usage_at") is None:
            row["first_usage_at"] = now
        return copy.deepcopy(row)


enterprise_analytics_service = EnterpriseAnalyticsService()
