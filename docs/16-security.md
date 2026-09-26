# Arvexo Radar: безопасность

**Версия:** v0.1.0 — Hackathon MVP
**Статус:** security specification

## 1. Security objectives

1. Не допустить раскрытия raw requests, PII и secrets через downstream processing.
2. Не позволить неавторизованный доступ к dataset/run/report другого tenant.
3. Безопасно принимать недоверенные CSV.
4. Ограничить внешнюю передачу и хранение provider data.
5. Сохранить целостность аналитических результатов и provenance.
6. Обеспечить безопасную диагностику и bounded resource use.

## 2. Data classification

| Класс | Примеры | Обращение |
|---|---|---|
| Restricted | raw prompts, detected secrets, provider API key | Минимальный доступ, encryption, no logs/external transfer |
| Confidential | masked prompts, user/team metadata, samples | Tenant-scoped, controlled UI/report |
| Internal | aggregates, model/config provenance | Authorized product users |
| Public | product documentation без customer data | Обычное распространение |

## 3. Threats и controls

### SEC-01 — Malicious upload

Controls: allowlist CSV, signature/MIME checks, streaming byte limit, safe parser, generated storage name, no archive extraction, row/token limits, quarantine до validation.

### SEC-02 — CSV Injection

Controls: никогда не исполнять значения; экранировать formula prefixes при CSV/Excel-compatible export; тестировать `=`, `+`, `-`, `@`, tabs и leading whitespace variants.

### SEC-03 — Sensitive-data leakage

Controls: masking boundary до embeddings/LLM, no raw text in logs/errors, masked preview, restricted storage references, secret canary tests.

### SEC-04 — Prompt injection в анализируемом тексте

Dataset text считается данными, а не инструкцией. Provider prompt помещает excerpts в data field/structured delimiter и запрещает следовать содержащимся командам. Output schema и evidence validation ограничивают результат.

### SEC-05 — External LLM exposure

Controls: minimization, masked excerpts, provider abstraction, server-side key, allowlisted endpoint, timeout/retry limits, no full 100k-token prompt, documented provider mode/provenance.

### SEC-06 — IDOR / broken access control

Controls: tenant/principal scope в repository, opaque UUID, authorization до lookup/download, negative tests.

Реализация: каждый аккаунт Arvexo Account работает в собственном tenant (`uuid5` от id пользователя, `backend/app/api/auth.py`). Датасеты, прогоны, отчёты и найденные практики видны и изменяемы только владельцем; чужой ресурс отвечает 404. Общие демо-данные (демо-аналитика, демо-каталог практик, методика и cost components) доступны всем на чтение, а менять их и видеть org-wide телеметрию LLM proxy могут только администраторы из `ARVEXO_ADMIN_EMAILS`. Actor в аудите практик — email из сессии, а не значение из тела запроса. Проверяется `backend/tests/test_tenant_isolation.py` на реальном Postgres.

### SEC-07 — Denial of service

Controls: upload/row/token/concurrency limits, rate limiting, job leases, bounded batches, timeouts, cancellation, DB connection limits.

Реализация: маскирование работает за линейное время, разбор CSV вынесен из event loop; на аккаунт действуют лимиты `ARVEXO_UPLOAD_LIMIT_PER_HOUR`, `ARVEXO_RUN_LIMIT_PER_DAY`, `ARVEXO_REPORT_LIMIT_PER_HOUR`, квота `ARVEXO_TENANT_STORAGE_QUOTA_BYTES` и общий лимит изменений `ARVEXO_RATE_LIMIT_PER_MINUTE`; загрузки отклоняются при свободном месте ниже `ARVEXO_MIN_FREE_DISK_BYTES` и сверх `ARVEXO_MAX_CONCURRENT_UPLOADS`. nginx добавляет per-IP `limit_req` и пускает тело >1 МБ только на `/api/v1/datasets`.

### SEC-08 — Stored XSS / unsafe rendering

Controls: React escaping, no raw HTML, sanitized report renderer, CSP/security headers, safe download disposition.

CSP web-приложения выставляется на каждый запрос в `frontend/proxy.ts` с nonce и `'strict-dynamic'` вместо `'unsafe-inline'` для скриптов. Изменяющие запросы к API с чужим `Origin`/`Referer` (включая соседние поддомены `*.arvexo.ru`, для которых `SameSite=Lax` не работает) отклоняются с `CROSS_SITE_REQUEST_REJECTED`. Вебвизор Яндекс Метрики не включается на `/app`.

### SEC-09 — Secret/config compromise

Controls: environment/secret injection, `.env` excluded from Git, redact configuration, least-privilege DB user, key rotation procedure. Mock mode requires no key.

### SEC-10 — Analytical integrity

Controls: immutable runs, checksums, config/model provenance, typed evidence links, transactional stage writes and explicit degraded status.

## 4. Authentication и authorization

Каждый запрос к `/api/*` (кроме health/ready) требует подписанную cookie сессии Arvexo Account; без `ARVEXO_RADAR_SESSION_SECRET` API отказывает всем (fail closed). Проверка отключается только явным `ARVEXO_AUTH_MODE=none` (локальная разработка и тесты), и `Settings` запрещает это в production. Роли: пользователь (свой tenant) и администратор (`ARVEXO_ADMIN_EMAILS`).

Минимальные logical permissions: dataset upload/read, analysis create/read, report create/download, administration. Реальное назначение ролей утверждается до production deployment.

## 5. Masking limitations

Regex/detectors не гарантируют нахождение всех PII/secrets и могут давать false positives. Finding называется потенциальным. Raw-to-masked mapping не возвращается клиенту. При сомнении внешний provider получает меньше контекста или не вызывается.

## 6. Logging и audit

Application logs: correlation/request/run/job IDs, event, safe counts, duration, error code. Запрещены request body, CSV row, masked sample при ненужности, authorization token, API key, DB URL и provider request/response.

Audit events MVP: upload, mapping change, run create/cancel, report generation/download, auth failure и administrative configuration change. Retention не фиксируется до policy.

## 7. Storage и transport

- HTTPS обязателен вне localhost; TLS termination documented.
- PostgreSQL credentials не используются browser/frontend.
- Volumes не публикуются как static directories.
- Encryption at rest зависит от deployment environment и обязательно для production profile.
- Backup не должен обходить retention/access policy.

## 8. LLM provider policy

API endpoint и модель allowlisted configuration. Provider key не хранится в DB. Payload budget и allowed fields фиксированы для каждой operation. Provider failure body redacted. Cache содержит только structured sanitized output и hashes.

Local provider предназначен для тестирования и проходит тот же schema/masking contract; «локальный» не означает автоматически доверенный.

## 9. Safe errors

Клиент получает stable code, safe message, retryability и correlation ID. Stack trace, path, SQL, raw value и provider body исключены. Unexpected error возвращает общий message и фиксируется безопасно.

## 10. Security verification

- malicious/malformed CSV corpus;
- formula injection tests;
- PII/secret canaries across UI/API/PDF/log/provider mock capture;
- tenant isolation/IDOR tests;
- prompt injection dataset tests;
- file/token/rate/concurrency boundary tests;
- dependency and container scanning в CI после появления кода;
- manual review external payload schema.

## 11. Incident handling MVP

При подозрении на утечку: остановить affected runs/provider mode, сохранить безопасные metadata, ротировать ключ, ограничить download, определить affected datasets по audit IDs и задокументировать решение. Полный корпоративный incident process определяется владельцем deployment.

## 12. Acceptance criteria

- **SEC-AC-01:** raw request не появляется в logs, UI, PDF или external provider payload.
- **SEC-AC-02:** secret canary заменён до embeddings/LLM.
- **SEC-AC-03:** другой tenant не может узнать/скачать resource.
- **SEC-AC-04:** oversized/unsupported upload отклонён безопасно.
- **SEC-AC-05:** production не стартует в demo auth mode случайно.
- **SEC-AC-06:** rate limit возвращает `429` без обработки job.

## 13. Открытые security decisions

До production: identity provider, RBAC mapping, retention/deletion policy, encryption implementation, backup policy, data residency и contractual BotHub/Gemini data handling.

## 14. Связанные документы

- [Dataset](./08-dataset.md)
- [Architecture](./09-architecture.md)
- [API](./15-api.md)
- [Deployment](./17-deployment.md)

