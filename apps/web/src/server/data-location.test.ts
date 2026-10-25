import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { describeDataLocation, resolveDbPath } from "./data-location";

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

  it("ignores a blank TASKFILE_DB", () => {
    expect(resolveDbPath({ TASKFILE_DB: "  " }, "/home/me").source).toBe("default");
  });
});

describe("describeDataLocation", () => {
  it("reports the size of an existing database file", () => {
    const file = path.join(dir, "tasks.db");
    fs.writeFileSync(file, "12345");
    expect(describeDataLocation({ TASKFILE_DB: file }, dir)).toEqual({
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
