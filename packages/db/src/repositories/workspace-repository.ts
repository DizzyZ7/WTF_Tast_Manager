import { eq } from "drizzle-orm";
import type { WorkspaceRepository } from "@wtf/core";
import type { Workspace, WorkspaceId, WorkspaceSlug } from "@wtf/core";
import type { WtfDatabase } from "../connection.js";
import { workspaceMembers, workspaces } from "../schema/index.js";
import { mapWorkspace } from "./mappers.js";

/**
 * PostgreSQL-реализация репозитория workspace.
 */
export class PgWorkspaceRepository implements WorkspaceRepository {
  /**
   * Создает репозиторий с готовым Drizzle database client.
   */
  public constructor(private readonly db: WtfDatabase) {}

  /**
   * Сохраняет workspace и его участников в транзакции.
   */
  public async save(workspace: Workspace): Promise<void> {
    const snapshot = workspace.toSnapshot();
    await this.db.transaction(async (tx) => {
      await tx
        .insert(workspaces)
        .values({
          id: snapshot.id,
          name: snapshot.name,
          slug: snapshot.slug,
          internalNumber: snapshot.internalNumber,
          createdAt: new Date(snapshot.createdAt),
          updatedAt: new Date(snapshot.updatedAt),
        })
        .onConflictDoUpdate({
          target: workspaces.id,
          set: {
            name: snapshot.name,
            slug: snapshot.slug,
            internalNumber: snapshot.internalNumber,
            updatedAt: new Date(snapshot.updatedAt),
          },
        });

      await tx.delete(workspaceMembers).where(eq(workspaceMembers.workspaceId, snapshot.id));

      if (snapshot.members.length > 0) {
        await tx.insert(workspaceMembers).values(
          snapshot.members.map((member) => ({
            workspaceId: snapshot.id,
            userId: member.userId,
            role: member.role,
            joinedAt: new Date(member.joinedAt),
          })),
        );
      }
    });
  }

  /**
   * Ищет workspace по идентификатору.
   */
  public async findById(id: WorkspaceId): Promise<Workspace | null> {
    const [row] = await this.db.select().from(workspaces).where(eq(workspaces.id, id)).limit(1);
    if (row === undefined) {
      return null;
    }

    const members = await this.db
      .select()
      .from(workspaceMembers)
      .where(eq(workspaceMembers.workspaceId, id));
    return mapWorkspace(row, members);
  }

  /**
   * Ищет workspace по slug.
   */
  public async findBySlug(slug: WorkspaceSlug): Promise<Workspace | null> {
    const [row] = await this.db.select().from(workspaces).where(eq(workspaces.slug, slug)).limit(1);
    if (row === undefined) {
      return null;
    }

    const members = await this.db
      .select()
      .from(workspaceMembers)
      .where(eq(workspaceMembers.workspaceId, row.id));
    return mapWorkspace(row, members);
  }

  /**
   * Ищет workspace по внутреннему номеру.
   */
  public async findByInternalNumber(internalNumber: string): Promise<Workspace | null> {
    const [row] = await this.db
      .select()
      .from(workspaces)
      .where(eq(workspaces.internalNumber, internalNumber))
      .limit(1);
    if (row === undefined) {
      return null;
    }

    const members = await this.db
      .select()
      .from(workspaceMembers)
      .where(eq(workspaceMembers.workspaceId, row.id));
    return mapWorkspace(row, members);
  }
}
