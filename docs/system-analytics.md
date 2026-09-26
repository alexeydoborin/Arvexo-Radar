# Системная аналитика LLM proxy

Модуль измеряет только техническое поведение proxy и провайдера. Он не оценивает
содержание ответа, бизнес-эффект, качество модели или экономию времени.

## Источники данных

| Поле | Источник |
|---|---|
| `request_id` | UUID, создаваемый Radar |
| `started_at` | UTC непосредственно перед отправкой upstream-запроса |
| `first_token_at` | UTC при первом непустом streaming-чанке провайдера |
| `completed_at` | UTC после JSON-ответа или завершения/обрыва потока |
| `model`, `stream` | валидированный OpenAI-compatible запрос |
| `status`, `http_status` | итог proxy/upstream transport |
| `error_type`, `error_message` | безопасная техническая классификация; тело запроса/ответа не включается |
| `messages_count` | длина массива `messages` |
| `input_characters` | сумма длин строковых значений `message.content` |
| token fields | объект `usage` JSON-ответа или финального SSE-чанка |
| cost fields | token fields и действующий тариф модели |
| `user_id_hash` | SHA-256 от `server_salt + NUL + user_id` |
| `department`, `scenario` | Radar metadata |

Тексты `messages`, ответы модели, полное тело запроса и полное тело ответа в
`llm_request_events` не сохраняются. Исходный `user_id` не сохраняется и не
возвращается API аналитики.

## Metadata

Metadata можно передать объектом верхнего уровня:

```json
{
  "model": "DeepSeek-V4-Flash",
  "messages": [{"role": "user", "content": "..."}],
  "metadata": {
    "user_id": "employee-42",
    "department": "IT",
    "scenario": "knowledge-assistant"
  }
}
```

или заголовками `X-Radar-User-Id`, `X-Radar-Department`,
`X-Radar-Scenario`. Заголовки имеют приоритет. Объект `metadata` и заголовки
`X-Radar-*` не отправляются LLM provider.

## Схема БД

### `llm_request_events`

Первичный ключ — `request_id UUID`. Таблица содержит UTC timestamps,
`model`, `stream`, terminal status/HTTP/error, latency/TTFT, входные счётчики,
token usage, `NUMERIC(24,12)` стоимости, валюту отчётности, SHA-256 пользователя,
department и scenario. Индексы покрывают `started_at` вместе с model,
department, scenario, status, error type и user hash.

### `model_tariffs`

- `model_name`;
- `input_price_per_1m_tokens NUMERIC(24,12)`;
- `output_price_per_1m_tokens NUMERIC(24,12)`;
- `currency CHAR/VARCHAR(3)`;
- `effective_from TIMESTAMPTZ`;
- `effective_to TIMESTAMPTZ NULL`.

Цена выбирается по model, `ARVEXO_ANALYTICS_CURRENCY` и интервалу
`effective_from <= started_at < effective_to`. Для открытого интервала
`effective_to` равен `NULL`. Цены не зашиты в исходный код или миграцию.

Пример операционного добавления тарифа:

```sql
INSERT INTO model_tariffs (
  id, created_at, model_name,
  input_price_per_1m_tokens, output_price_per_1m_tokens,
  currency, effective_from, effective_to
) VALUES (
  gen_random_uuid(), now(), 'DeepSeek-V4-Flash',
  :input_price, :output_price,
  'RUB', :effective_from, NULL
);
```

Перед вводом нового тарифа текущему тарифу задаётся `effective_to`. Пересекающиеся
интервалы нельзя создавать операционно; при нескольких совпадениях Radar
детерминированно берёт запись с максимальным `effective_from`.

## Формулы

Все вычисления стоимости выполняются `Decimal`, без промежуточного округления:

```text
latency_ms = completed_at - started_at
time_to_first_token_ms = first_token_at - started_at

input_cost = prompt_tokens / 1_000_000 * input_price_per_1m_tokens
output_cost = completion_tokens / 1_000_000 * output_price_per_1m_tokens
total_cost = input_cost + output_cost

success_rate = successful_requests / total_requests * 100
error_rate = failed_requests / total_requests * 100
avg_tokens_per_request = sum(total_tokens) / total_requests
avg_cost_per_request = sum(total_cost) / total_requests
requests_per_user = total_requests / count(distinct user_id_hash)
```

Median и p95 рассчитываются PostgreSQL `percentile_cont`. DAU/WAU/MAU — число
уникальных `user_id_hash` за последние 1/7/30 суток перед `date_to` (или текущим
UTC-временем). Денежные поля хранятся без округления; JSON отображает до 12
знаков после запятой.

Если provider не прислал usage или подходящий тариф отсутствует, неизвестные
token/cost поля события остаются `NULL`, а не подменяются нулём. Агрегаты
возвращают ноль для пустого набора и суммируют только наблюдаемые значения.

## Классификация ошибок

- `provider_error` — upstream HTTP/transport error без более точной категории;
- `timeout` — timeout соединения/чтения;
- `rate_limit` — HTTP 429;
- `authentication_error` — HTTP 401/403;
- `content_filter` — provider content/safety policy;
- `tool_error` — ошибка tool/function execution;
- `invalid_response` — некорректный JSON/SSE или входной envelope;
- `internal_proxy_error` — внутренняя ошибка Radar или disconnect клиента.

При закрытии клиентом streaming-соединения событие финализируется со status
`error` и техническим HTTP status `499`.

## API

Общие необязательные параметры: `date_from`, `date_to` (ISO-8601, UTC,
полуоткрытый интервал `[date_from, date_to)`), `model`, `department`, `scenario`.

- `GET /api/analytics/overview` — totals, rates, latency median/p95/TTFT,
  tokens, costs, unique users, model/error/day breakdowns;
- `GET /api/analytics/models` — сравнение моделей;
- `GET /api/analytics/errors` — error shares и затронутые модели/scenarios;
- `GET /api/analytics/usage` — DAU/WAU/MAU, requests/user и breakdowns.

## Запуск и проверка

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -e "backend[dev]"
docker compose up --build
docker compose exec api alembic upgrade head
.\.venv\Scripts\python.exe -m pytest backend
.\.venv\Scripts\python.exe -m ruff check backend
```

Production требует уникальный секрет `ARVEXO_ANALYTICS_USER_HASH_SALT`,
`ARVEXO_LLM_PROXY_BASE_URL`, provider key (или входящий Authorization) и единую
валюту отчётности `ARVEXO_ANALYTICS_CURRENCY=RUB`. Если задан серверный
`ARVEXO_LLM_PROXY_API_KEY`, агенты обязаны передавать
`Authorization: Bearer <ARVEXO_LLM_PROXY_CLIENT_TOKEN>`; без настроенного токена
proxy отвечает 401 и не расходует серверный ключ. Конвертация валют вне scope MVP.
