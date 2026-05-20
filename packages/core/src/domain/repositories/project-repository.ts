import type { Project } from "../entities/project.js";
import type { ProjectId, WorkspaceId } from "../value-objects/entity-id.js";
import type { ProjectKey } from "../value-objects/project-key.js";

/**
 * Репозиторий project-агрегатов.
 */
export interface ProjectRepository {
  /** Сохраняет project целиком в одной транзакционной границе. */
  save(project: Project): Promise<void>;
  /** Ищет project по идентификатору. */
  findById(id: ProjectId): Promise<Project | null>;
  /** Ищет project по workspace и ключу. */
  findByWorkspaceAndKey(workspaceId: WorkspaceId, key: ProjectKey): Promise<Project | null>;
}
