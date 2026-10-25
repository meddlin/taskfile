import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

export interface DataLocation {
  path: string;
  source: "environment" | "default";
  exists: boolean;
  sizeBytes: number | null;
}

// TASKFILE_DB selects the database file. The default is the CLI's database, so `npm run dev:web`
// shows the same tasks as `taskfile`; the Docker image points it at a mounted volume instead.
export function resolveDbPath(
  env: NodeJS.ProcessEnv = process.env,
  home: string = os.homedir(),
): Pick<DataLocation, "path" | "source"> {
  const configured = env.TASKFILE_DB?.trim();
  if (configured) return { path: path.resolve(configured), source: "environment" };
  return { path: path.join(home, ".taskfile", "tasks.db"), source: "default" };
}

export function describeDataLocation(
  env: NodeJS.ProcessEnv = process.env,
  home: string = os.homedir(),
): DataLocation {
  const resolved = resolveDbPath(env, home);
  try {
    return { ...resolved, exists: true, sizeBytes: fs.statSync(resolved.path).size };
  } catch {
    return { ...resolved, exists: false, sizeBytes: null };
  }
}
