import { DatabaseSync } from "node:sqlite";
import * as fs from "node:fs";
import * as path from "node:path";

export interface Task {
  id: number;
  text: string;
  done: boolean;
  parentId: number | null;
  priority: boolean;
  listId: number;
  createdAt: string;
}

export interface List {
  id: number;
  name: string;
  createdAt: string;
}

interface TaskRow {
  id: number;
  text: string;
  done: number;
  parentId: number | null;
  priority: number;
  listId: number;
  createdAt: string;
}

export type MutationResult<T> = { status: "ok"; value: T } | { status: "not-found" } | { status: "blocked"; reason: string };

const TASK_COLUMNS = "id, text, done, parentId, priority, listId, createdAt";

function rowToTask(row: TaskRow): Task {
  return { ...row, done: !!row.done, priority: !!row.priority };
}

// Same tables as the CLI's store (apps/cli/src/store.ts), so both apps can open the same database
// file. The CLI also keeps snapshot tables; the web app doesn't use them and leaves them alone.
function ensureSchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS lists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      createdAt TEXT NOT NULL
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      text TEXT NOT NULL,
      done INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL,
      parentId INTEGER REFERENCES tasks(id),
      priority INTEGER NOT NULL DEFAULT 0,
      listId INTEGER REFERENCES lists(id),
      status TEXT
    )
  `);

  // Databases created before the CLI's board feature (or by an older web build) lack this column.
  const columns = db.prepare("PRAGMA table_info(tasks)").all() as unknown as { name: string }[];
  if (!columns.some((column) => column.name === "status")) {
    db.exec("ALTER TABLE tasks ADD COLUMN status TEXT");
  }

  const { count } = db.prepare("SELECT COUNT(*) AS count FROM lists").get() as unknown as { count: number };
  if (count === 0) {
    db.prepare("INSERT INTO lists (name, createdAt) VALUES (?, ?)").run("Todos", new Date().toISOString());
  }
}

export class TaskStore {
  private readonly db: DatabaseSync;

  constructor(file: string) {
    if (file !== ":memory:") {
      fs.mkdirSync(path.dirname(file), { recursive: true });
    }
    this.db = new DatabaseSync(file);
    ensureSchema(this.db);
  }

  close(): void {
    this.db.close();
  }

  loadLists(): List[] {
    return this.db.prepare("SELECT id, name, createdAt FROM lists ORDER BY id").all() as unknown as List[];
  }

  createList(name: string): MutationResult<List> {
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      return { status: "blocked", reason: "List name cannot be empty." };
    }
    const createdAt = new Date().toISOString();
    const info = this.db.prepare("INSERT INTO lists (name, createdAt) VALUES (?, ?)").run(trimmed, createdAt);
    return { status: "ok", value: { id: Number(info.lastInsertRowid), name: trimmed, createdAt } };
  }

  // Same ordering as the CLI: priority parents first, each parent followed by its sub-items.
  loadTasks(listId: number): Task[] {
    const rows = this.db
      .prepare(
        `SELECT ${TASK_COLUMNS} FROM tasks
         WHERE listId = ?
         ORDER BY
           (SELECT priority FROM tasks p WHERE p.id = COALESCE(tasks.parentId, tasks.id)) DESC,
           COALESCE(parentId, id),
           parentId IS NOT NULL,
           priority DESC,
           id`,
      )
      .all(listId) as unknown as TaskRow[];
    return rows.map(rowToTask);
  }

  addTask(listId: number, text: string): MutationResult<Task> {
    const trimmed = text.trim();
    if (trimmed.length === 0) {
      return { status: "blocked", reason: "Task text cannot be empty." };
    }
    const exists = this.db.prepare("SELECT id FROM lists WHERE id = ?").get(listId);
    if (!exists) {
      return { status: "not-found" };
    }
    const createdAt = new Date().toISOString();
    const info = this.db
      .prepare("INSERT INTO tasks (text, done, createdAt, parentId, listId) VALUES (?, 0, ?, NULL, ?)")
      .run(trimmed, createdAt, listId);
    return {
      status: "ok",
      value: { id: Number(info.lastInsertRowid), text: trimmed, done: false, parentId: null, priority: false, listId, createdAt },
    };
  }

  private getTask(id: number): TaskRow | undefined {
    return this.db.prepare(`SELECT ${TASK_COLUMNS} FROM tasks WHERE id = ?`).get(id) as unknown as TaskRow | undefined;
  }

  // A parent can't be completed while sub-items are open; reopening a sub-item reopens its parent.
  toggleTask(id: number): MutationResult<Task> {
    const row = this.getTask(id);
    if (!row) {
      return { status: "not-found" };
    }

    const nextDone = !row.done;
    if (nextDone && row.parentId === null) {
      const { count } = this.db
        .prepare("SELECT COUNT(*) AS count FROM tasks WHERE parentId = ? AND done = 0")
        .get(id) as unknown as { count: number };
      if (count > 0) {
        return { status: "blocked", reason: "Complete all sub-items before completing this item." };
      }
    }

    this.db.prepare("UPDATE tasks SET done = ? WHERE id = ?").run(nextDone ? 1 : 0, id);
    // Tasks on the CLI's board keep their column in step with the checkbox.
    const status = this.db.prepare("SELECT status FROM tasks WHERE id = ?").get(id) as unknown as { status: string | null };
    if (status.status !== null) {
      if (nextDone) {
        this.db.prepare("UPDATE tasks SET status = 'done' WHERE id = ?").run(id);
      } else if (status.status === "done") {
        this.db.prepare("UPDATE tasks SET status = 'todo' WHERE id = ?").run(id);
      }
    }
    if (!nextDone && row.parentId !== null) {
      this.db.prepare("UPDATE tasks SET done = 0 WHERE id = ? AND done = 1").run(row.parentId);
    }
    return { status: "ok", value: rowToTask(this.getTask(id)!) };
  }

  removeTask(id: number): MutationResult<Task> {
    const row = this.getTask(id);
    if (!row) {
      return { status: "not-found" };
    }

    if (row.parentId === null) {
      const { count } = this.db
        .prepare("SELECT COUNT(*) AS count FROM tasks WHERE parentId = ?")
        .get(id) as unknown as { count: number };
      if (count > 0) {
        return { status: "blocked", reason: "Delete all sub-items first." };
      }
    }

    this.db.prepare("DELETE FROM tasks WHERE id = ?").run(id);
    return { status: "ok", value: rowToTask(row) };
  }
}
