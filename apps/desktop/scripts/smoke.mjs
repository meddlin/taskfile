// Runs the built app's `--smoke-test` mode against a throwaway HOME, so it never touches real tasks.
//
//   npm run smoke                          the unpackaged app (needs `npm run build`)
//   npm run smoke -- path/to/Taskfile      a packaged executable, e.g.
//                                          release/mac-arm64/Taskfile.app/Contents/MacOS/Taskfile
import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const desktopDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packaged = process.argv.slice(2).find((arg) => arg !== "--");

let command;
let args;
if (packaged) {
  command = path.resolve(packaged);
  args = ["--smoke-test"];
} else {
  command = createRequire(import.meta.url)("electron");
  args = [desktopDir, "--smoke-test"];
}

const home = fs.mkdtempSync(path.join(os.tmpdir(), "taskfile-smoke-"));
try {
  const result = spawnSync(command, args, {
    // Not ELECTRON_RUN_AS_NODE: this must be the real Electron main process. HOME is what both
    // os.homedir() and the web app's default database path follow.
    env: { ...process.env, HOME: home, USERPROFILE: home, ELECTRON_RUN_AS_NODE: undefined },
    encoding: "utf8",
    timeout: 60_000,
  });
  process.stdout.write(result.stdout ?? "");
  process.stderr.write(result.stderr ?? "");
  if (result.error) throw result.error;
  if (result.status !== 0 || !result.stdout.includes("SMOKE PASS")) {
    console.error(`Smoke test failed (exit ${result.status}).`);
    process.exit(1);
  }
} finally {
  fs.rmSync(home, { recursive: true, force: true });
}
