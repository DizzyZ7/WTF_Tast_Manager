import type { ActivityId, UserId } from "../value-objects/entity-id.js";
import { newEntityId } from "../value-objects/entity-id.js";

/**
 * Действие, отображаемое в activity log задачи.
 */
export type ActivityVerb =
  | "created"
  | "status_changed"
  | "assigned"
  | "commented"
  | "subtask_added"
  | "relation_added";

/**
 * Снимок activity log записи.
 */
export interface ActivitySnapshot {
  /** Идентификатор записи. */
  readonly id: ActivityId;
  /** Пользователь, выполнивший действие. */
  readonly actorId: UserId;
  /** Тип действия. */
  readonly verb: ActivityVerb;
  /** ISO-время действия. */
  readonly occurredAt: string;
  /** Безопасные структурированные детали действия. */
  readonly metadata: Readonly<Record<string, unknown>>;
}

/**
 * Создает activity log запись.
 */
export function createActivity(input: {
  readonly actorId: UserId;
  readonly verb: ActivityVerb;
  readonly occurredAt: Date;
  readonly metadata?: Readonly<Record<string, unknown>>;
}): ActivitySnapshot {
  return {
    id: newEntityId<"ActivityId">(),
    actorId: input.actorId,
    verb: input.verb,
    occurredAt: input.occurredAt.toISOString(),
    metadata: input.metadata ?? {},
  };
}
