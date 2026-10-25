import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { TaskStore } from "./store";
import { changeDataLocation, closeStore, getStore } from "./db";

let dir: string;
const envBackup = { ...process.env };

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "taskfile-web-db-"));
  delete process.env.TASKFILE_DB;
  process.env.TASKFILE_DATA_DIR = dir;
});

afterEach(() => {
  closeStore();
  process.env = { ...envBackup };
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("changeDataLocation", () => {
  it("copies existing tasks to a new file and switches the live store to it", () => {
    const list = getStore().loadLists()[0]!;
    getStore().addTask(list.id, "keep me");
    const target = path.join(dir, "moved", "tasks.db");

    const result = changeDataLocation(target);

    expect(result).toMatchObject({ ok: true, copied: true, location: { path: target, source: "settings" } });
    expect(getStore().loadTasks(list.id).map((t) => t.text)).toEqual(["keep me"]);
  });

  it("uses an existing target as it is instead of overwriting it", () => {
    const target = path.join(dir, "other.db");
    const other = new TaskStore(target);
    other.close();
    getStore().addTask(getStore().loadLists()[0]!.id, "original");

    const result = changeDataLocation(target);

    expect(result).toMatchObject({ ok: true, copied: false });
    expect(getStore().loadTasks(getStore().loadLists()[0]!.id)).toEqual([]);
  });

  it("refuses when TASKFILE_DB pins the location", () => {
    process.env.TASKFILE_DB = path.join(dir, "pinned.db");
    expect(changeDataLocation(path.join(dir, "x.db"))).toMatchObject({ ok: false });
    expect(fs.existsSync(path.join(dir, "settings.json"))).toBe(false);
  });

  it("rejects an invalid path without changing anything", () => {
    expect(changeDataLocation("relative.db")).toMatchObject({ ok: false });
    expect(fs.existsSync(path.join(dir, "settings.json"))).toBe(false);
  });
});
