// Bundles the Electron main process, with the web app's production server inside it, and copies the
// web app's client assets next to it. Run `npm run build -w @taskfile/web` first.
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const desktopDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const webDist = path.resolve(desktopDir, "../web/dist");
const serverEntry = path.join(webDist, "server/server.js");
const clientAssets = path.join(webDist, "client");

if (!fs.existsSync(serverEntry) || !fs.existsSync(clientAssets)) {
  console.error("apps/web has not been built. Run `npm run build -w @taskfile/web` first.");
  process.exit(1);
}

const distDir = path.join(desktopDir, "dist");
fs.rmSync(distDir, { recursive: true, force: true });

await build({
  absWorkingDir: desktopDir,
  entryPoints: ["src/main/index.ts"],
  outfile: "dist/main.mjs",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node24", // Electron 44 bundles Node 24
  sourcemap: true,
  logLevel: "info",
  // The web server build leaves React, TanStack and friends as bare imports (the Docker image has
  // node_modules for them); bundling it here is what lets the packaged app run without any.
  alias: { "taskfile-web-server": serverEntry },
  external: ["electron"],
  // Some bundled CommonJS dependencies call require(); ESM output has none of its own.
  banner: { js: 'import { createRequire as __createRequire } from "node:module"; const require = __createRequire(import.meta.url);' },
});

// The preload script runs sandboxed in the page's process, where only a classic script (CommonJS)
// that requires "electron" works, so it is its own small bundle.
await build({
  absWorkingDir: desktopDir,
  entryPoints: ["src/preload/index.ts"],
  outfile: "dist/preload.cjs",
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node24",
  logLevel: "info",
  external: ["electron"],
});

fs.cpSync(clientAssets, path.join(distDir, "client"), { recursive: true });
