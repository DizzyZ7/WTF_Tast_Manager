import type { Workspace } from "../entities/workspace.js";
import type { WorkspaceId } from "../value-objects/entity-id.js";
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
}
