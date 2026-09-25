# Восстановление production после компрометации frontend

Этот порядок применим к инциденту 24 сентября 2026 года. Старый frontend
container и его image не используются повторно.

## 1. Заменить секреты на сервере

В `/var/www/Arvexo-Radar/.env` заменить все секреты, доступные прежнему
frontend через `env_file`. Минимальный набор:

- `POSTGRES_PASSWORD` и пароль в `ARVEXO_DATABASE_URL`;
- ключи LLM-провайдеров, включая `ARVEXO_BOTHUB_API_KEY` и
  `ARVEXO_LLM_PROXY_API_KEY`;
- `ARVEXO_ANALYTICS_USER_HASH_SALT`;
- `ARVEXO_RADAR_CLIENT_SECRET`;
- `ARVEXO_RADAR_SESSION_SECRET`.

Добавить фиксированный callback URL:

```dotenv
ARVEXO_RADAR_CALLBACK_URL=https://radar.arvexo.ru/auth/callback
```

После замены установить права только для владельца:

```bash
chmod 600 /var/www/Arvexo-Radar/.env
```

Старые `.env.backup-*` и `.env.save` сначала сохранить в защищённом
incident-evidence хранилище, затем удалить с сервера. Они не должны оставаться
читаемыми локальными пользователями.

## 2. Опубликовать и развернуть проверенный source tree

После merge security-изменений в `main` CI собирает immutable image с тегом
`sha-<commit>`. CD перед запуском сохраняет оба image tag в `.env`, поэтому
последующий `docker compose up` сможет восстановить все сервисы.

Проверить результат на сервере без печати `.env`:

```bash
cd /var/www/Arvexo-Radar
docker compose -f docker-compose.prod.yml ps
curl -fsS https://radar.arvexo.ru/api/v1/health
curl -fsS https://radar.arvexo.ru/api/v1/ready
curl -fsS https://radar.arvexo.ru/ >/dev/null
```

Ожидается работающий `web` на loopback port `38080`, а публичный `/` должен
отвечать 200. Web запускается непривилегированным UID `1001` с read-only root
filesystem, no-new-privileges, без Linux capabilities и без mount Docker socket.
