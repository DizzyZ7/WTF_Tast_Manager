import { and, eq } from "drizzle-orm";
import type { ProjectRepository } from "@wtf/core";
import type { Project, ProjectId, ProjectKey, WorkspaceId } from "@wtf/core";
import type { WtfDatabase } from "../connection.js";
import { projects, sprints } from "../schema/index.js";
import { mapProject } from "./mappers.js";

/**
 * PostgreSQL-реализация репозитория project.
 */
export class PgProjectRepository implements ProjectRepository {
  /**
   * Создает репозиторий с готовым Drizzle database client.
   */
  public constructor(private readonly db: WtfDatabase) {}

  /**
   * Сохраняет project и его sprint-коллекцию в транзакции.
   */
  public async save(project: Project): Promise<void> {
    const snapshot = project.toSnapshot();
    await this.db.transaction(async (tx) => {
      await tx
        .insert(projects)
        .values({
          id: snapshot.id,
          workspaceId: snapshot.workspaceId,
          key: snapshot.key,
          name: snapshot.name,
          status: snapshot.status,
          leadUserId: snapshot.leadUserId,
          createdAt: new Date(snapshot.createdAt),
          updatedAt: new Date(snapshot.updatedAt),
        })
        .onConflictDoUpdate({
          target: projects.id,
          set: {
            name: snapshot.name,
            status: snapshot.status,
            updatedAt: new Date(snapshot.updatedAt),
          },
        });

      await tx.delete(sprints).where(eq(sprints.projectId, snapshot.id));

      if (snapshot.sprints.length > 0) {
        await tx.insert(sprints).values(
          snapshot.sprints.map((sprint) => ({
            id: sprint.id,
            projectId: snapshot.id,
            name: sprint.name,
            goal: sprint.goal,
            startsAt: new Date(sprint.startsAt),
            endsAt: new Date(sprint.endsAt),
            status: sprint.status,
          })),
        );
      }
    });
  }

  /**
   * Ищет project по идентификатору.
   */
  public async findById(id: ProjectId): Promise<Project | null> {
    const [row] = await this.db.select().from(projects).where(eq(projects.id, id)).limit(1);
    if (row === undefined) {
      return null;
    }

    const sprintRows = await this.db.select().from(sprints).where(eq(sprints.projectId, id));
    return mapProject(row, sprintRows);
  }

  /**
   * Ищет project по workspace и key.
   */
  public async findByWorkspaceAndKey(
    workspaceId: WorkspaceId,
    key: ProjectKey,
  ): Promise<Project | null> {
    const [row] = await this.db
      .select()
      .from(projects)
      .where(and(eq(projects.workspaceId, workspaceId), eq(projects.key, key)))
      .limit(1);
    if (row === undefined) {
      return null;
    }

    const sprintRows = await this.db.select().from(sprints).where(eq(sprints.projectId, row.id));
    return mapProject(row, sprintRows);
  }
}
