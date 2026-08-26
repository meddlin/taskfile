import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { addTask, computeProgress, hasSubItems, loadTasks, removeTask, setPriority, toggleTask, type Task } from "./store.js";

function makeTask(overrides: Partial<Task> = {}): Task {
  return { id: 1, text: "task", done: false, parentId: null, priority: false, createdAt: "", ...overrides };
}

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

    expect(removed).toMatchObject({ status: "ok", task: { id: 1, text: "Buy milk" } });
    expect(loadTasks().map((t) => t.id)).toEqual([2]);
  });

  it("removeTask returns not-found when the id is unknown", () => {
    expect(removeTask(99)).toEqual({ status: "not-found" });
  });

  it("toggleTask flips a task from not-done to done", () => {
    addTask("Buy milk");

    const toggled = toggleTask(1);

    expect(toggled).toMatchObject({ status: "ok", task: { id: 1, done: true } });
    expect(loadTasks()[0].done).toBe(true);
  });

  it("toggleTask flips a done task back to not-done", () => {
    addTask("Buy milk");
    toggleTask(1);

    const toggled = toggleTask(1);

    expect(toggled).toMatchObject({ status: "ok", task: { id: 1, done: false } });
    expect(loadTasks()[0].done).toBe(false);
  });

  it("toggleTask returns not-found when the id is unknown", () => {
    expect(toggleTask(99)).toEqual({ status: "not-found" });
  });

  it("toggleTask does not affect other tasks", () => {
    addTask("Buy milk");
    addTask("Walk the dog");

    toggleTask(1);
    const tasks = loadTasks();

    expect(tasks.find((t) => t.id === 1)?.done).toBe(true);
    expect(tasks.find((t) => t.id === 2)?.done).toBe(false);
  });

  it("addTask defaults parentId to null", () => {
    const task = addTask("Buy milk");

    expect(task.parentId).toBeNull();
  });

  it("addTask with a parentId persists it, and loadTasks orders the sub-item directly after its parent", () => {
    addTask("Plan trip");
    addTask("Book flights", 1);

    const tasks = loadTasks();

    expect(tasks.map((t) => ({ id: t.id, parentId: t.parentId }))).toEqual([
      { id: 1, parentId: null },
      { id: 2, parentId: 1 },
    ]);
  });

  it("loadTasks groups each main item's sub-items immediately after it even when created out of order", () => {
    addTask("Main A"); // id 1
    addTask("Main B"); // id 2
    addTask("A sub 1", 1); // id 3
    addTask("B sub 1", 2); // id 4
    addTask("A sub 2", 1); // id 5

    const order = loadTasks().map((t) => t.id);

    expect(order).toEqual([1, 3, 5, 2, 4]);
  });

  it("toggleTask blocks completing a main item with an incomplete sub-item", () => {
    addTask("Main");
    addTask("Sub", 1);

    const result = toggleTask(1);

    expect(result).toEqual({ status: "blocked", reason: "Complete all sub-items before completing this item." });
    expect(loadTasks().find((t) => t.id === 1)?.done).toBe(false);
  });

  it("toggleTask succeeds on a main item once all its sub-items are done", () => {
    addTask("Main");
    addTask("Sub", 1);
    toggleTask(2);

    const result = toggleTask(1);

    expect(result).toMatchObject({ status: "ok", task: { id: 1, done: true } });
  });

  it("completing all sub-items does not auto-complete the main item", () => {
    addTask("Main");
    addTask("Sub", 1);

    toggleTask(2);

    expect(loadTasks().find((t) => t.id === 1)?.done).toBe(false);
  });

  it("unchecking a sub-item reverts an already-complete main item back to incomplete", () => {
    addTask("Main");
    addTask("Sub", 1);
    toggleTask(2); // complete the sub-item
    toggleTask(1); // complete the main item

    toggleTask(2); // uncheck the sub-item

    expect(loadTasks().find((t) => t.id === 1)?.done).toBe(false);
  });

  it("toggleTask on a sub-item never blocks", () => {
    addTask("Main");
    addTask("Sub", 1);

    const result = toggleTask(2);

    expect(result).toMatchObject({ status: "ok", task: { id: 2, done: true } });
  });

  it("removeTask blocks deleting a main item that still has sub-items", () => {
    addTask("Main");
    addTask("Sub", 1);

    const result = removeTask(1);

    expect(result).toEqual({ status: "blocked", reason: "Delete all sub-items first." });
    expect(loadTasks().map((t) => t.id)).toEqual([1, 2]);
  });

  it("removeTask succeeds on a main item once its sub-items are gone", () => {
    addTask("Main");
    addTask("Sub", 1);
    removeTask(2);

    const result = removeTask(1);

    expect(result).toMatchObject({ status: "ok", task: { id: 1 } });
    expect(loadTasks()).toEqual([]);
  });

  it("removeTask on a sub-item always succeeds directly, even if siblings remain", () => {
    addTask("Main");
    addTask("Sub 1", 1);
    addTask("Sub 2", 1);

    const result = removeTask(2);

    expect(result).toMatchObject({ status: "ok", task: { id: 2 } });
    expect(loadTasks().map((t) => t.id)).toEqual([1, 3]);
  });

  it("hasSubItems returns true when a main item has sub-items and false otherwise", () => {
    addTask("Main");
    addTask("Sub", 1);

    expect(hasSubItems(1)).toBe(true);
    expect(hasSubItems(2)).toBe(false);
  });

  it("addTask defaults priority to false", () => {
    const task = addTask("Buy milk");

    expect(task.priority).toBe(false);
  });

  it("setPriority marks a task as priority", () => {
    addTask("Buy milk");

    const result = setPriority(1, true);

    expect(result).toMatchObject({ status: "ok", task: { id: 1, priority: true } });
    expect(loadTasks()[0].priority).toBe(true);
  });

  it("setPriority returns not-found when the id is unknown", () => {
    expect(setPriority(99, true)).toEqual({ status: "not-found" });
  });

  it("setPriority on a main item cascades priority to all its sub-items", () => {
    addTask("Main");
    addTask("Sub 1", 1);
    addTask("Sub 2", 1);

    setPriority(1, true);
    const tasks = loadTasks();

    expect(tasks.find((t) => t.id === 2)?.priority).toBe(true);
    expect(tasks.find((t) => t.id === 3)?.priority).toBe(true);
  });

  it("un-setting priority on a main item cascades the un-set to its sub-items", () => {
    addTask("Main");
    addTask("Sub", 1);
    setPriority(1, true);

    setPriority(1, false);
    const tasks = loadTasks();

    expect(tasks.find((t) => t.id === 1)?.priority).toBe(false);
    expect(tasks.find((t) => t.id === 2)?.priority).toBe(false);
  });

  it("setPriority on a sub-item does not cascade to its siblings or parent", () => {
    addTask("Main");
    addTask("Sub 1", 1);
    addTask("Sub 2", 1);

    setPriority(2, true);
    const tasks = loadTasks();

    expect(tasks.find((t) => t.id === 1)?.priority).toBe(false);
    expect(tasks.find((t) => t.id === 2)?.priority).toBe(true);
    expect(tasks.find((t) => t.id === 3)?.priority).toBe(false);
  });

  it("loadTasks sorts a priority main item's whole group above a non-priority group", () => {
    addTask("Main A"); // id 1
    addTask("Main B"); // id 2
    addTask("A sub", 1); // id 3
    addTask("B sub", 2); // id 4

    setPriority(2, true); // mark Main B (and its sub) priority

    expect(loadTasks().map((t) => t.id)).toEqual([2, 4, 1, 3]);
  });

  it("loadTasks reorders a directly-prioritized sub-item within its own group only", () => {
    addTask("Main A"); // id 1
    addTask("Main B"); // id 2
    addTask("A sub 1", 1); // id 3
    addTask("A sub 2", 1); // id 4

    setPriority(4, true); // mark only "A sub 2" priority, not its parent

    expect(loadTasks().map((t) => t.id)).toEqual([1, 4, 3, 2]);
  });
});

describe("computeProgress", () => {
  it("returns zeroes for an empty task list", () => {
    expect(computeProgress([])).toEqual({ done: 0, total: 0, percent: 0 });
  });

  it("returns 100 percent when all tasks are done", () => {
    const tasks = [makeTask({ id: 1, done: true }), makeTask({ id: 2, done: true })];
    expect(computeProgress(tasks)).toEqual({ done: 2, total: 2, percent: 100 });
  });

  it("returns 0 percent when no tasks are done", () => {
    const tasks = [makeTask({ id: 1, done: false }), makeTask({ id: 2, done: false })];
    expect(computeProgress(tasks)).toEqual({ done: 0, total: 2, percent: 0 });
  });

  it("counts main items and sub-items flatly", () => {
    const tasks = [
      makeTask({ id: 1, parentId: null, done: true }),
      makeTask({ id: 2, parentId: 1, done: false }),
      makeTask({ id: 3, parentId: 1, done: false }),
      makeTask({ id: 4, parentId: 1, done: false }),
    ];
    expect(computeProgress(tasks)).toEqual({ done: 1, total: 4, percent: 25 });
  });

  it("rounds the percentage", () => {
    const tasks = [
      makeTask({ id: 1, done: true }),
      makeTask({ id: 2, done: false }),
      makeTask({ id: 3, done: false }),
    ];
    expect(computeProgress(tasks).percent).toBe(33);
  });
});
