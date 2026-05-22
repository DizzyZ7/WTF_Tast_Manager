import { describe, expect, it } from "vitest";
import { calculateFlowInsights } from "../src/components/flow-insights";
import type { WebIssue } from "../src/components/issue-data";

const now = new Date("2026-05-23T12:00:00.000Z");

describe("calculateFlowInsights", () => {
  it("выделяет срочные и застоявшиеся задачи как риск потока", () => {
    const insights = calculateFlowInsights(
      [
        makeIssue({
          id: "urgent-stale",
          key: "WTF-1",
          priority: "urgent",
          status: "todo",
          updatedAt: "2026-05-18T12:00:00.000Z",
        }),
        makeIssue({ id: "review", key: "WTF-2", status: "in_review" }),
        makeIssue({
          id: "done",
          key: "WTF-3",
          status: "done",
          closedAt: "2026-05-22T12:00:00.000Z",
        }),
      ],
      now,
    );

    expect(insights.riskTone).toBe("amber");
    expect(insights.focusIssueId).toBe("urgent-stale");
    expect(insights.staleCount).toBe(1);
    expect(insights.closedLast7Days).toBe(1);
    expect(insights.recommendation).toContain("urgent");
  });

  it("считает WIP pressure, комментарии и lane distribution", () => {
    const insights = calculateFlowInsights(
      [
        makeIssue({ id: "todo", key: "WTF-1", status: "todo" }),
        makeIssue({ id: "progress", key: "WTF-2", status: "in_progress", commentsCount: 2 }),
        makeIssue({ id: "backlog", key: "WTF-3", status: "backlog", commentsCount: 1 }),
        makeIssue({ id: "done", key: "WTF-4", status: "done" }),
      ],
      now,
    );

    expect(insights.workInFlight).toBe(2);
    expect(insights.wipLimit).toBe(3);
    expect(insights.wipPressure).toBe(67);
    expect(insights.commentCount).toBe(3);
    expect(insights.averageCommentsPerIssue).toBe(0.8);
    expect(insights.lanes.find((lane) => lane.status === "todo")?.share).toBe(25);
  });
});

function makeIssue(
  input: Partial<WebIssue> & Pick<WebIssue, "id" | "key"> & { readonly commentsCount?: number },
): WebIssue {
  return {
    title: input.key,
    description: "",
    status: "todo",
    priority: "medium",
    reporterId: "user-1",
    assigneeId: null,
    comments: Array.from({ length: input.commentsCount ?? 0 }, (_, index) => ({
      id: `comment-${index}`,
      authorId: "user-1",
      body: `Comment ${index}`,
      createdAt: "2026-05-23T10:00:00.000Z",
      updatedAt: "2026-05-23T10:00:00.000Z",
    })),
    activities: [],
    movedBy: null,
    movedAt: null,
    closedBy: null,
    closedAt: null,
    createdAt: "2026-05-23T09:00:00.000Z",
    updatedAt: "2026-05-23T09:00:00.000Z",
    ...input,
  };
}
