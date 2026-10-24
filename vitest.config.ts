import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
    testTimeout: 30000,
    // DB tests share one Postgres database (kinetic_test) and truncate between tests
    fileParallelism: false,
    globalSetup: ["tests/unit/db/global-setup.ts"],
  },
});
