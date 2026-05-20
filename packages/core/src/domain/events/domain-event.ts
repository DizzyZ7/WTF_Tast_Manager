import type { DomainEventId, IssueId, ProjectId, WorkspaceId } from "../value-objects/entity-id.js";
import { newEntityId } from "../value-objects/entity-id.js";

/**
 * Тип доменного события.
 */
export type DomainEventType =
  | "workspace.created"
  | "workspace.member_added"
  | "workspace.member_role_changed"
  | "workspace.member_removed"
  | "project.created"
  | "project.sprint_created"
  | "project.archived"
  | "issue.created"
  | "issue.status_changed"
  | "issue.assigned"
  | "issue.comment_added"
  | "issue.subtask_added"
  | "issue.relation_added";

/**
 * Доменное событие, публикуемое агрегатом после изменения состояния.
 */
export interface DomainEvent<
  TType extends DomainEventType = DomainEventType,
  TPayload extends Readonly<Record<string, unknown>> = Readonly<Record<string, unknown>>,
> {
  /** Уникальный идентификатор события. */
  readonly id: DomainEventId;
  /** Тип события. */
  readonly type: TType;
  /** Идентификатор workspace, к которому относится событие. */
  readonly workspaceId: WorkspaceId;
  /** Идентификатор измененного агрегата. */
  readonly aggregateId: WorkspaceId | ProjectId | IssueId;
  /** Время возникновения события в ISO 8601. */
  readonly occurredAt: string;
  /** Полезная нагрузка события. */
  readonly payload: TPayload;
}

/**
 * Создает доменное событие с новым идентификатором.
 */
export function createDomainEvent<
  TType extends DomainEventType,
  TPayload extends Readonly<Record<string, unknown>>,
>(input: {
  readonly type: TType;
  readonly workspaceId: WorkspaceId;
  readonly aggregateId: WorkspaceId | ProjectId | IssueId;
  readonly occurredAt: Date;
  readonly payload: TPayload;
}): DomainEvent<TType, TPayload> {
  return {
    id: newEntityId<"DomainEventId">(),
    type: input.type,
    workspaceId: input.workspaceId,
    aggregateId: input.aggregateId,
    occurredAt: input.occurredAt.toISOString(),
    payload: input.payload,
  };
}
