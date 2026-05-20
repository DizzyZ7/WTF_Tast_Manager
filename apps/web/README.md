# @wtf/web

`@wtf/web` - Next.js приложение WTF.

## Архитектурное решение

Приложение потребляет `@wtf/ui` и держит клиентское состояние в Zustand. Оно не импортирует persistence-слой и не выполняет доменные операции напрямую: создание и чтение задач идут через REST-контракт `@wtf/api`, а ответы валидируются Zod-схемами в локальном API client.

При первом открытии пользователь вводит рабочий email. API выпускает токены только для email из `AUTH_ALLOWED_EMAILS`, затем browser client находит или создает workspace `demo-workspace`, находит или создает проект `WTF` и загружает issue проекта. Owner/admin добавляет участников в боковой панели. Кнопка `Issue` открывает форму создания задачи, а board-представление позволяет переносить карточки между столбцами с записью исполнителя в activity log.

## Команды

```bash
pnpm --filter @wtf/web dev
pnpm --filter @wtf/web build
pnpm --filter @wtf/web test
```

## Переменные окружения

- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_REALTIME_URL`
