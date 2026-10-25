import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

export interface DataLocation {
  path: string;
  // "environment": TASKFILE_DB, which wins and can't be changed from the Settings page.
  // "settings": chosen on the Settings page. "default": TASKFILE_DATA_DIR or the CLI's database.
  source: "environment" | "settings" | "default";
  exists: boolean;
  sizeBytes: number | null;
  // Where the Settings page remembers its choice; inside the Docker volume so it survives restarts.
  settingsFile: string;
}

const DB_EXTENSIONS = new Set([".db", ".sqlite", ".sqlite3"]);

// The Settings page's choice lives next to the data (TASKFILE_DATA_DIR, the Docker volume) so a
// container restart finds it again; outside Docker it sits beside the CLI's database.
export function settingsFilePath(env: NodeJS.ProcessEnv = process.env, home: string = os.homedir()): string {
  const explicit = env.TASKFILE_SETTINGS?.trim();
  if (explicit) return path.resolve(explicit);
  const dataDir = env.TASKFILE_DATA_DIR?.trim();
  if (dataDir) return path.join(path.resolve(dataDir), "settings.json");
  return path.join(home, ".taskfile", "web-settings.json");
}

function readSavedDbPath(file: string): string | null {
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(file, "utf8"));
    const value = (parsed as { dbPath?: unknown } | null)?.dbPath;
    return typeof value === "string" && path.isAbsolute(value) ? value : null;
  } catch {
    return null;
  }
}

// Precedence: TASKFILE_DB, then the Settings page's choice, then TASKFILE_DATA_DIR/tasks.db, then
// the CLI's database, so `npm run dev:web` shows the same tasks as `taskfile`.
export function resolveDbPath(
  env: NodeJS.ProcessEnv = process.env,
  home: string = os.homedir(),
): Pick<DataLocation, "path" | "source"> {
  const configured = env.TASKFILE_DB?.trim();
  if (configured) return { path: path.resolve(configured), source: "environment" };
  const saved = readSavedDbPath(settingsFilePath(env, home));
  if (saved) return { path: saved, source: "settings" };
  const dataDir = env.TASKFILE_DATA_DIR?.trim();
  if (dataDir) return { path: path.join(path.resolve(dataDir), "tasks.db"), source: "default" };
  return { path: path.join(home, ".taskfile", "tasks.db"), source: "default" };
}

export function describeDataLocation(
  env: NodeJS.ProcessEnv = process.env,
  home: string = os.homedir(),
): DataLocation {
  const resolved = resolveDbPath(env, home);
  const settingsFile = settingsFilePath(env, home);
  try {
    return { ...resolved, settingsFile, exists: true, sizeBytes: fs.statSync(resolved.path).size };
  } catch {
    return { ...resolved, settingsFile, exists: false, sizeBytes: null };
  }
}

export type ValidatedPath = { ok: true; path: string } | { ok: false; error: string };

export function validateDbPath(input: string): ValidatedPath {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, error: "Enter a path." };
  if (!path.isAbsolute(trimmed)) return { ok: false, error: "Use an absolute path, e.g. /data/tasks.db." };
  const resolved = path.resolve(trimmed);
  if (!DB_EXTENSIONS.has(path.extname(resolved).toLowerCase())) {
    return { ok: false, error: "The file name must end in .db, .sqlite or .sqlite3." };
  }
  try {
    if (fs.statSync(resolved).isDirectory()) return { ok: false, error: "That path is a directory." };
  } catch {
    // Not there yet; it will be created.
  }
  return { ok: true, path: resolved };
}

export function saveDbPath(dbPath: string, env: NodeJS.ProcessEnv = process.env, home: string = os.homedir()): void {
  const file = settingsFilePath(env, home);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ dbPath }, null, 2) + "\n");
}
