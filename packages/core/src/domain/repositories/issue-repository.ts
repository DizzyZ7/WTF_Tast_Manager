import type { Issue } from "../entities/issue.js";
import type { IssueId, ProjectId, WorkspaceId } from "../value-objects/entity-id.js";
import type { IssueKey } from "../value-objects/project-key.js";

/**
 * Репозиторий issue-агрегатов.
 */
export interface IssueRepository {
  /** Сохраняет issue целиком в одной транзакционной границе. */
  save(issue: Issue): Promise<void>;
  /** Ищет issue по идентификатору. */
  findById(id: IssueId): Promise<Issue | null>;
  /** Ищет issue по ключу внутри workspace. */
  findByWorkspaceAndKey(workspaceId: WorkspaceId, key: IssueKey): Promise<Issue | null>;
  /** Считает issue проекта без ограничения страницы. */
  countByProject(projectId: ProjectId): Promise<number>;
  /** Возвращает issue проекта с ограничением размера страницы. */
  findByProject(projectId: ProjectId, limit: number): Promise<ReadonlyArray<Issue>>;
}
