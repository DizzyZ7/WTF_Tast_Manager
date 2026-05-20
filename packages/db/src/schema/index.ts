import { relations } from "drizzle-orm";
import {
  index,
  boolean,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const workspaceRoleEnum = pgEnum("workspace_role", ["owner", "admin", "member", "viewer"]);
export const projectStatusEnum = pgEnum("project_status", ["active", "archived"]);
export const sprintStatusEnum = pgEnum("sprint_status", ["planned", "active", "closed"]);
export const issueStatusEnum = pgEnum("issue_status", [
  "backlog",
  "todo",
  "in_progress",
  "in_review",
  "done",
  "canceled",
]);
export const issuePriorityEnum = pgEnum("issue_priority", ["low", "medium", "high", "urgent"]);
export const issueRelationTypeEnum = pgEnum("issue_relation_type", [
  "blocks",
  "blocked_by",
  "duplicates",
  "relates_to",
]);
export const activityVerbEnum = pgEnum("activity_verb", [
  "created",
  "status_changed",
  "assigned",
  "commented",
  "subtask_added",
  "relation_added",
]);

export const workspaces = pgTable(
  "workspaces",
  {
    id: uuid("id").primaryKey(),
    name: varchar("name", { length: 120 }).notNull(),
    slug: varchar("slug", { length: 63 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [uniqueIndex("workspaces_slug_uq").on(table.slug)],
);

export const workspaceMembers = pgTable(
  "workspace_members",
  {
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull(),
    role: workspaceRoleEnum("role").notNull(),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceId, table.userId] }),
    index("workspace_members_user_idx").on(table.userId),
  ],
);

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    key: varchar("key", { length: 10 }).notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    status: projectStatusEnum("status").notNull(),
    leadUserId: uuid("lead_user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    uniqueIndex("projects_workspace_key_uq").on(table.workspaceId, table.key),
    index("projects_workspace_idx").on(table.workspaceId),
  ],
);

export const sprints = pgTable(
  "sprints",
  {
    id: uuid("id").primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    goal: varchar("goal", { length: 500 }).notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    status: sprintStatusEnum("status").notNull(),
  },
  (table) => [uniqueIndex("sprints_project_name_uq").on(table.projectId, table.name)],
);

export const issues = pgTable(
  "issues",
  {
    id: uuid("id").primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    key: varchar("key", { length: 24 }).notNull(),
    title: varchar("title", { length: 240 }).notNull(),
    description: text("description").notNull(),
    status: issueStatusEnum("status").notNull(),
    priority: issuePriorityEnum("priority").notNull(),
    reporterId: uuid("reporter_id").notNull(),
    assigneeId: uuid("assignee_id"),
    sprintId: uuid("sprint_id").references(() => sprints.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    uniqueIndex("issues_workspace_key_uq").on(table.workspaceId, table.key),
    index("issues_project_idx").on(table.projectId),
    index("issues_assignee_idx").on(table.assigneeId),
  ],
);

export const issueComments = pgTable(
  "issue_comments",
  {
    id: uuid("id").primaryKey(),
    issueId: uuid("issue_id")
      .notNull()
      .references(() => issues.id, { onDelete: "cascade" }),
    authorId: uuid("author_id").notNull(),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [index("issue_comments_issue_idx").on(table.issueId)],
);

export const issueSubtasks = pgTable(
  "issue_subtasks",
  {
    id: uuid("id").primaryKey(),
    issueId: uuid("issue_id")
      .notNull()
      .references(() => issues.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 240 }).notNull(),
    done: boolean("done").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (table) => [index("issue_subtasks_issue_idx").on(table.issueId)],
);

export const issueRelations = pgTable(
  "issue_relations",
  {
    id: uuid("id").primaryKey(),
    issueId: uuid("issue_id")
      .notNull()
      .references(() => issues.id, { onDelete: "cascade" }),
    type: issueRelationTypeEnum("type").notNull(),
    targetIssueId: uuid("target_issue_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    uniqueIndex("issue_relations_unique_uq").on(table.issueId, table.type, table.targetIssueId),
    index("issue_relations_target_idx").on(table.targetIssueId),
  ],
);

export const issueActivities = pgTable(
  "issue_activities",
  {
    id: uuid("id").primaryKey(),
    issueId: uuid("issue_id")
      .notNull()
      .references(() => issues.id, { onDelete: "cascade" }),
    actorId: uuid("actor_id").notNull(),
    verb: activityVerbEnum("verb").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    metadata: jsonb("metadata").$type<Readonly<Record<string, unknown>>>().notNull(),
  },
  (table) => [index("issue_activities_issue_idx").on(table.issueId)],
);

export const workspaceRelations = relations(workspaces, ({ many }) => ({
  members: many(workspaceMembers),
  projects: many(projects),
  issues: many(issues),
}));

export const projectRelations = relations(projects, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [projects.workspaceId],
    references: [workspaces.id],
  }),
  sprints: many(sprints),
  issues: many(issues),
}));

export const issueRelationsMap = relations(issues, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [issues.workspaceId],
    references: [workspaces.id],
  }),
  project: one(projects, {
    fields: [issues.projectId],
    references: [projects.id],
  }),
  comments: many(issueComments),
  subtasks: many(issueSubtasks),
  relations: many(issueRelations),
  activities: many(issueActivities),
}));
