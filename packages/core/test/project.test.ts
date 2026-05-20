import { describe, expect, it } from "vitest";
import { DomainError, Project, userId, workspaceId } from "../src/index.js";

const now = new Date("2026-05-19T10:00:00.000Z");
const startsAt = new Date("2026-05-20T10:00:00.000Z");
const endsAt = new Date("2026-06-03T10:00:00.000Z");
const leadUserId = userId("00000000-0000-4000-8000-000000000001");
const workspace = workspaceId("00000000-0000-4000-8000-000000000010");

describe("Project", () => {
  it("создает активный проект и нормализует ключ", () => {
    const project = Project.create({
      workspaceId: workspace,
      name: "Platform",
      key: "pf",
      leadUserId,
      now,
    });

    expect(project.toSnapshot()).toMatchObject({
      workspaceId: workspace,
      key: "PF",
      name: "Platform",
      status: "active",
      leadUserId,
      sprints: [],
    });
  });

  it("создает спринт с валидным диапазоном дат", () => {
    const project = Project.create({
      workspaceId: workspace,
      name: "Platform",
      key: "PF",
      leadUserId,
      now,
    });

    const sprint = project.createSprint({
      name: "Sprint 1",
      goal: "Ship core",
      startsAt,
      endsAt,
      now,
    });

    expect(sprint).toMatchObject({ name: "Sprint 1", goal: "Ship core", status: "planned" });
    expect(project.toSnapshot().sprints).toHaveLength(1);
  });

  it("запрещает дублировать название спринта", () => {
    const project = Project.create({
      workspaceId: workspace,
      name: "Platform",
      key: "PF",
      leadUserId,
      now,
    });

    project.createSprint({ name: "Sprint 1", goal: "", startsAt, endsAt, now });

    expect(() =>
      project.createSprint({ name: "sprint 1", goal: "", startsAt, endsAt, now }),
    ).toThrow(DomainError);
  });

  it("запрещает создавать спринт в архивном проекте", () => {
    const project = Project.create({
      workspaceId: workspace,
      name: "Platform",
      key: "PF",
      leadUserId,
      now,
    });
    project.archive(now);

    expect(() =>
      project.createSprint({ name: "Sprint 1", goal: "", startsAt, endsAt, now }),
    ).toThrow(/архивном проекте/);
  });

  it("запрещает спринт с неверным диапазоном дат", () => {
    const project = Project.create({
      workspaceId: workspace,
      name: "Platform",
      key: "PF",
      leadUserId,
      now,
    });

    expect(() =>
      project.createSprint({
        name: "Sprint 1",
        goal: "",
        startsAt: endsAt,
        endsAt: startsAt,
        now,
      }),
    ).toThrow(/начало раньше/);
  });

  it("не публикует повторное событие при повторном архивировании", () => {
    const project = Project.create({
      workspaceId: workspace,
      name: "Platform",
      key: "PF",
      leadUserId,
      now,
    });
    project.pullDomainEvents();

    project.archive(now);
    project.archive(now);

    expect(project.pullDomainEvents().map((event) => event.type)).toEqual(["project.archived"]);
  });
});
