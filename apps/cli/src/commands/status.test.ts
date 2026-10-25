import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { setItemStatus } from "./status.js";
import { showBoard } from "./board.js";
import { addItem } from "./add.js";
import { getDefaultListId, loadTasks } from "../store.js";

describe("status and board commands", () => {
  let tempHome: string;
  let originalHome: string | undefined;

  beforeEach(() => {
    originalHome = process.env.HOME;
    tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "taskfile-test-"));
    process.env.HOME = tempHome;
    process.exitCode = undefined;
  });

  afterEach(() => {
    process.env.HOME = originalHome;
    fs.rmSync(tempHome, { recursive: true, force: true });
    vi.restoreAllMocks();
    process.exitCode = undefined;
  });

  it("sets a status and confirms it", () => {
    addItem("Buy milk");
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    setItemStatus(1, "in progress");

    expect(loadTasks(getDefaultListId())[0]!.status).toBe("in-progress");
    expect(logSpy).toHaveBeenCalledWith("Moved task #1 to In progress: Buy milk");
  });

  it("removes a task from the board with `none`", () => {
    addItem("Buy milk");
    setItemStatus(1, "todo");
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    setItemStatus(1, "none");

    expect(loadTasks(getDefaultListId())[0]!.status).toBeNull();
    expect(logSpy).toHaveBeenCalledWith("Removed task #1 from the board: Buy milk");
  });

  it("rejects an unknown status and sets a failing exit code", () => {
    addItem("Buy milk");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    setItemStatus(1, "blocked");

    expect(errorSpy).toHaveBeenCalledWith('Unknown status "blocked". Use one of: backlog, todo, in-progress, done, none.');
    expect(process.exitCode).toBe(1);
    expect(loadTasks(getDefaultListId())[0]!.status).toBeNull();
  });

  it("reports a missing task", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    setItemStatus(9, "todo");

    expect(errorSpy).toHaveBeenCalledWith("No task found with id #9");
    expect(process.exitCode).toBe(1);
  });

  it("explains how to fill an empty board", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    showBoard();

    expect(logSpy).toHaveBeenCalledWith("The board is empty. Put a task on it with `taskfile status <id> <status>`.");
  });

  it("prints every column with its tasks, including empty ones", () => {
    addItem("Buy milk");
    addItem("Walk the dog");
    addItem("Off the board");
    setItemStatus(1, "backlog");
    setItemStatus(2, "done");
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    showBoard();

    expect(logSpy.mock.calls.map((call) => call[0])).toEqual([
      "BACKLOG (1)",
      "  #1 Buy milk",
      "",
      "TO-DO (0)",
      "",
      "IN PROGRESS (0)",
      "",
      "DONE (1)",
      "  #2 Walk the dog",
    ]);
  });
});
