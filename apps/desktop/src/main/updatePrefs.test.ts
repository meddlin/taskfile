import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createUpdatePrefsStore, DEFAULT_UPDATE_PREFS } from "./updatePrefs";

describe("update preferences file", () => {
  let dir: string;
  let file: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "taskfile-prefs-"));
    file = path.join(dir, "nested", "updates.json");
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it("defaults to checking automatically, stable releases only", () => {
    expect(DEFAULT_UPDATE_PREFS).toEqual({ autoCheck: true, allowPrerelease: false });
    expect(createUpdatePrefsStore(file).load()).toEqual(DEFAULT_UPDATE_PREFS);
  });

  it("round-trips what was saved, creating the folder", () => {
    const store = createUpdatePrefsStore(file);
    store.save({ autoCheck: false, allowPrerelease: true });
    expect(store.load()).toEqual({ autoCheck: false, allowPrerelease: true });
    expect(fs.readdirSync(path.dirname(file))).toEqual(["updates.json"]);
  });

  it("falls back to the defaults for a damaged file or wrong types, field by field", () => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, "{ not json");
    expect(createUpdatePrefsStore(file).load()).toEqual(DEFAULT_UPDATE_PREFS);
    fs.writeFileSync(file, JSON.stringify({ autoCheck: "no", allowPrerelease: true }));
    expect(createUpdatePrefsStore(file).load()).toEqual({ autoCheck: true, allowPrerelease: true });
  });
});
