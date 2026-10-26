import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { TOKEN_HEADER } from "./guard";
import type { RunningServer } from "./webServer";

// `Taskfile --smoke-test` (scripts/smoke.mjs runs it against the packaged app). This is the
// integration check that matters for a desktop build: the bundled server renders a page, node:sqlite
// works inside Electron, and the access guard is on. Throws on the first failure.
export async function runSmokeTest(server: RunningServer, token: string): Promise<void> {
  const url = `${server.origin}/`;

  const anonymous = await fetch(url);
  if (anonymous.status !== 403) throw new Error(`a request without the token got ${anonymous.status}, expected 403`);

  const page = await fetch(url, { headers: { [TOKEN_HEADER]: token } });
  const html = await page.text();
  if (page.status !== 200) throw new Error(`GET / returned ${page.status}`);
  if (!html.includes("Taskfile")) throw new Error("GET / did not render the Taskfile page");

  // Rendering the page opens the store, which creates the database under the (smoke-test) HOME.
  const db = path.join(os.homedir(), ".taskfile", "tasks.db");
  if (!fs.existsSync(db)) throw new Error(`rendering the page did not create ${db}`);
}
