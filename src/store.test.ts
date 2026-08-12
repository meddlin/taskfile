import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { addTask, loadTasks, removeTask } from "./store";

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

  it("creates a SQLite database file under the store directory", () => {
    addTask("Buy milk");

    expect(fs.existsSync(path.join(tempHome, ".taskfile", "tasks.db"))).toBe(true);
  });

  it("addTask then loadTasks round-trips the data", () => {
    const task = addTask("Buy milk");

    expect(task).toMatchObject({ id: 1, text: "Buy milk", done: false });
    expect(loadTasks()).toEqual([task]);
  });

  it("addTask assigns incrementing ids", () => {
    addTask("a");
    addTask("b");
    const tasks = loadTasks();

    expect(tasks.map((t) => t.id)).toEqual([1, 2]);
  });

  it("removeTask removes and returns the matching task", () => {
    addTask("Buy milk");
    addTask("Walk the dog");

    const removed = removeTask(1);

    expect(removed).toMatchObject({ id: 1, text: "Buy milk" });
    expect(loadTasks().map((t) => t.id)).toEqual([2]);
  });

  it("removeTask returns undefined when the id is unknown", () => {
    expect(removeTask(99)).toBeUndefined();
  });
});
