# @wtf/realtime

`@wtf/realtime` содержит WebSocket/Yjs слой совместной работы.

## Архитектурное решение

CRDT-обновления применяются к `Y.Doc` в памяти процесса и публикуются через `RealtimeEventBus`. Для одного инстанса используется `InMemoryRealtimeEventBus`, для нескольких инстансов - `RedisRealtimeEventBus`.

## Команды

```bash
pnpm --filter @wtf/realtime test
pnpm --filter @wtf/realtime build
```
