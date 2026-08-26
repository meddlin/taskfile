import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { loadSettings, saveSettings } from "./settings.js";

describe("settings", () => {
  let tempHome: string;
  let originalHome: string | undefined;

  beforeEach(() => {
    originalHome = process.env.HOME;
    tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "taskfile-test-"));
    process.env.HOME = tempHome;
  });

  afterEach(() => {
    process.env.HOME = originalHome;
    fs.rmSync(tempHome, { recursive: true, force: true });
  });

  it("loadSettings returns defaults when no settings file exists", () => {
    expect(loadSettings()).toEqual({ width: 120, height: 40, progressAnimation: true, lastActiveListId: null });
  });

  it("saveSettings persists a partial update and merges over the current values", () => {
    saveSettings({ width: 100 });
    const saved = saveSettings({ height: 30 });

    expect(saved).toEqual({ width: 100, height: 30, progressAnimation: true, lastActiveListId: null });
    expect(loadSettings()).toEqual({ width: 100, height: 30, progressAnimation: true, lastActiveListId: null });
  });

  it("saveSettings persists the lastActiveListId", () => {
    const saved = saveSettings({ lastActiveListId: 3 });

    expect(saved).toMatchObject({ lastActiveListId: 3 });
    expect(loadSettings()).toMatchObject({ lastActiveListId: 3 });
  });

  it("saveSettings persists the progressAnimation toggle", () => {
    const saved = saveSettings({ progressAnimation: false });

    expect(saved).toMatchObject({ progressAnimation: false });
    expect(loadSettings()).toMatchObject({ progressAnimation: false });
  });

  it("creates the settings file under the store directory", () => {
    saveSettings({ width: 100 });

    expect(fs.existsSync(path.join(tempHome, ".taskfile", "settings.json"))).toBe(true);
  });

  it("clamps width and height to their supported ranges", () => {
    expect(saveSettings({ width: 10 })).toMatchObject({ width: 40 });
    expect(saveSettings({ width: 1000 })).toMatchObject({ width: 300 });
    expect(saveSettings({ height: 1 })).toMatchObject({ height: 10 });
    expect(saveSettings({ height: 1000 })).toMatchObject({ height: 100 });
  });

  it("falls back to defaults when the settings file is corrupt", () => {
    const dir = path.join(tempHome, ".taskfile");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "settings.json"), "not json");

    expect(loadSettings()).toEqual({ width: 120, height: 40, progressAnimation: true, lastActiveListId: null });
  });
});
