import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { TOKEN_HEADER } from "./guard";
import { startWebServer, type RunningServer } from "./webServer";

// Integration test: starts the real srvx server on a real loopback port, with a stub in place of the
// web app's bundle (src/test/fakeWebServer.ts) and a temp folder as the static client assets.
describe("startWebServer", () => {
  const token = "test-token";
  let clientDir: string;
  let server: RunningServer;

  beforeEach(async () => {
    clientDir = fs.mkdtempSync(path.join(os.tmpdir(), "taskfile-client-"));
    fs.mkdirSync(path.join(clientDir, "assets"));
    fs.writeFileSync(path.join(clientDir, "assets", "app.js"), "console.log('hi');");
    server = await startWebServer({ clientDir, token });
  });

  afterEach(async () => {
    await server.close();
    fs.rmSync(clientDir, { recursive: true, force: true });
  });

  const get = (pathname: string, headers: Record<string, string> = { [TOKEN_HEADER]: token }) =>
    fetch(`${server.origin}${pathname}`, { headers });

  it("listens on the loopback interface, on a port the OS chose", () => {
    const url = new URL(server.origin);
    expect(url.hostname).toBe("127.0.0.1");
    expect(Number(url.port)).toBeGreaterThan(0);
  });

  it("hands pages to the web app and static files to the client folder", async () => {
    expect(await (await get("/")).text()).toBe("rendered by the web app");
    const asset = await get("/assets/app.js");
    expect(asset.status).toBe(200);
    expect(await asset.text()).toContain("console.log");
  });

  it("refuses requests without the token, for pages and static files alike", async () => {
    expect((await get("/", {})).status).toBe(403);
    expect((await get("/assets/app.js", {})).status).toBe(403);
    expect((await get("/", { [TOKEN_HEADER]: "wrong" })).status).toBe(403);
  });
});
