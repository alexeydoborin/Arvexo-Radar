# Arvexo Radar: критический market research

**Срез источников: 17 сентября 2026.** Функция отмечена как существующая только при наличии явного подтверждения в официальном продукте/документации. «—» означает, что подтверждение не найдено, а не доказанное отсутствие функции. Рыночные оценки разных исследователей не складываются: их границы рынков существенно пересекаются.

## Executive summary

1. **Концепция не уникальна.** Ближе всего к задуманному Radar уже находятся Fiddler (связывает ML-метрики и business KPI, RCA), Datadog/Dynatrace (AI trace + APM/infrastructure + cost; AI-assisted investigation), Arize (product observability, custom metrics, Alyx), а в России — Proto (business observability, AI-RCA и рекомендации) и Artimate (корреляция IT-сигналов и инцидентов). Доказательства приведены ниже.
2. **Но ниша всё ещё есть.** Большинство LLMOps-платформ — Langfuse, LangSmith, Braintrust, Helicone, W&B/Weave, MLflow — оптимизируют инженерный цикл: traces, evals, quality, latency, token/cost. Они не заявляют готовую, доменно-нейтральную связку с продуктовой аналитикой, финансовыми KPI и доказательным причинным объяснением результата. Это не означает, что такую связку нельзя собрать через их custom metadata/API.
3. **Риск ложного позиционирования высок.** Нельзя говорить «первые, кто объединяет технические, бизнес- и продуктовые сигналы», «первые AI-generated RCA/recommendations», «единственная платформа для agent observability» или «единственные, кто связывает cost/quality/latency». Эти функции есть хотя бы частично у Fiddler, Datadog, Dynatrace, Arize и российских AIOps.
4. **Честный wedge:** не заменять MLOps/observability, а стать integration-first *AI value intelligence layer* для российских enterprise-контуров: единая модель «AI use case → пользователь/сегмент → outcome/KPI → unit economics», причинная гипотеза с уровнем уверенности и evidence links, playbook/recommendation с owner и измерением результата. Защитимость возникает только при накоплении коннекторов, нормализованной онтологии и feedback-loop по фактическому эффекту, а не из UI/LLM-саммари.
5. **Рекомендованный рынок для слайда:** не общий «AI market». Использовать глобальный MLOps как внешний верхний ориентир и отдельный bottom-up SAM. Консервативно: global TAM = **$2.19bn (2024)** MLOps, GVR; Russia SAM = **150–400** крупных организаций с production ML/GenAI × **₽1.5–5m** ACV = **₽0.23–2.0bn ARR**. Это сценарная модель, не измеренный объём российского рынка.

## 1. Российские конкуренты и аналоги

| Компания / продукт | Позиционирование и аудитория | Подтверждённые данные / функции | Развёртывание, цена | Что это означает для Radar |
|---|---|---|---|---|
| [Neoflex / Dognauts](https://neoflex.dognauts.ru/) (Россия) | Enterprise ML/LLM/AgentOps для DS/ML/Platform teams | ML registry, pipelines, online/batch inference; monitoring качества данных/моделей, drift, technical metrics и alerts (Evidently, Grafana, Prometheus, Jaeger); LLM quality evaluation/prompts; AgentOps: orchestration, guardrails, полный trace calls/prompts/tools и audit. Product/business KPI, cost analytics, авто-RCA/recommendations — **не найдено подтверждение**. | On-prem или cloud; SSO/OIDC/RBAC/multitenancy, реестр российского ПО; публичной цены нет. | Самый близкий российский MLOps/AgentOps-конкурент. Radar нельзя продавать как замену lifecycle/trace платформе; выгоднее интегрироваться с ней. |
| [Cloud.ru / ML Inference + Evolution Stack](https://cloud.ru/docs/ml-inference/ug/topics/concepts__monitoring) (Россия) | ML teams, использующие managed inference/cloud | ML Inference отдаёт системные метрики в monitoring service и dashboards; стек включает MLflow/DVC/TensorFlow, ресурсный CPU/GPU monitoring. Подтверждения LLM/agent tracing, evals, model drift в продукте, business KPI/RCA/recommendations — нет (учебный курс описывает monitoring как практику, это не продуктовая функция). | Cloud; pricing зависит от ресурсов; enterprise cloud. | Инфраструктурная и serving-база, не intelligence layer. Не приписывать им шире, чем подтверждено. |
| [MWS / ML Platform](https://mws.ru/docs/ml0.html) (Россия) | Enterprise MLOps на Containerum/Kubernetes | ClearML для lifecycle, experiment tracking и visual comparison; MWS публично говорит о MLOps/LLMOps цепочке «training–testing–deployment–monitoring». Документация не подтверждает LLM/agent traces, evals, drift, KPI/cost/RCA/recommendations как продуктовые возможности. | Cloud/Kubernetes; публичной цены нет. | Скорее platform substrate, чем прямой analytics-конкурент; риск расширения провайдера есть. |
| [Yandex Cloud / DataSphere](https://cloud.yandex.ru/services/datasphere) (Россия) | DS/ML teams в YC | Managed notebooks, experiments, computing/deployment-экосистема. На проверенных публичных страницах **не найдено подтверждение** отдельного AI observability/LLM agent tracing, business KPI/RCA/recommendations. | Cloud, usage-based; есть публичный калькулятор YC. | Сильный ecosystem/channel risk, но не подтверждённый функциональный двойник Radar. |
| [VK Cloud / ML Platform, MLDeploy](https://vkcloud.kz/monitoring/) (Россия) | Cloud ML teams | Публичные материалы описывают JupyterHub, MLflow, MLOps/model serving и отдельные monitoring/logging/cost слои. Подтверждение сквозной AI intelligence-функции не найдено. | Cloud; цена по запросу/ресурсам. | Аналог инфраструктурной базы, вероятный источник telemetry. |
| [SberTech / Platform V Monitor](https://platformv.sbertech.ru/docs/public/OPM/7.0.30/common/documents/bamn-doc/documentation/documents/administration-guide/administration-scenarios-check.html) (Россия) | IT operations / enterprise | Infrastructure/app monitoring и Business Activity Monitoring. Нет публичного подтверждения AI/ML/LLM-specific monitoring, agent traces, evals. | Enterprise/on-prem; цена не опубликована. | Конкурент только по business observability, не по AI observability. |
| [Proto Observability Platform](https://www.proto-observability.ru/) (Россия) | IT leadership, DevOps, monitoring, support | APM: traces, metrics, errors, logs/events/incidents; infrastructure, RUM, business observability. AI-RCA объединяет alerts, ищет root cause и даёт human-readable recommendation; AI analyst отвечает по metrics/logs/traces/incidents/resource-service model. ML/LLM/agent telemetry, evals/drift/model-quality — **не найдено подтверждение**. | Enterprise; публичная цена не найдена. | Очень опасный adjacent competitor: уже продаёт correlation + RCA + recommendation + business view. Radar должен быть явно AI-domain-specific. |
| [Artimate](https://artimate.ru/) (Россия) | AIOps для IT ops/IB | Собирает metrics/logs/events из monitoring/apps/services; ML baselines, anomaly detection, correlation/noise reduction/incidents, predictive monitoring и root-cause localization. ML/LLM model quality, agent tracing/evals, product KPI и LLM-generated recommendations — не подтверждены. | Российское ПО; цена по запросу. | Нельзя заявлять уникальную корреляцию сигналов/аномалии/RCA; отличие — семантика и outcome AI-систем. |
| [SmartMLOps, НИУ ВШЭ](https://mlops.hse.ru/doc_general) (Россия) | Размещение/управление AI services | Документация подтверждает платформу размещения и управления AI-сервисами. Для traces, drift, KPI/RCA, enterprise controls достаточного публичного подтверждения не найдено. | Академическая/проектная платформа; публичной цены нет. | Скорее reference/инфраструктурный аналог, не commercial intelligence rival. |
| MTS AI / MWS AI (Россия) | Заказные AI services и agents | Официальный сайт подтверждает заказную разработку, сопровождение, оценку эффективности и optimisation; standalone observability product с перечисленными функциями не подтверждён. | Enterprise services; нет публичной цены. | Channel/интеграционный, не доказанный product competitor. |

**Вывод по РФ.** Для таблицы конкурентов разумно выбрать Dognauts (AI lifecycle + AgentOps), Proto (business observability + AI-RCA) и Artimate (AIOps correlation). Cloud providers держать в appendix: у них есть инфраструктура и бюджет, но публичный feature overlap слабее.

## 2. Международный рынок

### Карта проверенных продуктов

| Продукт | Подтверждённая специализация | Важный предел / overlap с Radar |
|---|---|---|
| [Arize AX / Phoenix](https://arize.com/pricing) | ML/LLM observability, online evals, custom metrics/product observability, trace search; Phoenix — OSS/self-hosted; Alyx agent. | Значимый overlap в product observability и AI assistant. Из открытой product page не следует готовая интеграция корпоративных KPI или автоматическая причинность. |
| [Langfuse](https://langfuse.com/docs) | OSS/cloud LLM/agent traces/graphs, sessions/users, token & cost, dashboards, online/offline evals, alerts; Assistant может отвечать по project data. | Traces можно тегировать user/feature; готовая product/finance intelligence и RCA не подтверждена. |
| [LangSmith](https://www.langchain.com/pricing) | LLM/agent tracing, monitoring/evaluation, datasets/experiments; Engine анализирует traces, выявляет issues и предлагает fixes. | Очень близок в «AI-generated suggestions», но в границах agent stack; custom business KPI/cross-system analytics не подтверждены. |
| [Datadog Agent Observability](https://docs.datadoghq.com/llm_observability/) | Agent/LLM traces, quality/privacy/safety evals, cost/latency/usage; интеграция с APM/infrastructure. Cost view коррелирует spend с app performance, model/version/provider/prompt. | Наиболее опасный full-stack incumbent. Однако прямое, готовое связывание с revenue/product funnel и prescriptive business recommendation в AI product docs не подтверждено. |
| [Fiddler AI](https://www.fiddler.ai/analytics) | Traditional ML + LLM/agent observability; performance/drift/integrity, custom business KPIs, charts/correlation, RCA; agent telemetry/guardrails. | Ближайший функциональный двойник: публично заявляет unified view ML metrics + business KPI и drill-down RCA. |
| [WhyLabs](https://docs.whylabs.ai/docs/) | ML/AI observability/security: drift, data quality, performance/bias and root-cause of common ML issues. | Strong ML monitoring, но product/business KPI, agent tracing/recommendations не подтверждены. |
| [W&B Weave](https://wandb.ai/site/wp-content/uploads/2025/02/Evaluations-whitepaper.pdf) | Trace trees, evaluation/feedback, experiments and lineage for AI engineering. | Engineering/eval product; нет подтверждения enterprise KPI/RCA automation. |
| [MLflow Tracing](https://mlflow.org/docs/latest/genai/tracing) | OSS OTel-compatible LLM/agent tracing: inputs/outputs/intermediate metadata, debugging, quality/performance improvement. | Pluggable telemetry substrate, не готовый business intelligence layer. |
| [New Relic AI Monitoring](https://docs.newrelic.com/docs/ai-monitoring/intro-to-ai-monitoring/) | APM-based E2E LLM visibility: performance, cost, quality; user interactions; trace-level response; external LLM/vector-store metrics/events. | Similar full-stack story; KPI/RCA/recommendations as AI-specific product features не подтверждены. |
| [Dynatrace AI Observability](https://docs.dynatrace.com/docs/observe/dynatrace-for-ai-observability) | Full-stack AI/agent/app/infra telemetry; execution paths/tool/inter-agent calls, latency/cost/reliability; online LLM-as-judge; evaluation score linked as business event; Davis AI/GenAI. | Очень опасный competitor: claims user→orchestration→LLM→infra view and correlation. «Business event» не равно готовый revenue attribution/causal KPI model. |
| [Grafana Cloud Agent Observability](https://grafana.com/docs/grafana-cloud/observe-and-act/agent-observability/) | Agent/LLM telemetry in traces, Prometheus metrics and generations; agent evals/LLM-as-judge. | Open stack / ecosystem; business layer needs custom dashboard/integration. |
| Evidently AI | OSS/enterprise data & ML quality/drift monitoring. | Drift/data quality specialist; agent tracing/KPI/RCA recommendations не подтверждены в reviewed official material. |
| [Galileo](https://galileo.ai/) | AI observability + evaluation engineering; production guardrails/agent-specific metrics. | Quality/guardrail first; KPI/FinOps cross-signal/RCA not confirmed. |
| Braintrust | Evals, experiments, logging/traces for AI products. | Strong evaluation workflow; no confirmed product/business correlation/RCA. |
| Helicone | LLM gateway/observability, request logging, cost/latency analytics. | FinOps/logging layer; no confirmed business analytics/RCA. |
| Patronus AI | Enterprise AI evaluation, guardrails/reliability. | Evals/quality, not full telemetry/KPI layer in reviewed materials. |
| Humanloop | Prompt management, evaluation and observability workflow. | AI engineering workflow; not full-stack observability. |
| Maxim AI | Simulation/evaluation/observability for multimodal agent systems. | Agent quality workflow; no confirmed corporate KPI/RCA product layer. |

### 5–8 наиболее близких

1. **Fiddler AI** — наиболее прямое пересечение: ML/LLM + custom business KPI + correlation + RCA.
2. **Datadog** — LLM/agent observability уже соединён с APM/infra и cost-performance correlation.
3. **Dynatrace** — user-to-infra, agent topology, LLM-as-judge and business events.
4. **Arize** — product observability/custom metrics/Alyx плюс ML/LLM observability.
5. **LangSmith** — traces/evals и Engine с issue analysis/suggested fixes.
6. **New Relic** — user interaction + app/LLM/vector-store telemetry/cost/quality.
7. **Langfuse** — наиболее вероятный open-source/self-hosted baseline у команды; cover traces/cost/evals/users.
8. **Proto** (хотя российский) — не AI-model platform, но опасен именно для exec-level outcome/RCA narrative.

## 3. Проверка гипотезы о позиционировании

### A. Что уже существует

* Технические telemetry, LLM/agent traces, token/cost/latency: Langfuse, LangSmith, Datadog, Dynatrace, MLflow, New Relic, Grafana, Fiddler.
* Evals/quality and alerts: практически все специализированные LLMOps; Dynatrace explicitly supports online LLM-as-a-judge, Datadog — evals, Fiddler — LLM metrics.
* ML performance/drift/quality: Fiddler, WhyLabs, Arize, Evidently, Dognauts.
* Anomaly/correlation/RCA: Fiddler; Datadog/Dynatrace in full observability; Artimate and Proto in Russian AIOps.
* AI-generated explanation/recommendation: Arize Alyx; Langfuse Assistant; LangSmith Engine; Datadog Bits AI; Proto AI analyst/AI investigation. Scope and quality differ, but headline is not unique.

### B. Что встречается реже

* Out-of-the-box **semantic mapping** one AI feature/agent to a product funnel, customer segment, revenue/cost-to-serve and business owner.
* **Evidence-backed causal inference** (не корреляция): counterfactual/experiment-aware claim «AI change caused KPI change» with confidence and confounder disclosure.
* A closed loop: detect → explain → propose an action → assign owner → measure realised business impact across AI, product and finance systems.
* Russia-native integrations, residency/on-prem and localisation for this exact multi-signal workflow.

### C. Делает ли кто-то уже «то же самое»?

**Частично да.** Fiddler is the clearest functional overlap. Datadog and Dynatrace can cover a large portion if the customer already has their observability ecosystem and instruments business events. Proto/Artimate cover the cross-signal incident intelligence story, though not AI model semantics. Therefore Radar cannot credibly claim a greenfield category. It can claim a narrower, implementation-specific proposition only after proving integrations and outcome workflows.

### D. Итог по гипотезе

Гипотеза **частично подтверждается, но в сильной формулировке опровергается**. Engineering/ML lifecycle действительно является default focus у LLMOps tools. Но large observability incumbents and Fiddler already cross the boundary to application, user, infrastructure and selected business signals. A defensible statement:

> «Arvexo Radar планируется как integration-first AI value intelligence layer для enterprise: он дополняет MLOps/LLMOps и observability, нормализуя их telemetry вместе с product/finance signals в evidence-backed explanations and outcome playbooks.»

Не использовать слова «первый», «единственный» и «automatically proves causality» до независимого подтверждения.

## 4. Конкурентная таблица для презентации

Легенда: **✓** подтверждено; **△** ограниченно/через custom integration; **—** не найдено подтверждение; **P** planned (Radar, не текущая функция).

| Критерий | Arvexo Radar | Dognauts | Proto | Artimate | Fiddler | Datadog | Dynatrace |
|---|---|---|---|---|---|---|---|
| ML/LLM observability | P | ✓ | — | — | ✓ | ✓ | ✓ |
| Agent tracing | P | ✓ | — | — | ✓ | ✓ | ✓ |
| Evals / quality | P | ✓ | — | — | ✓ | ✓ | ✓ |
| Drift / anomaly | P | ✓ | — | ✓ | ✓ | △ | △ |
| Cost analytics | P | — | — | — | △ | ✓ | ✓ |
| Infrastructure signals | P | ✓ | ✓ | ✓ | △ | ✓ | ✓ |
| Product analytics | P | — | △ (business obs.) | — | △ (custom KPIs) | △ (APM/RUM) | △ (user/business events) |
| Business KPI integration | P | — | ✓ | △ (business services) | ✓ | △ | △ |
| Cross-signal correlation | P | △ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Root cause analysis | P | — | ✓ | ✓ | ✓ | ✓ | ✓ |
| AI-generated explanations | P | — | ✓ | — | △ | ✓ | ✓ |
| Recommendations | P | — | ✓ | △ | △ | △ | △ |
| Основной пользователь | Product/ML/Eng/FinOps (planned) | ML/Platform | IT/DevOps | IT Ops | ML/AI/Business | Eng/SRE/AI | Eng/SRE/Platform |
| Позиционирование | AI value intelligence (planned) | AI lifecycle/AgentOps | business IT observability | AIOps | AI control plane/observability | full-stack monitoring | full-stack AI observability |

*Примечание:* △ у RCA/recommendation западных platforms означает «подтверждены инструменты investigation/AI assistant или suggested fixes», но не универсальная autonomous business recommendation. Именно это различие должно быть показано в speaker notes, а не замаскировано плюсом.

## 5. Market evidence: почему размеры расходятся

| Источник (дата) | Market definition/geography | Base year/size | Forecast / CAGR | Оценка качества |
|---|---|---:|---:|---|
| [Grand View Research, May 2025](https://www.grandviewresearch.com/press-release/global-mlops-market) | Global MLOps, platform/service | 2024: **$2.19bn** | 2030: **$16.61bn**, 40.5% CAGR (2025–30) | Reputable commercial research; definition broad, paid report. Good external TAM anchor. |
| [Fortune Business Insights, current page](https://www.fortunebusinessinsights.com/mlops-market-108986) | Global MLOps | 2025: **$2.98bn** | 2026 $4.39bn → 2034 $89.91bn, 45.8% CAGR | Independent commercial estimate; much more aggressive than GVR. Present as range, not reconcile by addition. |
| Gartner / IDC public materials | No public, comparable standalone “AI observability market” number found in reviewed sources | — | — | Do **not** fabricate a dedicated AI-observability TAM. Gartner/IDC paid taxonomies may slice it differently. |
| [IDC, 2025 FutureScape](https://info.idc.com/rs/081-ATC-910/images/US-IDC-FutureScape-2025-GenAI_ebook.pdf) | Worldwide AI solutions spend, not observability/MLOps | 2025: **$307bn** enterprise AI solutions spend | n/a in public excerpt | Useful macro-context only; invalid as Radar TAM. |
| [IDC, Mar 2026](https://www.idc.com/resource-center/blog/ai-infrastructure-spending-caps-historic-year-at-90-billion-in-q4-2025-2029-spending-to-eclipse-1-trillion/) | Worldwide AI infrastructure spending, not MLOps | Q4 2025: **$89.9bn** | 2029 >$1tn annual | Macro demand signal, not software TAM. |
| Russian market | No methodologically transparent, current public estimate found specifically for Russian MLOps/AI observability that can serve as TAM | — | — | Use bottom-up Russia TAM/SAM, and label it as a scenario. Do not quote generic “AI market” as addressable Radar revenue. |

**LLMOps/AI observability caveat.** Public vendor/SEO pages often label an adjacent LLM application platform or general observability number as “LLMOps market.” Without a transparent published definition, base year and geography, it should not enter investor math. This is a material finding, not a missing research step.

## 6. TAM / SAM / SOM models

All currency conversions intentionally avoided: exchange rate volatility would create false precision. These models express annual software revenue opportunity, not total AI spend.

### Model A — global, top-down (external orientation only)

* **TAM:** $2.19bn global MLOps (GVR 2024) to $2.98bn (FBI 2025). Treat **$2.2–3.0bn** as a comparability range, *not* MLOps+LLMOps+observability summed together.
* **SAM:** use a transparent assumption: 20–35% of MLOps spend is enterprise production monitoring/observability/value-analytics scope. **$0.44–1.05bn**. It is an assumption; validate with customer discovery and budget data.
* **SOM:** bottom-up 20–60 global lighthouse customers × $40k–100k annual contract value = **$0.8–6.0m ARR**. This is sales capacity/product proof constrained, not share-of-market math.

### Model B — Russia

No defensible standalone Russian MLOps market published publicly was found. Thus do not lead with a made-up ₽ TAM.

* **TAM (scenario):** 300–800 large Russian organizations likely to operate meaningful ML/GenAI workloads × ₽1.5–5m potential software ACV = **₽0.45–4.0bn ARR**. The organisation count is an assumption, bracketed widely.
* **SAM:** select regulated/data-heavy verticals (banking/insurance, telecom, retail/e-commerce, industrial/logistics, large digital/public platforms): 150–400 × ₽1.5–5m = **₽0.23–2.0bn ARR**.
* **SOM, 36 months:** 10–30 paid enterprise customers × ₽1.5–3m = **₽15–90m ARR**; implementation/service revenue must be reported separately.

### Model C — bottom-up recommended decision model

| Scenario | Target accounts | Early-adopter conversion | Customers | ACV | SOM ARR |
|---|---:|---:|---:|---:|
| Conservative | 150 | 7% | 10–11 | ₽1.5m | ₽15–16.5m |
| Base | 250 | 10% | 25 | ₽2.5m | ₽62.5m |
| Ambitious | 400 | 12.5% | 50 | ₽3.0m | ₽150m |

Assumptions to validate: (1) “production AI” qualification in ICP; (2) ability to connect at least an LLM/ML telemetry source plus product and cost source; (3) procurement/security constraint; (4) annual rather than pilot-only budget. A discovery survey/interviews must replace the 150–400 count before an investment committee treats it as a fact.

## 7. Pricing benchmark (public list prices where available)

| Vendor | Developer/startup | Team | Enterprise / deployment | Pricing unit |
|---|---|---|---|---|
| [Arize AX](https://arize.com/pricing) | Phoenix OSS free/self-hosted; AX Free 25k spans/mo, 1GB, 15d | AX Pro **$50/mo**, 50k spans/10GB | Enterprise quote; support/security | spans/ingestion + plan |
| [Langfuse](https://langfuse.com/pricing) | Hobby free, 50k units/mo | Core **$29/mo**, Pro **$199/mo**; usage after 100k: $8/100k units (volume declines) | Enterprise **$2,499/mo** plus usage; Teams add-on $300/mo; self-hosted free | stored trace/observation/score unit + subscription |
| [LangSmith](https://www.langchain.com/pricing) | Developer $0/seat, 5k base traces/mo | Plus **$39/seat/mo**, 10k traces + PAYG | Custom; self-hosted/hybrid, SSO/RBAC/ABAC/SLA | seat + LCUs ($1.50) / LSUs ($1) and trace usage |
| [Fiddler](https://www.fiddler.ai/) | Free plan; Developer **$0.002/trace** (current site) | Usage based | Quote; SaaS/VPC/on-prem, support | traces / enterprise contract |
| [Datadog](https://www.datadoghq.com/pricing/list/) | free allowance may apply | Agent Observability sold as add-on | quote/volume discount typical | LLM spans plus existing Datadog products |
| WhyLabs | Self-serve free entry is documented | public fixed team price not found | enterprise quote | usage/contract |

**ACV implication, not recommendation.** Developer tools establish a low self-serve reference ($29–199/month; $348–2,388/year). An enterprise Radar price needs a different value unit: per monitored production AI use case, environment, or included correlated events—not per raw trace alone. Test **₽1.5–3m annual platform ACV** for one/few use cases, with higher tiers for data retention, on-prem, SSO/RBAC/audit, data connectors and support. Price validation needs 15–20 ICP interviews and 3 paid design partners; do not infer willingness-to-pay from US list prices.

## 8. Slide-ready market trends

* **Production remains difficult:** Gartner’s 2024 survey, published 12 Jun 2025, says only **41% of GenAI prototypes** and **42% of non-GenAI prototypes** reached production. This supports monitoring/quality need, not a claim that every pilot needs Radar. [Source](https://www.gartner.com/en/documents/6587902).
* **Cost/ROI governance is a priority:** FinOps Foundation’s 2025 report identifies *Managing AI/ML spend* as one of the largest priority increases and frames AI activities as understanding cost/usage and quantifying business value. [Source](https://data.finops.org/2025-report/).
* **AI infrastructure spend is scaling:** IDC reports **$89.9bn** worldwide AI infrastructure spend in Q4 2025, +62% YoY. This is an infrastructure metric, not Radar addressable spend. [Source](https://www.idc.com/resource-center/blog/ai-infrastructure-spending-caps-historic-year-at-90-billion-in-q4-2025-2029-spending-to-eclipse-1-trillion/).
* **Inference economics move fast:** Stanford AI Index 2025 reports a >**280×** decline in MMLU-equivalent inference cost between Nov 2022 and Oct 2024 ($20 to $0.07 per million tokens). Lower unit price does not remove total cost governance as volumes/agents grow. [Source](https://hai.stanford.edu/assets/files/hai_ai_index_report_2025.pdf).
* **Russia adoption signal:** Yandex reported in Dec 2025 that more than **70% of large Russian companies** use generative AI. Treat as vendor-sponsored survey/market signal, not a count of production-observability buyers. [Source](https://yandex.ru/company/news/08-12-2025-01).

## 9. Final recommendations

### Closest competitors and threat

1. **Top 5:** Fiddler AI, Datadog, Dynatrace, Arize, LangSmith.
2. **Top 3 Russia:** Neoflex Dognauts, Proto, Artimate.
3. **Most dangerous threat:** Datadog/Dynatrace for customers already using a full-stack observability suite; Fiddler for a buyer whose primary problem is model-to-business KPI analytics. The threat is not merely feature parity: telemetry, integrations and procurement are already in place.
4. **Most compelling differentiation:** Russia-/enterprise-ready integration layer that turns existing telemetry, product events and financial/cost data into an auditable *AI outcome graph* and owner-specific playbooks. Defend with data model, connectors, workflow adoption and realised-outcome feedback—not generic “AI insights.”
5. **Claims not to make:** first/only cross-signal observability; first RCA or recommendation engine; first connection of technical metrics to business KPI; unique cost-quality-latency correlation; unique agent tracing; unique AI explanations. Each is contradicted or at least weakened by named evidence above.

### Recommended slide: competitive landscape

**Headline:** “Не ещё один tracer: слой доказательного AI outcome management над существующим stack.”

Place a 2×2: horizontal = *engineering telemetry → product/financial outcome*; vertical = *observe → explain/recommend*. Put Langfuse/LangSmith/MLflow on left-lower/middle; Dognauts at engineering/agentops; Proto/Artimate at IT outcome/explain; Fiddler, Datadog, Dynatrace in upper-middle/right; **Arvexo Radar (planned)** in upper-right with a dashed outline. Footnote: “Positioning hypothesis; incumbents already cover parts of the quadrant. Differentiation requires validated connectors and outcome evidence.”

### Recommended slide: TAM / SAM / SOM

**Headline:** “Не складываем пересекающиеся рынки; считаем достижимый enterprise ARR.”

* **TAM (external benchmark):** $2.2–3.0bn global MLOps (2024–25, GVR/FBI), not a sum of MLOps/LLMOps/observability.
* **Russia SAM (scenario):** 150–400 qualifying large enterprises × ₽1.5–5m ACV = ₽0.23–2.0bn ARR. Mark the entire bar “assumption to validate.”
* **SOM (36 months, base):** 25 customers × ₽2.5m = **₽62.5m ARR**. Show conservative ₽15–16.5m and ambitious ₽150m brackets in small type.
* Footer: “Exclude implementation services; customer count and ACV require discovery validation.”

## Primary-source bibliography (accessed 17 Sep 2026)

Product claims rely on the linked official pages in the tables. Key evidence pages: [Dognauts](https://neoflex.dognauts.ru/), [Proto](https://www.proto-observability.ru/), [Artimate](https://artimate.ru/), [Cloud.ru ML Inference](https://cloud.ru/docs/ml-inference/ug/topics/concepts__monitoring), [MWS ML Platform](https://mws.ru/docs/ml0.html), [Fiddler analytics](https://www.fiddler.ai/analytics), [Fiddler RCA docs](https://docs.fiddler.ai/observability/analytics), [Datadog Agent Observability](https://docs.datadoghq.com/llm_observability/), [Datadog cost](https://docs.datadoghq.com/llm_observability/investigate/cost/), [Dynatrace AI Observability](https://docs.dynatrace.com/docs/observe/dynatrace-for-ai-observability), [New Relic AI monitoring](https://docs.newrelic.com/docs/ai-monitoring/intro-to-ai-monitoring/), [MLflow tracing](https://mlflow.org/docs/latest/genai/tracing), [Langfuse docs](https://langfuse.com/docs), [LangSmith pricing/Engine](https://www.langchain.com/pricing), and [Arize pricing/product page](https://arize.com/pricing).
