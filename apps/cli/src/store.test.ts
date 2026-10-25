import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
  addTask,
  computeProgress,
  createList,
  deleteList,
  getDefaultListId,
  hasSubItems,
  loadLists,
  loadBoardTasks,
  loadTasks,
  moveToBoard,
  removeTask,
  renameList,
  setPriority,
  setStatus,
  toggleTask,
  type Task,
} from "./store.js";

function makeTask(overrides: Partial<Task> = {}): Task {
  return { id: 1, text: "task", done: false, parentId: null, priority: false, listId: 1, status: null, createdAt: "", ...overrides };
}

describe("store", () => {
  let tempHome: string;
  let originalHome: string | undefined;
  let listId: number;

  beforeEach(() => {
    originalHome = process.env.HOME;
    tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "taskfile-test-"));
    process.env.HOME = tempHome;
    listId = getDefaultListId();
  });

  afterEach(() => {
    process.env.HOME = originalHome;
    fs.rmSync(tempHome, { recursive: true, force: true });
  });

  it("loadTasks returns an empty array when no tasks have been added", () => {
    expect(loadTasks(listId)).toEqual([]);
  });

  it("creates a SQLite database file under the store directory", () => {
    addTask(listId, "Buy milk");

    expect(fs.existsSync(path.join(tempHome, ".taskfile", "tasks.db"))).toBe(true);
  });

  it("addTask then loadTasks round-trips the data", () => {
    const task = addTask(listId, "Buy milk");

    expect(task).toMatchObject({ id: 1, text: "Buy milk", done: false });
    expect(loadTasks(listId)).toEqual([task]);
  });

  it("addTask assigns incrementing ids", () => {
    addTask(listId, "a");
    addTask(listId, "b");
    const tasks = loadTasks(listId);

    expect(tasks.map((t) => t.id)).toEqual([1, 2]);
  });

  it("removeTask removes and returns the matching task", () => {
    addTask(listId, "Buy milk");
    addTask(listId, "Walk the dog");

    const removed = removeTask(1);

    expect(removed).toMatchObject({ status: "ok", task: { id: 1, text: "Buy milk" } });
    expect(loadTasks(listId).map((t) => t.id)).toEqual([2]);
  });

  it("removeTask returns not-found when the id is unknown", () => {
    expect(removeTask(99)).toEqual({ status: "not-found" });
  });

  it("toggleTask flips a task from not-done to done", () => {
    addTask(listId, "Buy milk");

    const toggled = toggleTask(1);

    expect(toggled).toMatchObject({ status: "ok", task: { id: 1, done: true } });
    expect(loadTasks(listId)[0].done).toBe(true);
  });

  it("toggleTask flips a done task back to not-done", () => {
    addTask(listId, "Buy milk");
    toggleTask(1);

    const toggled = toggleTask(1);

    expect(toggled).toMatchObject({ status: "ok", task: { id: 1, done: false } });
    expect(loadTasks(listId)[0].done).toBe(false);
  });

  it("toggleTask returns not-found when the id is unknown", () => {
    expect(toggleTask(99)).toEqual({ status: "not-found" });
  });

  it("toggleTask does not affect other tasks", () => {
    addTask(listId, "Buy milk");
    addTask(listId, "Walk the dog");

    toggleTask(1);
    const tasks = loadTasks(listId);

    expect(tasks.find((t) => t.id === 1)?.done).toBe(true);
    expect(tasks.find((t) => t.id === 2)?.done).toBe(false);
  });

  it("addTask defaults parentId to null", () => {
    const task = addTask(listId, "Buy milk");

    expect(task.parentId).toBeNull();
  });

  it("addTask with a parentId persists it, and loadTasks orders the sub-item directly after its parent", () => {
    addTask(listId, "Plan trip");
    addTask(listId, "Book flights", 1);

    const tasks = loadTasks(listId);

    expect(tasks.map((t) => ({ id: t.id, parentId: t.parentId }))).toEqual([
      { id: 1, parentId: null },
      { id: 2, parentId: 1 },
    ]);
  });

  it("loadTasks groups each main item's sub-items immediately after it even when created out of order", () => {
    addTask(listId, "Main A"); // id 1
    addTask(listId, "Main B"); // id 2
    addTask(listId, "A sub 1", 1); // id 3
    addTask(listId, "B sub 1", 2); // id 4
    addTask(listId, "A sub 2", 1); // id 5

    const order = loadTasks(listId).map((t) => t.id);

    expect(order).toEqual([1, 3, 5, 2, 4]);
  });

  it("toggleTask blocks completing a main item with an incomplete sub-item", () => {
    addTask(listId, "Main");
    addTask(listId, "Sub", 1);

    const result = toggleTask(1);

    expect(result).toEqual({ status: "blocked", reason: "Complete all sub-items before completing this item." });
    expect(loadTasks(listId).find((t) => t.id === 1)?.done).toBe(false);
  });

  it("toggleTask succeeds on a main item once all its sub-items are done", () => {
    addTask(listId, "Main");
    addTask(listId, "Sub", 1);
    toggleTask(2);

    const result = toggleTask(1);

    expect(result).toMatchObject({ status: "ok", task: { id: 1, done: true } });
  });

  it("completing all sub-items does not auto-complete the main item", () => {
    addTask(listId, "Main");
    addTask(listId, "Sub", 1);

    toggleTask(2);

    expect(loadTasks(listId).find((t) => t.id === 1)?.done).toBe(false);
  });

  it("unchecking a sub-item reverts an already-complete main item back to incomplete", () => {
    addTask(listId, "Main");
    addTask(listId, "Sub", 1);
    toggleTask(2); // complete the sub-item
    toggleTask(1); // complete the main item

    toggleTask(2); // uncheck the sub-item

    expect(loadTasks(listId).find((t) => t.id === 1)?.done).toBe(false);
  });

  it("toggleTask on a sub-item never blocks", () => {
    addTask(listId, "Main");
    addTask(listId, "Sub", 1);

    const result = toggleTask(2);

    expect(result).toMatchObject({ status: "ok", task: { id: 2, done: true } });
  });

  it("removeTask blocks deleting a main item that still has sub-items", () => {
    addTask(listId, "Main");
    addTask(listId, "Sub", 1);

    const result = removeTask(1);

    expect(result).toEqual({ status: "blocked", reason: "Delete all sub-items first." });
    expect(loadTasks(listId).map((t) => t.id)).toEqual([1, 2]);
  });

  it("removeTask succeeds on a main item once its sub-items are gone", () => {
    addTask(listId, "Main");
    addTask(listId, "Sub", 1);
    removeTask(2);

    const result = removeTask(1);

    expect(result).toMatchObject({ status: "ok", task: { id: 1 } });
    expect(loadTasks(listId)).toEqual([]);
  });

  it("removeTask on a sub-item always succeeds directly, even if siblings remain", () => {
    addTask(listId, "Main");
    addTask(listId, "Sub 1", 1);
    addTask(listId, "Sub 2", 1);

    const result = removeTask(2);

    expect(result).toMatchObject({ status: "ok", task: { id: 2 } });
    expect(loadTasks(listId).map((t) => t.id)).toEqual([1, 3]);
  });

  it("hasSubItems returns true when a main item has sub-items and false otherwise", () => {
    addTask(listId, "Main");
    addTask(listId, "Sub", 1);

    expect(hasSubItems(1)).toBe(true);
    expect(hasSubItems(2)).toBe(false);
  });

  it("addTask defaults priority to false", () => {
    const task = addTask(listId, "Buy milk");

    expect(task.priority).toBe(false);
  });

  it("setPriority marks a task as priority", () => {
    addTask(listId, "Buy milk");

    const result = setPriority(1, true);

    expect(result).toMatchObject({ status: "ok", task: { id: 1, priority: true } });
    expect(loadTasks(listId)[0].priority).toBe(true);
  });

  it("setPriority returns not-found when the id is unknown", () => {
    expect(setPriority(99, true)).toEqual({ status: "not-found" });
  });

  it("setPriority on a main item cascades priority to all its sub-items", () => {
    addTask(listId, "Main");
    addTask(listId, "Sub 1", 1);
    addTask(listId, "Sub 2", 1);

    setPriority(1, true);
    const tasks = loadTasks(listId);

    expect(tasks.find((t) => t.id === 2)?.priority).toBe(true);
    expect(tasks.find((t) => t.id === 3)?.priority).toBe(true);
  });

  it("un-setting priority on a main item cascades the un-set to its sub-items", () => {
    addTask(listId, "Main");
    addTask(listId, "Sub", 1);
    setPriority(1, true);

    setPriority(1, false);
    const tasks = loadTasks(listId);

    expect(tasks.find((t) => t.id === 1)?.priority).toBe(false);
    expect(tasks.find((t) => t.id === 2)?.priority).toBe(false);
  });

  it("setPriority on a sub-item does not cascade to its siblings or parent", () => {
    addTask(listId, "Main");
    addTask(listId, "Sub 1", 1);
    addTask(listId, "Sub 2", 1);

    setPriority(2, true);
    const tasks = loadTasks(listId);

    expect(tasks.find((t) => t.id === 1)?.priority).toBe(false);
    expect(tasks.find((t) => t.id === 2)?.priority).toBe(true);
    expect(tasks.find((t) => t.id === 3)?.priority).toBe(false);
  });

  it("loadTasks sorts a priority main item's whole group above a non-priority group", () => {
    addTask(listId, "Main A"); // id 1
    addTask(listId, "Main B"); // id 2
    addTask(listId, "A sub", 1); // id 3
    addTask(listId, "B sub", 2); // id 4

    setPriority(2, true); // mark Main B (and its sub) priority

    expect(loadTasks(listId).map((t) => t.id)).toEqual([2, 4, 1, 3]);
  });

  it("loadTasks reorders a directly-prioritized sub-item within its own group only", () => {
    addTask(listId, "Main A"); // id 1
    addTask(listId, "Main B"); // id 2
    addTask(listId, "A sub 1", 1); // id 3
    addTask(listId, "A sub 2", 1); // id 4

    setPriority(4, true); // mark only "A sub 2" priority, not its parent

    expect(loadTasks(listId).map((t) => t.id)).toEqual([1, 4, 3, 2]);
  });

  it("creates a default \"Todos\" list on first use", () => {
    const lists = loadLists();

    expect(lists).toHaveLength(1);
    expect(lists[0]).toMatchObject({ name: "Todos" });
  });

  it("createList adds a new list and loadLists returns lists in creation order", () => {
    const created = createList("Coding Todos");

    expect(created).toMatchObject({ name: "Coding Todos" });
    expect(loadLists().map((l) => l.name)).toEqual(["Todos", "Coding Todos"]);
  });

  it("renameList updates the list's name", () => {
    const result = renameList(listId, "Personal");

    expect(result).toMatchObject({ status: "ok", list: { id: listId, name: "Personal" } });
    expect(loadLists()[0]?.name).toBe("Personal");
  });

  it("renameList returns not-found for an unknown id", () => {
    expect(renameList(999, "Nope")).toEqual({ status: "not-found" });
  });

  it("renameList blocks renaming to an empty name", () => {
    const result = renameList(listId, "   ");

    expect(result).toEqual({ status: "blocked", reason: "List name cannot be empty." });
  });

  it("deleteList removes the list along with its tasks and sub-items, leaving other lists intact", () => {
    const other = createList("Other list");
    const parent = addTask(other.id, "Parent");
    addTask(other.id, "Child", parent.id);
    addTask(listId, "Keep me");

    const result = deleteList(other.id);

    expect(result).toMatchObject({ status: "ok", list: { id: other.id, name: "Other list" } });
    expect(loadLists().map((l) => l.name)).toEqual(["Todos"]);
    expect(loadTasks(other.id)).toEqual([]);
    expect(loadTasks(listId).map((t) => t.text)).toEqual(["Keep me"]);
  });

  it("deleteList returns not-found for an unknown id", () => {
    createList("Other list");

    expect(deleteList(999)).toEqual({ status: "not-found" });
  });

  it("deleteList blocks deleting the only remaining list", () => {
    addTask(listId, "Survivor");

    expect(deleteList(listId)).toEqual({ status: "blocked", reason: "Can't delete the only list." });
    expect(loadLists()).toHaveLength(1);
    expect(loadTasks(listId)).toHaveLength(1);
  });

  it("getDefaultListId returns the id of the first created list", () => {
    createList("Second list");

    expect(getDefaultListId()).toBe(listId);
  });

  it("scopes tasks to the list they were added to", () => {
    const other = createList("Other list");
    addTask(listId, "In default list");
    addTask(other.id, "In other list");

    expect(loadTasks(listId).map((t) => t.text)).toEqual(["In default list"]);
    expect(loadTasks(other.id).map((t) => t.text)).toEqual(["In other list"]);
  });
});

describe("schema migration", () => {
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

  it("attaches pre-existing single-list tasks to an auto-created default list", () => {
    const dbDir = path.join(tempHome, ".taskfile");
    fs.mkdirSync(dbDir, { recursive: true });
    const legacyDb = new DatabaseSync(path.join(dbDir, "tasks.db"));
    legacyDb.exec(`
      CREATE TABLE tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        text TEXT NOT NULL,
        done INTEGER NOT NULL DEFAULT 0,
        createdAt TEXT NOT NULL,
        parentId INTEGER REFERENCES tasks(id),
        priority INTEGER NOT NULL DEFAULT 0
      )
    `);
    legacyDb
      .prepare("INSERT INTO tasks (text, done, createdAt) VALUES (?, 0, ?)")
      .run("Pre-existing task", new Date().toISOString());
    legacyDb.close();

    const lists = loadLists();

    expect(lists).toHaveLength(1);
    expect(lists[0]?.name).toBe("Todos");
    expect(loadTasks(lists[0]!.id).map((t) => t.text)).toEqual(["Pre-existing task"]);
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

describe("board statuses", () => {
  let tempHome: string;
  let originalHome: string | undefined;
  let listId: number;

  beforeEach(() => {
    originalHome = process.env.HOME;
    tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "taskfile-test-"));
    process.env.HOME = tempHome;
    listId = getDefaultListId();
  });

  afterEach(() => {
    process.env.HOME = originalHome;
    fs.rmSync(tempHome, { recursive: true, force: true });
  });

  it("new tasks are off the board", () => {
    addTask(listId, "Buy milk");

    expect(loadTasks(listId)[0]!.status).toBeNull();
    expect(loadBoardTasks()).toEqual([]);
  });

  it("setStatus puts a task on the board and persists it", () => {
    const task = addTask(listId, "Buy milk");

    const result = setStatus(task.id, "in-progress");

    expect(result).toMatchObject({ status: "ok", task: { status: "in-progress", done: false } });
    expect(loadBoardTasks().map((t) => [t.id, t.status])).toEqual([[task.id, "in-progress"]]);
  });

  it("setStatus(null) takes a task off the board but keeps its done state", () => {
    const task = addTask(listId, "Buy milk");
    setStatus(task.id, "done");

    const result = setStatus(task.id, null);

    expect(result).toMatchObject({ status: "ok", task: { status: null, done: true } });
    expect(loadBoardTasks()).toEqual([]);
  });

  it("returns not-found for an unknown id", () => {
    expect(setStatus(99, "todo")).toEqual({ status: "not-found" });
    expect(moveToBoard(99)).toEqual({ status: "not-found" });
  });

  it("moving into the done column completes the task, and out of it reopens it", () => {
    const task = addTask(listId, "Buy milk");

    expect(setStatus(task.id, "done")).toMatchObject({ task: { done: true } });
    expect(setStatus(task.id, "todo")).toMatchObject({ task: { done: false, status: "todo" } });
  });

  it("blocks moving a parent to done while sub-items are open", () => {
    const parent = addTask(listId, "Parent");
    addTask(listId, "Child", parent.id);

    const result = setStatus(parent.id, "done");

    expect(result).toEqual({ status: "blocked", reason: "Complete all sub-items before completing this item." });
    expect(loadTasks(listId).find((t) => t.id === parent.id)).toMatchObject({ done: false, status: null });
  });

  it("reopening a sub-item via the board pulls a done parent back to to-do", () => {
    const parent = addTask(listId, "Parent");
    const child = addTask(listId, "Child", parent.id);
    setStatus(child.id, "done");
    setStatus(parent.id, "done");

    setStatus(child.id, "in-progress");

    expect(loadTasks(listId).find((t) => t.id === parent.id)).toMatchObject({ done: false, status: "todo" });
  });

  it("toggling a task on the board moves it between done and to-do", () => {
    const task = addTask(listId, "Buy milk");
    setStatus(task.id, "in-progress");

    toggleTask(task.id);
    expect(loadTasks(listId)[0]).toMatchObject({ done: true, status: "done" });

    toggleTask(task.id);
    expect(loadTasks(listId)[0]).toMatchObject({ done: false, status: "todo" });
  });

  it("toggling a task that is off the board leaves its status alone", () => {
    const task = addTask(listId, "Buy milk");

    toggleTask(task.id);

    expect(loadTasks(listId)[0]).toMatchObject({ done: true, status: null });
  });

  it("moveToBoard files open tasks under backlog and finished ones under done", () => {
    const open = addTask(listId, "Open");
    const finished = addTask(listId, "Finished");
    toggleTask(finished.id);

    expect(moveToBoard(open.id)).toMatchObject({ task: { status: "backlog" } });
    expect(moveToBoard(finished.id)).toMatchObject({ task: { status: "done" } });
  });

  it("moveToBoard leaves a task that is already on the board where it is", () => {
    const task = addTask(listId, "Buy milk");
    setStatus(task.id, "in-progress");

    expect(moveToBoard(task.id)).toMatchObject({ task: { status: "in-progress" } });
  });

  it("the board gathers tasks from every list", () => {
    const other = createList("Other");
    const a = addTask(listId, "A");
    const b = addTask(other.id, "B");
    setStatus(a.id, "todo");
    setStatus(b.id, "backlog");

    expect(loadBoardTasks().map((t) => t.id)).toEqual([a.id, b.id]);
  });

  it("adds the status column to a database created before boards existed", () => {
    const legacyHome = fs.mkdtempSync(path.join(os.tmpdir(), "taskfile-test-"));
    process.env.HOME = legacyHome;
    try {
      fs.mkdirSync(path.join(legacyHome, ".taskfile"));
      const legacy = new DatabaseSync(path.join(legacyHome, ".taskfile", "tasks.db"));
      legacy.exec("CREATE TABLE tasks (id INTEGER PRIMARY KEY AUTOINCREMENT, text TEXT NOT NULL, done INTEGER NOT NULL DEFAULT 0, createdAt TEXT NOT NULL)");
      legacy.prepare("INSERT INTO tasks (text, done, createdAt) VALUES ('Old', 0, '')").run();
      legacy.close();

      expect(loadTasks(getDefaultListId())).toMatchObject([{ text: "Old", status: null }]);
    } finally {
      process.env.HOME = tempHome;
      fs.rmSync(legacyHome, { recursive: true, force: true });
    }
  });
});
