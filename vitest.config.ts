import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    // The smoke test spawns dist/cli.js, so it runs after a build:
    // `npm run build && npm run test:smoke`.
    exclude: ["test/smoke/**", "**/node_modules/**"],
  },
});
