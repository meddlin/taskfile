import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { listItems } from "./list";
import { addItem } from "./add";

describe("listItems", () => {
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

  it("prints a friendly message when there are no tasks", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    listItems();

    expect(logSpy).toHaveBeenCalledWith(
      "No tasks yet. Add one with `taskfile add <text>`."
    );
  });

  it("prints each task with its id and pending marker", () => {
    addItem("Buy milk");
    addItem("Walk the dog");
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    listItems();

    expect(logSpy).toHaveBeenNthCalledWith(1, "[ ] #1 Buy milk");
    expect(logSpy).toHaveBeenNthCalledWith(2, "[ ] #2 Walk the dog");
  });
});
