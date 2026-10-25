import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { describeDataLocation, resolveDbPath, saveDbPath, settingsFilePath, validateDbPath } from "./data-location";

let dir: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "taskfile-web-location-"));
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("resolveDbPath", () => {
  it("defaults to the CLI's database in the home directory", () => {
    expect(resolveDbPath({}, "/home/me")).toEqual({
      path: path.join("/home/me", ".taskfile", "tasks.db"),
      source: "default",
    });
  });

  it("uses TASKFILE_DB when set, resolved to an absolute path", () => {
    expect(resolveDbPath({ TASKFILE_DB: "/data/tasks.db" }, "/home/me")).toEqual({
      path: path.resolve("/data/tasks.db"),
      source: "environment",
    });
    expect(path.isAbsolute(resolveDbPath({ TASKFILE_DB: "rel/tasks.db" }, "/home/me").path)).toBe(true);
  });

  it("uses TASKFILE_DATA_DIR/tasks.db for Docker", () => {
    expect(resolveDbPath({ TASKFILE_DATA_DIR: "/data" }, "/home/me")).toEqual({
      path: path.resolve("/data/tasks.db"),
      source: "default",
    });
  });

  it("prefers a saved setting over the defaults but not over TASKFILE_DB", () => {
    const env = { TASKFILE_DATA_DIR: dir };
    saveDbPath(path.join(dir, "work", "tasks.db"), env);
    expect(resolveDbPath(env)).toEqual({ path: path.join(dir, "work", "tasks.db"), source: "settings" });
    expect(resolveDbPath({ ...env, TASKFILE_DB: "/x/y.db" }).source).toBe("environment");
  });

  it("ignores a corrupt or relative settings file", () => {
    const env = { TASKFILE_DATA_DIR: dir };
    fs.writeFileSync(settingsFilePath(env), "{nope");
    expect(resolveDbPath(env).source).toBe("default");
    fs.writeFileSync(settingsFilePath(env), JSON.stringify({ dbPath: "relative.db" }));
    expect(resolveDbPath(env).source).toBe("default");
  });

  it("ignores a blank TASKFILE_DB", () => {
    expect(resolveDbPath({ TASKFILE_DB: "  " }, "/home/me").source).toBe("default");
  });
});

describe("describeDataLocation", () => {
  it("reports the size of an existing database file", () => {
    const file = path.join(dir, "tasks.db");
    fs.writeFileSync(file, "12345");
    expect(describeDataLocation({ TASKFILE_DB: file }, dir)).toMatchObject({
      path: file,
      source: "environment",
      exists: true,
      sizeBytes: 5,
    });
  });

  it("reports a missing file without throwing", () => {
    const file = path.join(dir, "missing.db");
    expect(describeDataLocation({ TASKFILE_DB: file }, dir)).toMatchObject({ exists: false, sizeBytes: null });
  });
});

describe("validateDbPath", () => {
  it("accepts an absolute database file path", () => {
    expect(validateDbPath(`  ${path.join(dir, "a.db")} `)).toEqual({ ok: true, path: path.join(dir, "a.db") });
  });

  it.each([["", "Enter a path."], ["tasks.db", "absolute"], ["/data/tasks.txt", ".db"]])("rejects %j", (input, fragment) => {
    const result = validateDbPath(input);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain(fragment);
  });

  it("rejects a directory", () => {
    const sub = path.join(dir, "folder.db");
    fs.mkdirSync(sub);
    expect(validateDbPath(sub).ok).toBe(false);
  });
});
