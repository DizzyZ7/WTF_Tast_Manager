import type { Workspace } from "../entities/workspace.js";
import type { UserId, WorkspaceId } from "../value-objects/entity-id.js";
import type { WorkspaceSlug } from "../value-objects/workspace-slug.js";

/**
 * Репозиторий workspace-агрегатов.
 */
export interface WorkspaceRepository {
  /** Сохраняет workspace целиком в одной транзакционной границе. */
  save(workspace: Workspace): Promise<void>;
  /** Ищет workspace по идентификатору. */
  findById(id: WorkspaceId): Promise<Workspace | null>;
  /** Ищет workspace по slug. */
  findBySlug(slug: WorkspaceSlug): Promise<Workspace | null>;
  /** Ищет корпоративный workspace по внутреннему номеру. */
  findByInternalNumber(internalNumber: string): Promise<Workspace | null>;
  /** Возвращает workspace, где пользователь является участником. */
  listByUserId(userId: UserId): Promise<ReadonlyArray<Workspace>>;
}
