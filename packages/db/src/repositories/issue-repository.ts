import { and, count, desc, eq, inArray } from "drizzle-orm";
import type { IssueRepository } from "@wtf/core";
import type { Issue, IssueId, IssueKey, ProjectId, WorkspaceId } from "@wtf/core";
import type { WtfDatabase } from "../connection.js";
import {
  issueActivities,
  issueComments,
  issueRelations,
  issues,
  issueSubtasks,
} from "../schema/index.js";
import { mapIssue } from "./mappers.js";

/**
 * PostgreSQL-реализация репозитория issue.
 */
export class PgIssueRepository implements IssueRepository {
  /**
   * Создает репозиторий с готовым Drizzle database client.
   */
  public constructor(private readonly db: WtfDatabase) {}

  /**
   * Сохраняет issue и дочерние коллекции в транзакции.
   */
  public async save(issue: Issue): Promise<void> {
    const snapshot = issue.toSnapshot();
    await this.db.transaction(async (tx) => {
      await tx
        .insert(issues)
        .values({
          id: snapshot.id,
          workspaceId: snapshot.workspaceId,
          projectId: snapshot.projectId,
          key: snapshot.key,
          title: snapshot.title,
          description: snapshot.description,
          status: snapshot.status,
          priority: snapshot.priority,
          reporterId: snapshot.reporterId,
          assigneeId: snapshot.assigneeId,
          sprintId: snapshot.sprintId,
          createdAt: new Date(snapshot.createdAt),
          updatedAt: new Date(snapshot.updatedAt),
        })
        .onConflictDoUpdate({
          target: issues.id,
          set: {
            title: snapshot.title,
            description: snapshot.description,
            status: snapshot.status,
            priority: snapshot.priority,
            assigneeId: snapshot.assigneeId,
            sprintId: snapshot.sprintId,
            updatedAt: new Date(snapshot.updatedAt),
          },
        });

      await tx.delete(issueComments).where(eq(issueComments.issueId, snapshot.id));
      await tx.delete(issueSubtasks).where(eq(issueSubtasks.issueId, snapshot.id));
      await tx.delete(issueRelations).where(eq(issueRelations.issueId, snapshot.id));
      await tx.delete(issueActivities).where(eq(issueActivities.issueId, snapshot.id));

      if (snapshot.comments.length > 0) {
        await tx.insert(issueComments).values(
          snapshot.comments.map((comment) => ({
            id: comment.id,
            issueId: snapshot.id,
            authorId: comment.authorId,
            body: comment.body,
            createdAt: new Date(comment.createdAt),
            updatedAt: new Date(comment.updatedAt),
          })),
        );
      }

      if (snapshot.subtasks.length > 0) {
        await tx.insert(issueSubtasks).values(
          snapshot.subtasks.map((subtask) => ({
            id: subtask.id,
            issueId: snapshot.id,
            title: subtask.title,
            done: subtask.done,
            createdAt: new Date(subtask.createdAt),
          })),
        );
      }

      if (snapshot.relations.length > 0) {
        await tx.insert(issueRelations).values(
          snapshot.relations.map((relation) => ({
            id: relation.id,
            issueId: snapshot.id,
            type: relation.type,
            targetIssueId: relation.targetIssueId,
            createdAt: new Date(relation.createdAt),
          })),
        );
      }

      if (snapshot.activities.length > 0) {
        await tx.insert(issueActivities).values(
          snapshot.activities.map((activity) => ({
            id: activity.id,
            issueId: snapshot.id,
            actorId: activity.actorId,
            verb: activity.verb,
            occurredAt: new Date(activity.occurredAt),
            metadata: activity.metadata,
          })),
        );
      }
    });
  }

  /**
   * Ищет issue по идентификатору.
   */
  public async findById(id: IssueId): Promise<Issue | null> {
    const [row] = await this.db.select().from(issues).where(eq(issues.id, id)).limit(1);
    if (row === undefined) {
      return null;
    }

    return this.hydrateIssue(row);
  }

  /**
   * Ищет issue по workspace и key.
   */
  public async findByWorkspaceAndKey(
    workspaceId: WorkspaceId,
    key: IssueKey,
  ): Promise<Issue | null> {
    const [row] = await this.db
      .select()
      .from(issues)
      .where(and(eq(issues.workspaceId, workspaceId), eq(issues.key, key)))
      .limit(1);
    if (row === undefined) {
      return null;
    }

    return this.hydrateIssue(row);
  }

  /**
   * Считает все issue проекта.
   */
  public async countByProject(projectId: ProjectId): Promise<number> {
    const [row] = await this.db
      .select({ value: count() })
      .from(issues)
      .where(eq(issues.projectId, projectId));

    return row?.value ?? 0;
  }

  /**
   * Возвращает последние issue проекта.
   */
  public async findByProject(projectId: ProjectId, limit: number): Promise<ReadonlyArray<Issue>> {
    const safeLimit = Math.max(1, Math.min(limit, 200));
    const rows = await this.db
      .select()
      .from(issues)
      .where(eq(issues.projectId, projectId))
      .orderBy(desc(issues.createdAt))
      .limit(safeLimit);

    return this.hydrateIssues(rows);
  }

  private async hydrateIssue(row: typeof issues.$inferSelect): Promise<Issue> {
    const issueId = row.id;
    const [comments, subtasks, relations, activities] = await Promise.all([
      this.db.select().from(issueComments).where(eq(issueComments.issueId, issueId)),
      this.db.select().from(issueSubtasks).where(eq(issueSubtasks.issueId, issueId)),
      this.db.select().from(issueRelations).where(eq(issueRelations.issueId, issueId)),
      this.db.select().from(issueActivities).where(eq(issueActivities.issueId, issueId)),
    ]);

    return mapIssue(row, comments, subtasks, relations, activities);
  }

  private async hydrateIssues(
    rows: ReadonlyArray<typeof issues.$inferSelect>,
  ): Promise<ReadonlyArray<Issue>> {
    if (rows.length === 0) {
      return [];
    }

    const ids = rows.map((row) => row.id);
    const [comments, subtasks, relations, activities] = await Promise.all([
      this.db.select().from(issueComments).where(inArray(issueComments.issueId, ids)),
      this.db.select().from(issueSubtasks).where(inArray(issueSubtasks.issueId, ids)),
      this.db.select().from(issueRelations).where(inArray(issueRelations.issueId, ids)),
      this.db.select().from(issueActivities).where(inArray(issueActivities.issueId, ids)),
    ]);

    return rows.map((row) =>
      mapIssue(
        row,
        comments.filter((comment) => comment.issueId === row.id),
        subtasks.filter((subtask) => subtask.issueId === row.id),
        relations.filter((relation) => relation.issueId === row.id),
        activities.filter((activity) => activity.issueId === row.id),
      ),
    );
  }
}
