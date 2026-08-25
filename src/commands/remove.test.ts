import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { removeItem } from "./remove.js";
import { addItem } from "./add.js";
import { addTask, loadTasks } from "../store.js";

describe("removeItem", () => {
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

  it("removes an existing task by id", () => {
    addItem("Buy milk");
    addItem("Walk the dog");

    removeItem(1);

    const tasks = loadTasks();
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({ id: 2, text: "Walk the dog" });
  });

  it("prints a confirmation message when removal succeeds", () => {
    addItem("Buy milk");
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    removeItem(1);

    expect(logSpy).toHaveBeenCalledWith("Removed task #1: Buy milk");
  });

  it("prints an error and sets a non-zero exit code for an unknown id", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    process.exitCode = 0;

    removeItem(99);

    expect(errorSpy).toHaveBeenCalledWith("No task found with id #99");
    expect(process.exitCode).toBe(1);

    process.exitCode = 0;
  });

  it("leaves the store unchanged when the id is unknown", () => {
    addItem("Buy milk");

    removeItem(99);

    const tasks = loadTasks();
    expect(tasks).toHaveLength(1);
  });

  it("prints an error and sets a non-zero exit code when the item still has sub-items", () => {
    addItem("Plan trip");
    addTask("Book flights", 1);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    process.exitCode = 0;

    removeItem(1);

    expect(errorSpy).toHaveBeenCalledWith("Delete all sub-items first.");
    expect(process.exitCode).toBe(1);
    expect(loadTasks()).toHaveLength(2);

    process.exitCode = 0;
  });
});
