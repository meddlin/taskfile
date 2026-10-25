import * as fs from "node:fs";
import { describeDataLocation, resolveDbPath, saveDbPath, validateDbPath, type DataLocation } from "./data-location";
import { TaskStore } from "./store";

let store: TaskStore | undefined;

export function getStore(): TaskStore {
  store ??= new TaskStore(resolveDbPath().path);
  return store;
}

export function closeStore(): void {
  store?.close();
  store = undefined;
}

export type ChangeLocationResult = { ok: true; location: DataLocation; copied: boolean } | { ok: false; error: string };

// Points the app at another database file. An existing database is copied to a file that doesn't
// exist yet, so switching doesn't strand your tasks; an existing target is used as it is.
export function changeDataLocation(input: string, env: NodeJS.ProcessEnv = process.env): ChangeLocationResult {
  if (env.TASKFILE_DB?.trim()) {
    return { ok: false, error: "The location is fixed by the TASKFILE_DB environment variable." };
  }
  const target = validateDbPath(input);
  if (!target.ok) return target;
  const current = resolveDbPath(env).path;
  let copied = false;
  try {
    if (target.path !== current) {
      if (!fs.existsSync(target.path) && fs.existsSync(current)) {
        getStore().copyTo(target.path);
        copied = true;
      }
      // Open the target first so an unwritable or corrupt file is rejected before it is saved.
      new TaskStore(target.path).close();
      saveDbPath(target.path, env);
      closeStore();
    }
  } catch (error) {
    if (copied) fs.rmSync(target.path, { force: true });
    return { ok: false, error: `Could not use that location: ${error instanceof Error ? error.message : String(error)}` };
  }
  return { ok: true, location: describeDataLocation(env), copied };
}
