# @wtf/api

`@wtf/api` - Fastify REST API для WTF.

## Архитектурное решение

API не содержит бизнес-инвариантов. Он валидирует вход через Zod, вызывает агрегаты из `@wtf/core`, сохраняет их через репозитории и возвращает snapshots. Фабрика `createApiServer` принимает зависимости, поэтому маршруты тестируются без PostgreSQL.

Аутентификация строится вокруг allow-list `AUTH_ALLOWED_EMAILS`: токены выдаются только разрешенным email, `userId` генерируется сервером из email или берется из entry формата `email=userId`, а write-операции проверяют членство пользователя в workspace. Перенос issue между статусами выполняется через API и пишет `actorId`/`actorEmail` в activity log.

## Команды

```bash
pnpm --filter @wtf/api dev
pnpm --filter @wtf/api test
```

## Документация API

Swagger UI доступен по `/documentation`, OpenAPI-контракт хранится в `docs/api/openapi.yaml`.

## Основные маршруты

- `GET /v1/workspaces/by-slug/{slug}` - поиск workspace для идемпотентной загрузки web-клиента.
- `POST /v1/workspaces/{workspaceId}/members` - добавление участника по email из allow-list.
- `GET /v1/workspaces/{workspaceId}/projects/by-key/{key}` - поиск project по ключу.
- `GET /v1/workspaces/{workspaceId}/projects/{projectId}/issues` - список issue проекта.
- `POST /v1/workspaces/{workspaceId}/projects/{projectId}/issues` - создание issue.
- `PATCH /v1/issues/{issueId}/status` - перенос issue между столбцами с аудитом исполнителя.
