import { describe, expect, it } from "vitest";
import { StaticFeatureFlags } from "../src/index.js";

describe("StaticFeatureFlags", () => {
  it("возвращает включенные и выключенные флаги детерминированно", () => {
    const flags = new StaticFeatureFlags({
      "issues.subtasks": true,
      "auth.oauth": false,
    });

    expect(flags.isEnabled("issues.subtasks")).toBe(true);
    expect(flags.isEnabled("auth.oauth")).toBe(false);
    expect(flags.isEnabled("realtime.rich_text_crdt")).toBe(false);
  });
});
