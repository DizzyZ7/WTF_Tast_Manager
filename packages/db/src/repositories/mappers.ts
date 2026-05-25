import {
  Issue,
  Project,
  Workspace,
  issueId,
  issueKey,
  optionalRichTextPlain,
  parseEntityId,
  projectId,
  projectKey,
  richTextPlain,
  userId,
  workspaceId,
  workspaceSlug,
  type ActivitySnapshot,
  type CommentSnapshot,
  type IssueRelationSnapshot,
  type IssueSnapshot,
  type ProjectSnapshot,
  type SprintSnapshot,
  type SubtaskSnapshot,
  type WorkspaceSnapshot,
} from "@wtf/core";
import type {
  issueActivities,
  issueComments,
  issueRelations,
  issues,
  issueSubtasks,
  projects,
  sprints,
  workspaceJoinRequests,
  workspaceMembers,
  workspaces,
} from "../schema/index.js";

type WorkspaceRow = typeof workspaces.$inferSelect;
type WorkspaceMemberRow = typeof workspaceMembers.$inferSelect;
export type WorkspaceJoinRequestRow = typeof workspaceJoinRequests.$inferSelect;
type ProjectRow = typeof projects.$inferSelect;
type SprintRow = typeof sprints.$inferSelect;
type IssueRow = typeof issues.$inferSelect;
type CommentRow = typeof issueComments.$inferSelect;
type SubtaskRow = typeof issueSubtasks.$inferSelect;
type RelationRow = typeof issueRelations.$inferSelect;
type ActivityRow = typeof issueActivities.$inferSelect;

/**
 * Восстанавливает workspace aggregate из строк PostgreSQL.
 */
export function mapWorkspace(
  row: WorkspaceRow,
  members: ReadonlyArray<WorkspaceMemberRow>,
): Workspace {
  const snapshot: WorkspaceSnapshot = {
    id: workspaceId(row.id),
    name: row.name,
    slug: workspaceSlug(row.slug),
    internalNumber: row.internalNumber,
    members: members.map((member) => ({
      userId: userId(member.userId),
      role: member.role,
      joinedAt: member.joinedAt.toISOString(),
    })),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };

  return Workspace.rehydrate(snapshot);
}

/**
 * Восстанавливает project aggregate из строк PostgreSQL.
 */
export function mapProject(row: ProjectRow, sprintRows: ReadonlyArray<SprintRow>): Project {
  const snapshot: ProjectSnapshot = {
    id: projectId(row.id),
    workspaceId: workspaceId(row.workspaceId),
    key: projectKey(row.key),
    name: row.name,
    status: row.status,
    leadUserId: userId(row.leadUserId),
    sprints: sprintRows.map(
      (sprint): SprintSnapshot => ({
        id: parseEntityId<"SprintId">(sprint.id, "sprintId"),
        name: sprint.name,
        goal: sprint.goal,
        startsAt: sprint.startsAt.toISOString(),
        endsAt: sprint.endsAt.toISOString(),
        status: sprint.status,
      }),
    ),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };

  return Project.rehydrate(snapshot);
}

/**
 * Восстанавливает issue aggregate из строк PostgreSQL.
 */
export function mapIssue(
  row: IssueRow,
  commentRows: ReadonlyArray<CommentRow>,
  subtaskRows: ReadonlyArray<SubtaskRow>,
  relationRows: ReadonlyArray<RelationRow>,
  activityRows: ReadonlyArray<ActivityRow>,
): Issue {
  const snapshot: IssueSnapshot = {
    id: issueId(row.id),
    workspaceId: workspaceId(row.workspaceId),
    projectId: projectId(row.projectId),
    key: issueKey(row.key),
    title: row.title,
    description: optionalRichTextPlain(row.description),
    status: row.status,
    priority: row.priority,
    reporterId: userId(row.reporterId),
    assigneeId: row.assigneeId === null ? null : userId(row.assigneeId),
    sprintId: row.sprintId === null ? null : parseEntityId<"SprintId">(row.sprintId, "sprintId"),
    subtasks: subtaskRows.map(
      (subtask): SubtaskSnapshot => ({
        id: issueId(subtask.id),
        title: subtask.title,
        done: subtask.done,
        createdAt: subtask.createdAt.toISOString(),
      }),
    ),
    relations: relationRows.map(
      (relation): IssueRelationSnapshot => ({
        id: parseEntityId<"RelationId">(relation.id, "relationId"),
        type: relation.type,
        targetIssueId: issueId(relation.targetIssueId),
        createdAt: relation.createdAt.toISOString(),
      }),
    ),
    comments: commentRows.map(
      (comment): CommentSnapshot => ({
        id: parseEntityId<"CommentId">(comment.id, "commentId"),
        authorId: userId(comment.authorId),
        body: richTextPlain(comment.body),
        createdAt: comment.createdAt.toISOString(),
        updatedAt: comment.updatedAt.toISOString(),
      }),
    ),
    activities: activityRows.map(
      (activity): ActivitySnapshot => ({
        id: parseEntityId<"ActivityId">(activity.id, "activityId"),
        actorId: userId(activity.actorId),
        verb: activity.verb,
        occurredAt: activity.occurredAt.toISOString(),
        metadata: activity.metadata,
      }),
    ),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };

  return Issue.rehydrate(snapshot);
}
