import { invalidArgument } from "../../shared/domain-error.js";

type BrandedString<TBrand extends string> = string & { readonly __brand: TBrand };

/**
 * Идентификатор пользователя.
 */
export type UserId = BrandedString<"UserId">;

/**
 * Идентификатор workspace.
 */
export type WorkspaceId = BrandedString<"WorkspaceId">;

/**
 * Идентификатор project.
 */
export type ProjectId = BrandedString<"ProjectId">;

/**
 * Идентификатор sprint.
 */
export type SprintId = BrandedString<"SprintId">;

/**
 * Идентификатор issue.
 */
export type IssueId = BrandedString<"IssueId">;

/**
 * Идентификатор comment.
 */
export type CommentId = BrandedString<"CommentId">;

/**
 * Идентификатор activity.
 */
export type ActivityId = BrandedString<"ActivityId">;

/**
 * Идентификатор relation между задачами.
 */
export type RelationId = BrandedString<"RelationId">;

/**
 * Идентификатор доменного события.
 */
export type DomainEventId = BrandedString<"DomainEventId">;

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Проверяет UUID и возвращает брендированный идентификатор.
 */
export function parseEntityId<TBrand extends string>(
  value: string,
  label: string,
): BrandedString<TBrand> {
  if (!uuidPattern.test(value)) {
    throw invalidArgument(`${label} должен быть UUID`, { label, value });
  }

  return value as BrandedString<TBrand>;
}

/**
 * Создает новый UUID как брендированный идентификатор.
 */
export function newEntityId<TBrand extends string>(): BrandedString<TBrand> {
  return crypto.randomUUID() as BrandedString<TBrand>;
}

/**
 * Преобразует строку в `UserId`.
 */
export function userId(value: string): UserId {
  return parseEntityId<"UserId">(value, "userId");
}

/**
 * Преобразует строку в `WorkspaceId`.
 */
export function workspaceId(value: string): WorkspaceId {
  return parseEntityId<"WorkspaceId">(value, "workspaceId");
}

/**
 * Преобразует строку в `ProjectId`.
 */
export function projectId(value: string): ProjectId {
  return parseEntityId<"ProjectId">(value, "projectId");
}

/**
 * Преобразует строку в `IssueId`.
 */
export function issueId(value: string): IssueId {
  return parseEntityId<"IssueId">(value, "issueId");
}
