# Changelog

Все существенные изменения Arvexo Radar документируются в этом файле. Формат основан на Keep a Changelog; версии следуют Semantic Versioning после начала релизов.

## [0.3.0] — 2026-09

Enterprise Effectiveness MVP.

### Added

- Системная телеметрия, OpenAI-совместимый LLM proxy и аналитика `/api/analytics/*`.
- TCO/ROI: Cost Components, методика, Scenario Benchmarks, Time Saved, FTE Saved, Net Benefit, ROI.
- AI Best Practices и Knowledge Discovery: Impact Score, workflow review → approve → publish, adoption.
- Загрузка собственного CSV, анализ датасета, экспорт CSV по практикам.
- Redesign интерфейса, вход через Arvexo Account (SSO), публичный лендинг.
- Заголовки безопасности API, smoke-проверки лендинга и SSO-редиректов в CD.

### Changed

- Demo-сценарий и FAQ для жюри переписаны под v0.3.0.

### Known limitations

- Процентные изменения на Home — статичные значения макета.
- Chunking записей в 100k токенов не реализован; классификация и кластеризация — объяснимый baseline.
- Demo-аналитика питается синтетическим набором; production-адаптеры HR/FinOps — интеграционная задача.

## [Unreleased]

### Added

- Полный комплект product и engineering specifications для v0.1.0.
- Формализованные requirements для secure upload, local analytics, explainability, dashboard и PDF.
- ADR для provider abstraction, отказа от H100, 100k-token average и PostgreSQL-backed jobs.

### Changed

- Vision, Business Problem и Stakeholders уточнены по официальному ТЗ КРОК и решениям владельца продукта.

## [0.1.0] — planned

Hackathon MVP. Релиз не объявлен: исходный код и проверенная реализация ещё отсутствуют.

[Unreleased]: ./docs/18-roadmap.md

