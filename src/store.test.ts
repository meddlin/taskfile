import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { getNextId, loadTasks, saveTasks, Task } from "./store";

describe("store", () => {
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

  it("loadTasks returns an empty array when no store file exists", () => {
    expect(loadTasks()).toEqual([]);
  });

  it("saveTasks then loadTasks round-trips the data", () => {
    const tasks: Task[] = [
      { id: 1, text: "Buy milk", done: false, createdAt: "2026-01-01T00:00:00.000Z" },
    ];

    saveTasks(tasks);

    expect(loadTasks()).toEqual(tasks);
  });

  it("getNextId returns 1 for an empty list", () => {
    expect(getNextId([])).toBe(1);
  });

  it("getNextId returns one more than the highest existing id", () => {
    const tasks: Task[] = [
      { id: 1, text: "a", done: false, createdAt: "" },
      { id: 5, text: "b", done: false, createdAt: "" },
      { id: 3, text: "c", done: false, createdAt: "" },
    ];

    expect(getNextId(tasks)).toBe(6);
  });
});
