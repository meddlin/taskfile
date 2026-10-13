import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

// Integration test (spawns child processes). React chooses its development or production build
// once, at first import, so this can't be checked in-process: vitest has already loaded React under
// NODE_ENV=test. Each child renders a small Ink app that re-renders on a timer, then reports how
// many `performance.measure` entries are still buffered. The development build leaves ~10 per
// render (the memory leak behind the "heap out of memory" crash); the production build leaves none.

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const productionEnvUrl = pathToFileURL(fileURLToPath(new URL("./production-env.ts", import.meta.url))).href;

const CHILD_SCRIPT = `
  if (process.env.LOAD_PRODUCTION_ENV === "1") {
    await import(${JSON.stringify(productionEnvUrl)});
  }
  const { render, Text } = await import("ink");
  const React = await import("react");
  const { Writable, PassThrough } = await import("node:stream");

  function Ticker() {
    const [n, setN] = React.useState(0);
    React.useEffect(() => {
      const interval = setInterval(() => setN((value) => value + 1), 1);
      return () => clearInterval(interval);
    }, []);
    return React.createElement(Text, null, "tick " + n);
  }

  const stdout = new Writable({ write(_chunk, _encoding, done) { done(); } });
  stdout.isTTY = true;
  stdout.columns = 80;
  stdout.rows = 24;
  const stdin = new PassThrough();
  stdin.isTTY = true;
  stdin.setRawMode = () => stdin;
  stdin.ref = () => stdin;
  stdin.unref = () => stdin;

  const app = render(React.createElement(Ticker), { stdout, stdin, patchConsole: false, exitOnCtrlC: false });
  setTimeout(() => {
    app.unmount();
    console.log(JSON.stringify({ measures: performance.getEntriesByType("measure").length }));
    process.exit(0);
  }, 500);
`;

function bufferedMeasuresAfterRendering(loadProductionEnv: boolean): number {
  const env = { ...process.env, LOAD_PRODUCTION_ENV: loadProductionEnv ? "1" : "0" };
  delete env.NODE_ENV; // match how users launch the CLI: NODE_ENV unset

  const result = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", CHILD_SCRIPT], {
    cwd: repoRoot,
    env,
    encoding: "utf-8",
  });

  expect(result.status, result.stderr).toBe(0);
  return (JSON.parse(result.stdout.trim().split("\n").pop()!) as { measures: number }).measures;
}

describe("production-env", () => {
  it("keeps React from buffering performance entries on every render", () => {
    // Control: without the module, React's dev build must leak entries, otherwise this test
    // would pass vacuously.
    expect(bufferedMeasuresAfterRendering(false)).toBeGreaterThan(0);

    expect(bufferedMeasuresAfterRendering(true)).toBe(0);
  }, 30_000);
});
