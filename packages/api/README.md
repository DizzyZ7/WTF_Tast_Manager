# @wtf/api

`@wtf/api` - Fastify REST API для WTF.

## Архитектурное решение

API не содержит бизнес-инвариантов. Он валидирует вход через Zod, вызывает агрегаты из `@wtf/core`, сохраняет их через репозитории и возвращает snapshots. Фабрика `createApiServer` принимает зависимости, поэтому маршруты тестируются без PostgreSQL.

Аутентификация использует обычную регистрацию с email и паролем, обязательным подтверждением email и серверной генерацией `userId`. После подтверждения email пользователь входит через `/v1/auth/login`, получает JWT pair, а write-операции проверяют членство пользователя в workspace. Перенос issue между статусами выполняется через API и пишет `actorId`/`actorEmail` в activity log.

Письма подтверждения уходят через SMTP-переменные `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM`. Если `SMTP_HOST` пустой, verification link пишется в лог API.

Личный task manager создается как обычный workspace без `internalNumber`. Корпоративный workspace задает `internalNumber`; внешний пользователь отправляет заявку по этому номеру, а подтверждать ее может только владелец workspace. В корпоративном workspace прямое добавление участников тоже доступно только владельцу.

## Команды

```bash
pnpm --filter @wtf/api dev
pnpm --filter @wtf/api test
```

## Документация API

Swagger UI доступен по `/documentation`, OpenAPI-контракт хранится в `docs/api/openapi.yaml`.

## Основные маршруты

- `POST /v1/auth/register` - создать учетку и отправить письмо подтверждения email.
- `GET /v1/auth/verify-email?token=...` - подтвердить email по кнопке из письма.
- `POST /v1/auth/resend-verification` - повторно отправить письмо подтверждения для неподтвержденной учетки.
- `POST /v1/auth/login` - войти по email и паролю, выпустить JWT pair.
- `POST /v1/auth/refresh` - обновить JWT pair по refresh token.
- `GET /v1/workspaces` - список workspace, где текущий пользователь является участником.
- `GET /v1/workspaces/by-slug/{slug}` - поиск workspace для идемпотентной загрузки web-клиента.
- `POST /v1/workspaces/join-requests` - запросить доступ к корпоративному workspace по внутреннему номеру.
- `GET /v1/workspaces/{workspaceId}/join-requests` - pending-заявки доступа для владельца.
- `POST /v1/workspaces/{workspaceId}/join-requests/{requestId}/approve` - подтвердить заявку владельцем.
- `POST /v1/workspaces/{workspaceId}/members` - добавление зарегистрированного и подтвержденного участника; в корпоративном workspace доступно только владельцу.
- `GET /v1/workspaces/{workspaceId}/projects/by-key/{key}` - поиск project по ключу.
- `GET /v1/workspaces/{workspaceId}/projects/{projectId}/issues` - список issue проекта.
- `POST /v1/workspaces/{workspaceId}/projects/{projectId}/issues` - создание issue.
- `PATCH /v1/issues/{issueId}/status` - перенос issue между столбцами с аудитом исполнителя.
