# WTF (Work Task Flow)

WTF - self-hosted open-source платформа управления задачами и проектами с real-time совместной работой.

## Архитектурное решение

Проект устроен как `pnpm` + Turborepo монорепозиторий. Чистая доменная модель живет в `@wtf/core` и не зависит от транспорта, базы данных, React или runtime-валидации. Слои `@wtf/db`, `@wtf/api` и `@wtf/realtime` адаптируют этот домен к PostgreSQL, REST/OpenAPI и WebSocket/Yjs соответственно. UI-пакеты подключаются только после стабилизации доменных контрактов.

## Полное дерево монорепозитория

```text
WTF/
├─ .github/
│  └─ workflows/
│     └─ ci.yml
├─ apps/
│  └─ web/
│     ├─ src/
│     │  ├─ app/
│     │  │  ├─ globals.css
│     │  │  ├─ layout.tsx
│     │  │  └─ page.tsx
│     │  ├─ components/
│     │  │  ├─ WorkspaceShell.tsx
│     │  │  └─ issue-data.ts
│     │  └─ lib/
│     │     └─ wtf-api.ts
│     ├─ Dockerfile
│     ├─ README.md
│     ├─ next-env.d.ts
│     ├─ next.config.mjs
│     ├─ package.json
│     └─ tsconfig.json
├─ docs/
│  ├─ adr/
│  │  ├─ 001-tech-stack.md
│  │  ├─ 002-domain-boundaries.md
│  │  ├─ 003-realtime-collaboration.md
│  │  └─ 004-persistence.md
│  ├─ api/
│  │  └─ openapi.yaml
│  ├─ diagrams/
│  │  └─ domain-model.txt
│  └─ architecture.md
├─ infra/
│  ├─ minio/
│  │  └─ create-bucket.sh
│  └─ postgres/
│     └─ init.sql
├─ packages/
│  ├─ api/
│  ├─ core/
│  ├─ db/
│  ├─ realtime/
│  └─ ui/
├─ .dockerignore
├─ .env.example
├─ .gitignore
├─ .prettierignore
├─ .prettierrc.cjs
├─ commitlint.config.cjs
├─ docker-compose.yml
├─ eslint.config.mjs
├─ package.json
├─ pnpm-workspace.yaml
├─ tsconfig.base.json
├─ tsconfig.json
└─ turbo.json
```

## Быстрый запуск

```bash
corepack enable
corepack prepare pnpm@10.23.0 --activate
pnpm install
pnpm build
pnpm test
docker compose up --build
```

Локальные адреса после `docker compose up`:

- API: <http://localhost:8080>
- Swagger UI: <http://localhost:8080/documentation>
- Web: <http://localhost:3000>
- MinIO Console: <http://localhost:9001>

## Создание задач

Web-приложение пускает только email из `AUTH_ALLOWED_EMAILS`. После входа оно подготавливает локальный workspace `demo-workspace` и проект `WTF` для текущего пользователя. Owner/admin может добавить сотрудника в workspace прямо в боковой панели, если email уже есть в allow-list.
Задачи создаются кнопкой `Issue`, а на board-представлении карточки можно переносить между столбцами drag-and-drop или через select внутри карточки. API записывает в activity log, кто перенес задачу и кто закрыл ее в `Done`.

## Переменные окружения

Все секреты и allow-list email передаются через окружение. Локальный пример находится в `.env.example`; для production нужно заменить JWT/OAuth/S3 значения и `AUTH_ALLOWED_EMAILS` на значения конкретного окружения. Для сохранения существующего участника можно указать entry как `email=userId`.

## Разработка

```bash
pnpm dev
pnpm lint
pnpm typecheck
pnpm test:coverage
```

Доменная логика покрывается в `@wtf/core`, адаптеры проверяются отдельными тестами без запуска полной инфраструктуры.
