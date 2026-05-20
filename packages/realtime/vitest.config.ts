import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      include: ["src/event-bus.ts", "src/y-document-store.ts"],
      reporter: ["text", "lcov"],
    },
    environment: "node",
  },
});
