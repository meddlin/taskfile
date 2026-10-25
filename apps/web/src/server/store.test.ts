import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { TaskStore } from "./store";

let dir: string;
let file: string;
let store: TaskStore;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "taskfile-web-"));
  file = path.join(dir, "nested", "tasks.db");
  store = new TaskStore(file);
});

afterEach(() => {
  store.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

const ok = <T>(r: { status: string; value?: T }): T => {
  expect(r.status).toBe("ok");
  return (r as { value: T }).value;
};

describe("TaskStore", () => {
  it("creates the database (and its directory) with a default list", () => {
    expect(store.loadLists().map((l) => l.name)).toEqual(["Todos"]);
  });

  it("persists tasks across reopening the file", () => {
    const [list] = store.loadLists();
    ok(store.addTask(list!.id, "  Buy milk  "));
    store.close();
    store = new TaskStore(file);
    expect(store.loadTasks(list!.id).map((t) => t.text)).toEqual(["Buy milk"]);
  });

  it("rejects blank task and list names", () => {
    const [list] = store.loadLists();
    expect(store.addTask(list!.id, "   ")).toMatchObject({ status: "blocked" });
    expect(store.createList("")).toMatchObject({ status: "blocked" });
  });

  it("reports an unknown list or task as not-found", () => {
    expect(store.addTask(999, "x")).toEqual({ status: "not-found" });
    expect(store.toggleTask(999)).toEqual({ status: "not-found" });
    expect(store.removeTask(999)).toEqual({ status: "not-found" });
  });

  it("scopes tasks to their list", () => {
    const [todos] = store.loadLists();
    const work = ok(store.createList("Work"));
    ok(store.addTask(todos!.id, "a"));
    ok(store.addTask(work.id, "b"));
    expect(store.loadTasks(work.id).map((t) => t.text)).toEqual(["b"]);
  });

  it("toggles done on and off, and removes tasks", () => {
    const [list] = store.loadLists();
    const task = ok(store.addTask(list!.id, "a"));
    expect(ok(store.toggleTask(task.id)).done).toBe(true);
    expect(ok(store.toggleTask(task.id)).done).toBe(false);
    ok(store.removeTask(task.id));
    expect(store.loadTasks(list!.id)).toEqual([]);
  });

  it("keeps a CLI board column in step with the checkbox", () => {
    const [list] = store.loadLists();
    const task = ok(store.addTask(list!.id, "a"));
    const raw = new DatabaseSync(file);
    raw.prepare("UPDATE tasks SET status = 'backlog' WHERE id = ?").run(task.id);
    const column = () => (raw.prepare("SELECT status FROM tasks WHERE id = ?").get(task.id) as { status: string }).status;

    ok(store.toggleTask(task.id));
    expect(column()).toBe("done");
    ok(store.toggleTask(task.id));
    expect(column()).toBe("todo");
    raw.close();
  });

  describe("status board", () => {
    it("puts tasks on the board in the column matching their checkbox, across lists", () => {
      const [list] = store.loadLists();
      const other = ok(store.createList("Other"));
      const open = ok(store.addTask(list!.id, "open"));
      const finished = ok(store.addTask(other.id, "finished"));
      ok(store.toggleTask(finished.id));
      ok(store.addTask(list!.id, "off board"));

      expect(ok(store.moveToBoard(open.id)).status).toBe("backlog");
      expect(ok(store.moveToBoard(finished.id)).status).toBe("done");
      expect(store.loadBoardTasks().map((t) => t.text)).toEqual(["open", "finished"]);
    });

    it("keeps an existing column when sent to the board again", () => {
      const [list] = store.loadLists();
      const task = ok(store.addTask(list!.id, "a"));
      ok(store.setStatus(task.id, "in-progress"));
      expect(ok(store.moveToBoard(task.id)).status).toBe("in-progress");
    });

    it("syncs the done checkbox with the done column", () => {
      const [list] = store.loadLists();
      const task = ok(store.addTask(list!.id, "a"));

      expect(ok(store.setStatus(task.id, "done"))).toMatchObject({ status: "done", done: true });
      expect(ok(store.setStatus(task.id, "todo"))).toMatchObject({ status: "todo", done: false });
      expect(ok(store.setStatus(task.id, "done")).done).toBe(true);
      // Taking it off the board leaves the checkbox alone.
      expect(ok(store.setStatus(task.id, null))).toMatchObject({ status: null, done: true });
      expect(store.loadBoardTasks()).toEqual([]);
    });

    it("reports an unknown task as not-found", () => {
      expect(store.setStatus(999, "todo")).toEqual({ status: "not-found" });
      expect(store.moveToBoard(999)).toEqual({ status: "not-found" });
    });

    it("won't move a parent with open sub-items to done, and reopens it with its sub-item", () => {
      const [list] = store.loadLists();
      const parent = ok(store.addTask(list!.id, "parent"));
      const raw = new DatabaseSync(file);
      const child = Number(
        raw
          .prepare("INSERT INTO tasks (text, done, createdAt, parentId, listId) VALUES ('child', 0, ?, ?, ?)")
          .run(new Date().toISOString(), parent.id, list!.id).lastInsertRowid,
      );
      raw.close();

      expect(store.setStatus(parent.id, "done")).toMatchObject({ status: "blocked" });

      ok(store.setStatus(child, "done"));
      ok(store.setStatus(parent.id, "done"));
      ok(store.setStatus(child, "todo"));
      expect(store.loadBoardTasks().find((t) => t.id === parent.id)).toMatchObject({ status: "todo", done: false });
    });
  });

  // Sub-items are created by the CLI/TUI; the web app must respect the same rules on a shared file.
  describe("sub-items created by the CLI", () => {
    function addSubItem(parentId: number, listId: number): number {
      const raw = new DatabaseSync(file);
      const info = raw
        .prepare("INSERT INTO tasks (text, done, createdAt, parentId, listId) VALUES ('child', 0, ?, ?, ?)")
        .run(new Date().toISOString(), parentId, listId);
      raw.close();
      return Number(info.lastInsertRowid);
    }

    it("blocks completing or deleting a parent with open sub-items", () => {
      const [list] = store.loadLists();
      const parent = ok(store.addTask(list!.id, "parent"));
      const childId = addSubItem(parent.id, list!.id);

      expect(store.toggleTask(parent.id)).toMatchObject({ status: "blocked" });
      expect(store.removeTask(parent.id)).toMatchObject({ status: "blocked" });

      ok(store.toggleTask(childId));
      ok(store.toggleTask(parent.id));
      // Reopening the child reopens the parent.
      ok(store.toggleTask(childId));
      expect(store.loadTasks(list!.id).map((t) => t.done)).toEqual([false, false]);
    });
  });
});
