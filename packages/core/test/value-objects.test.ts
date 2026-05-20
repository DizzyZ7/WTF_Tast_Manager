import { describe, expect, it } from "vitest";
import {
  assertDateRange,
  assertMaxLength,
  assertNonEmptyString,
  createActivity,
  issueKey,
  issueKeyFromSequence,
  parseEntityId,
  projectKey,
  richTextPlain,
  toIsoString,
  userId,
  workspaceSlug,
} from "../src/index.js";

describe("value objects and guards", () => {
  it("валидирует UUID-based identifiers", () => {
    expect(() => parseEntityId<"UserId">("not-a-uuid", "userId")).toThrow(/UUID/);
  });

  it("валидирует workspace slug и project keys", () => {
    expect(workspaceSlug(" Core-Team ")).toBe("core-team");
    expect(projectKey("pf")).toBe("PF");
    expect(issueKey("pf-10")).toBe("PF-10");
    expect(issueKeyFromSequence(projectKey("PF"), 7)).toBe("PF-7");

    expect(() => workspaceSlug("-bad")).toThrow(/workspace slug/);
    expect(() => projectKey("p")).toThrow(/project key/);
    expect(() => issueKey("PF-0")).toThrow(/issue key/);
    expect(() => issueKeyFromSequence(projectKey("PF"), 0)).toThrow(/положительным/);
  });

  it("валидирует rich text и общие guard-функции", () => {
    expect(richTextPlain(" body ")).toBe("body");
    expect(assertNonEmptyString(" name ", "name")).toBe("name");
    expect(assertMaxLength("abc", 3, "field")).toBe("abc");
    expect(toIsoString(new Date("2026-05-19T10:00:00.000Z"))).toBe("2026-05-19T10:00:00.000Z");

    expect(() => richTextPlain(" ")).toThrow(/richText/);
    expect(() => assertMaxLength("abcd", 3, "field")).toThrow(/максимальную/);
    expect(() =>
      assertDateRange(
        new Date("2026-05-20T10:00:00.000Z"),
        new Date("2026-05-19T10:00:00.000Z"),
        "range",
      ),
    ).toThrow(/начало раньше/);
  });

  it("создает activity без metadata", () => {
    const activity = createActivity({
      actorId: userId("00000000-0000-4000-8000-000000000001"),
      verb: "created",
      occurredAt: new Date("2026-05-19T10:00:00.000Z"),
    });

    expect(activity.metadata).toEqual({});
  });
});
