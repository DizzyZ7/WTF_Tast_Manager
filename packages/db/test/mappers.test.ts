import { describe, expect, it } from "vitest";
import { mapIssue, mapProject, mapWorkspace } from "../src/repositories/mappers.js";

const createdAt = new Date("2026-05-19T10:00:00.000Z");
const updatedAt = new Date("2026-05-19T11:00:00.000Z");

describe("db mappers", () => {
  it("восстанавливает workspace aggregate из строк", () => {
    const workspace = mapWorkspace(
      {
        id: "00000000-0000-4000-8000-000000000010",
        name: "Core",
        slug: "core",
        createdAt,
        updatedAt,
      },
      [
        {
          workspaceId: "00000000-0000-4000-8000-000000000010",
          userId: "00000000-0000-4000-8000-000000000001",
          role: "owner",
          joinedAt: createdAt,
        },
      ],
    );

    expect(workspace.toSnapshot().members).toHaveLength(1);
  });

  it("восстанавливает project aggregate со спринтами", () => {
    const project = mapProject(
      {
        id: "00000000-0000-4000-8000-000000000020",
        workspaceId: "00000000-0000-4000-8000-000000000010",
        key: "PF",
        name: "Platform",
        status: "active",
        leadUserId: "00000000-0000-4000-8000-000000000001",
        createdAt,
        updatedAt,
      },
      [
        {
          id: "00000000-0000-4000-8000-000000000040",
          projectId: "00000000-0000-4000-8000-000000000020",
          name: "Sprint 1",
          goal: "Ship",
          startsAt: createdAt,
          endsAt: updatedAt,
          status: "planned",
        },
      ],
    );

    expect(project.toSnapshot().sprints[0]?.name).toBe("Sprint 1");
  });

  it("восстанавливает issue aggregate с дочерними коллекциями", () => {
    const issue = mapIssue(
      {
        id: "00000000-0000-4000-8000-000000000030",
        workspaceId: "00000000-0000-4000-8000-000000000010",
        projectId: "00000000-0000-4000-8000-000000000020",
        key: "PF-1",
        title: "Core",
        description: "Body",
        status: "todo",
        priority: "high",
        reporterId: "00000000-0000-4000-8000-000000000001",
        assigneeId: "00000000-0000-4000-8000-000000000002",
        sprintId: null,
        createdAt,
        updatedAt,
      },
      [
        {
          id: "00000000-0000-4000-8000-000000000031",
          issueId: "00000000-0000-4000-8000-000000000030",
          authorId: "00000000-0000-4000-8000-000000000001",
          body: "Comment",
          createdAt,
          updatedAt,
        },
      ],
      [
        {
          id: "00000000-0000-4000-8000-000000000032",
          issueId: "00000000-0000-4000-8000-000000000030",
          title: "Subtask",
          done: false,
          createdAt,
        },
      ],
      [
        {
          id: "00000000-0000-4000-8000-000000000033",
          issueId: "00000000-0000-4000-8000-000000000030",
          type: "relates_to",
          targetIssueId: "00000000-0000-4000-8000-000000000034",
          createdAt,
        },
      ],
      [
        {
          id: "00000000-0000-4000-8000-000000000035",
          issueId: "00000000-0000-4000-8000-000000000030",
          actorId: "00000000-0000-4000-8000-000000000001",
          verb: "created",
          occurredAt: createdAt,
          metadata: { title: "Core" },
        },
      ],
    );

    expect(issue.toSnapshot()).toMatchObject({
      key: "PF-1",
      comments: [{ body: "Comment" }],
      subtasks: [{ title: "Subtask", done: false }],
      relations: [{ type: "relates_to" }],
      activities: [{ verb: "created" }],
    });
  });
});
