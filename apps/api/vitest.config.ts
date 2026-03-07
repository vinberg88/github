import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      reportsDirectory: "./coverage",
      thresholds: {
        lines: 25,
        functions: 25,
        branches: 10,
        statements: 25,
      },
    },
  },
});
