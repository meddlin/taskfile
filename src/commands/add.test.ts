import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { addItem } from "./add.js";
import { loadTasks } from "../store.js";

describe("addItem", () => {
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
    vi.restoreAllMocks();
  });

  it("adds a task with id 1 when the store is empty", () => {
    addItem("Buy milk");

    const tasks = loadTasks();
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({ id: 1, text: "Buy milk", done: false });
  });

  it("increments the id for each new task", () => {
    addItem("Buy milk");
    addItem("Walk the dog");

    const tasks = loadTasks();
    expect(tasks.map((t) => t.id)).toEqual([1, 2]);
    expect(tasks.map((t) => t.text)).toEqual(["Buy milk", "Walk the dog"]);
  });

  it("prints a confirmation message", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    addItem("Buy milk");

    expect(logSpy).toHaveBeenCalledWith("Added task #1: Buy milk");
  });
});
