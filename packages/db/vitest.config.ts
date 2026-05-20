import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      include: ["src/repositories/mappers.ts"],
      reporter: ["text", "lcov"],
    },
    environment: "node",
  },
});
