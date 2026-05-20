import { Redis } from "ioredis";

/**
 * Тип real-time события.
 */
export type RealtimeEventType = "yjs.update" | "presence.joined" | "presence.left";

/**
 * Real-time событие, распространяемое между инстансами.
 */
export interface RealtimeEvent {
  /** Тип события. */
  readonly type: RealtimeEventType;
  /** Идентификатор документа или комнаты. */
  readonly documentId: string;
  /** Пользователь или соединение, породившее событие. */
  readonly actorId: string;
  /** Время события в ISO 8601. */
  readonly occurredAt: string;
  /** Base64url-представление бинарного Yjs update. */
  readonly updateBase64?: string;
}

/**
 * Функция отписки от real-time событий.
 */
export type Unsubscribe = () => Promise<void>;

/**
 * Обработчик real-time события.
 */
export type RealtimeEventHandler = (event: RealtimeEvent) => void | Promise<void>;

/**
 * Event bus для распространения real-time событий.
 */
export interface RealtimeEventBus {
  /** Публикует событие. */
  publish(event: RealtimeEvent): Promise<void>;
  /** Подписывается на события документа. */
  subscribe(documentId: string, handler: RealtimeEventHandler): Promise<Unsubscribe>;
}

/**
 * In-memory event bus для одиночного процесса и тестов.
 */
export class InMemoryRealtimeEventBus implements RealtimeEventBus {
  private readonly handlers = new Map<string, Set<RealtimeEventHandler>>();

  /**
   * Публикует событие всем локальным подписчикам.
   */
  public async publish(event: RealtimeEvent): Promise<void> {
    const handlers = this.handlers.get(event.documentId) ?? new Set<RealtimeEventHandler>();
    await Promise.all(
      [...handlers].map(async (handler) => {
        await handler(event);
      }),
    );
  }

  /**
   * Подписывает обработчик на документ.
   */
  public subscribe(documentId: string, handler: RealtimeEventHandler): Promise<Unsubscribe> {
    const handlers = this.handlers.get(documentId) ?? new Set<RealtimeEventHandler>();
    handlers.add(handler);
    this.handlers.set(documentId, handlers);

    return Promise.resolve(() => {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.handlers.delete(documentId);
      }
      return Promise.resolve();
    });
  }
}

/**
 * Redis pub/sub event bus для горизонтального масштабирования realtime слоя.
 */
export class RedisRealtimeEventBus implements RealtimeEventBus {
  private readonly publisher: Redis;
  private readonly subscriber: Redis;

  /**
   * Создает Redis event bus.
   */
  public constructor(redisUrl: string) {
    this.publisher = new Redis(redisUrl);
    this.subscriber = new Redis(redisUrl);
  }

  /**
   * Публикует событие в Redis channel документа.
   */
  public async publish(event: RealtimeEvent): Promise<void> {
    await this.publisher.publish(channelName(event.documentId), JSON.stringify(event));
  }

  /**
   * Подписывает обработчик на Redis channel документа.
   */
  public async subscribe(documentId: string, handler: RealtimeEventHandler): Promise<Unsubscribe> {
    const channel = channelName(documentId);
    const listener = (receivedChannel: string, payload: string): void => {
      if (receivedChannel !== channel) {
        return;
      }

      const parsed = JSON.parse(payload) as RealtimeEvent;
      void handler(parsed);
    };

    this.subscriber.on("message", listener);
    await this.subscriber.subscribe(channel);

    return async () => {
      this.subscriber.off("message", listener);
      await this.subscriber.unsubscribe(channel);
    };
  }

  /**
   * Закрывает Redis-соединения.
   */
  public close(): Promise<void> {
    this.publisher.disconnect();
    this.subscriber.disconnect();
    return Promise.resolve();
  }
}

function channelName(documentId: string): string {
  return `wtf:realtime:${documentId}`;
}
