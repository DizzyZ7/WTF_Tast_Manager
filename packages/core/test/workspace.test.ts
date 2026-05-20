import { describe, expect, it } from "vitest";
import { DomainError, Workspace, userId } from "../src/index.js";

const now = new Date("2026-05-19T10:00:00.000Z");
const ownerId = userId("00000000-0000-4000-8000-000000000001");
const memberId = userId("00000000-0000-4000-8000-000000000002");

describe("Workspace", () => {
  it("создает workspace с владельцем и доменным событием", () => {
    const workspace = Workspace.create({
      name: " Core Team ",
      slug: "core-team",
      ownerUserId: ownerId,
      now,
    });

    expect(workspace.toSnapshot()).toMatchObject({
      name: "Core Team",
      slug: "core-team",
      members: [{ userId: ownerId, role: "owner", joinedAt: now.toISOString() }],
    });
    expect(workspace.pullDomainEvents()).toHaveLength(1);
    expect(workspace.pullDomainEvents()).toHaveLength(0);
  });

  it("запрещает дублировать участника", () => {
    const workspace = Workspace.create({
      name: "Core Team",
      slug: "core-team",
      ownerUserId: ownerId,
      now,
    });

    workspace.addMember(memberId, "member", now);

    expect(() => workspace.addMember(memberId, "viewer", now)).toThrow(DomainError);
  });

  it("запрещает удалить последнего владельца", () => {
    const workspace = Workspace.create({
      name: "Core Team",
      slug: "core-team",
      ownerUserId: ownerId,
      now,
    });

    expect(() => workspace.removeMember(ownerId, now)).toThrow(/последнего владельца/);
  });

  it("позволяет сменить владельца при наличии второго владельца", () => {
    const workspace = Workspace.create({
      name: "Core Team",
      slug: "core-team",
      ownerUserId: ownerId,
      now,
    });
    workspace.addMember(memberId, "member", now);
    workspace.changeMemberRole(memberId, "owner", now);
    workspace.changeMemberRole(ownerId, "admin", now);

    expect(workspace.toSnapshot().members).toEqual([
      { userId: ownerId, role: "admin", joinedAt: now.toISOString() },
      { userId: memberId, role: "owner", joinedAt: now.toISOString() },
    ]);
  });

  it("запрещает менять роль отсутствующего участника", () => {
    const workspace = Workspace.create({
      name: "Core Team",
      slug: "core-team",
      ownerUserId: ownerId,
      now,
    });

    expect(() => workspace.changeMemberRole(memberId, "admin", now)).toThrow(/не состоит/);
  });

  it("запрещает понизить последнего владельца", () => {
    const workspace = Workspace.create({
      name: "Core Team",
      slug: "core-team",
      ownerUserId: ownerId,
      now,
    });

    expect(() => workspace.changeMemberRole(ownerId, "admin", now)).toThrow(/хотя бы одного/);
  });

  it("запрещает удалить отсутствующего участника", () => {
    const workspace = Workspace.create({
      name: "Core Team",
      slug: "core-team",
      ownerUserId: ownerId,
      now,
    });

    expect(() => workspace.removeMember(memberId, now)).toThrow(/не состоит/);
  });
});
