import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      include: ["src/components/issue-data.ts"],
      reporter: ["text", "lcov"],
    },
    environment: "node",
  },
});
