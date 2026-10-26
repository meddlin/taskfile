import * as path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "taskfile-web-server": path.resolve(import.meta.dirname, "src/test/fakeWebServer.ts") },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "scripts/**/*.test.ts"],
  },
});
