import { describe, expect, it } from "vitest";
import { sortIssuesByPriority, toWebIssue, type WebIssue } from "../src/components/issue-data";
import type { WtfIssue } from "../src/lib/wtf-api";

describe("sortIssuesByPriority", () => {
  it("сортирует задачи по приоритету и ключу", () => {
    const issues: WebIssue[] = [
      makeWebIssue({
        id: "3",
        key: "WTF-3",
        title: "C",
        priority: "low",
      }),
      makeWebIssue({
        id: "2",
        key: "WTF-2",
        title: "B",
        priority: "urgent",
      }),
      makeWebIssue({
        id: "1",
        key: "WTF-1",
        title: "A",
        priority: "urgent",
      }),
    ];

    expect(sortIssuesByPriority(issues).map((issue) => issue.key)).toEqual([
      "WTF-1",
      "WTF-2",
      "WTF-3",
    ]);
  });

  it("сортирует числовые суффиксы ключей естественным порядком", () => {
    const issues: WebIssue[] = [
      makeWebIssue({
        id: "10",
        key: "WTF-10",
        title: "J",
      }),
      makeWebIssue({
        id: "2",
        key: "WTF-2",
        title: "B",
      }),
      makeWebIssue({
        id: "1",
        key: "WTF-1",
        title: "A",
      }),
    ];

    expect(sortIssuesByPriority(issues).map((issue) => issue.key)).toEqual([
      "WTF-1",
      "WTF-2",
      "WTF-10",
    ]);
  });
});

function makeWebIssue(input: Partial<WebIssue> & Pick<WebIssue, "id" | "key" | "title">): WebIssue {
  return {
    description: "",
    status: "todo",
    priority: "medium",
    reporterId: "user-1",
    assigneeId: null,
    comments: [],
    activities: [],
    movedBy: null,
    movedAt: null,
    closedBy: null,
    closedAt: null,
    createdAt: "2026-05-20T15:00:00.000Z",
    updatedAt: "2026-05-20T15:00:00.000Z",
    ...input,
  };
}

describe("toWebIssue", () => {
  it("считает canceled закрытием задачи и показывает email закрывшего", () => {
    const issue: WtfIssue = {
      id: "issue-1",
      workspaceId: "workspace-1",
      projectId: "project-1",
      key: "WTF-1",
      title: "Canceled issue",
      description: "",
      status: "canceled",
      priority: "medium",
      reporterId: "user-1",
      assigneeId: null,
      sprintId: null,
      subtasks: [],
      relations: [],
      comments: [],
      activities: [
        {
          id: "activity-1",
          actorId: "user-1",
          verb: "status_changed",
          occurredAt: "2026-05-20T15:05:41.529Z",
          metadata: {
            actorEmail: "demo@wtf.local",
            from: "backlog",
            to: "canceled",
          },
        },
      ],
      createdAt: "2026-05-20T15:00:00.000Z",
      updatedAt: "2026-05-20T15:05:41.529Z",
    };

    expect(toWebIssue(issue)).toMatchObject({
      closedAt: "2026-05-20T15:05:41.529Z",
      closedBy: "demo@wtf.local",
      movedAt: "2026-05-20T15:05:41.529Z",
      movedBy: "demo@wtf.local",
    });
  });

  it("не считает переоткрытую задачу закрытой из-за старого terminal activity", () => {
    const issue: WtfIssue = {
      id: "issue-1",
      workspaceId: "workspace-1",
      projectId: "project-1",
      key: "WTF-1",
      title: "Reopened issue",
      description: "",
      status: "in_progress",
      priority: "medium",
      reporterId: "user-1",
      assigneeId: null,
      sprintId: null,
      subtasks: [],
      relations: [],
      comments: [],
      activities: [
        {
          id: "activity-1",
          actorId: "user-1",
          verb: "status_changed",
          occurredAt: "2026-05-20T15:05:00.000Z",
          metadata: {
            from: "backlog",
            to: "done",
          },
        },
        {
          id: "activity-2",
          actorId: "user-1",
          verb: "status_changed",
          occurredAt: "2026-05-20T15:10:00.000Z",
          metadata: {
            from: "done",
            to: "in_progress",
          },
        },
      ],
      createdAt: "2026-05-20T15:00:00.000Z",
      updatedAt: "2026-05-20T15:10:00.000Z",
    };

    expect(toWebIssue(issue)).toMatchObject({
      closedAt: null,
      closedBy: null,
      movedAt: "2026-05-20T15:10:00.000Z",
    });
  });
});
