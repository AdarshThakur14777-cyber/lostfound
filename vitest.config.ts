import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    testTimeout: 60_000,
    hookTimeout: 120_000,
    pool: "forks",
    fileParallelism: false,
    maxWorkers: 1,
    env: {
      // Tests get their own port so a test run never wipes the seeded dev DB.
      MONGODB_URI: "mongodb://127.0.0.1:27118/lostfound_tests",
    },
  },
});
