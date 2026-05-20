# @wtf/db

`@wtf/db` реализует PostgreSQL persistence layer для доменных агрегатов WTF.

## Архитектурное решение

Схема нормализована: workspace members, sprints, comments, subtasks, relations и activity log хранятся отдельными таблицами. Репозитории сохраняют агрегат транзакционно, потому что `@wtf/core` отдает целостный snapshot агрегата.

## Команды

```bash
pnpm --filter @wtf/db build
pnpm --filter @wtf/db drizzle-kit generate
```

## Переменные окружения

- `DATABASE_URL` - PostgreSQL connection string.
