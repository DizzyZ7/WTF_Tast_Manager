import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      exclude: ["src/index.ts", "src/domain/repositories/**/*.ts"],
      include: [
        "src/domain/entities/**/*.ts",
        "src/domain/events/**/*.ts",
        "src/domain/services/**/*.ts",
        "src/domain/value-objects/**/*.ts",
        "src/shared/**/*.ts",
      ],
      reporter: ["text", "lcov"],
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
    environment: "node",
  },
});
