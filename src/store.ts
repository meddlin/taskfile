import { DatabaseSync } from "node:sqlite";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

export interface Task {
  id: number;
  text: string;
  done: boolean;
  parentId: number | null;
  priority: boolean;
  createdAt: string;
}

interface TaskRow {
  id: number;
  text: string;
  done: number;
  parentId: number | null;
  priority: number;
  createdAt: string;
}

export type ToggleResult =
  | { status: "ok"; task: Task }
  | { status: "not-found" }
  | { status: "blocked"; reason: string };

export type RemoveResult =
  | { status: "ok"; task: Task }
  | { status: "not-found" }
  | { status: "blocked"; reason: string };

export type UpdateResult =
  | { status: "ok"; task: Task }
  | { status: "not-found" }
  | { status: "blocked"; reason: string };

let db: DatabaseSync | undefined;
let dbPath: string | undefined;

function getStoreDir(): string {
  return path.join(os.homedir(), ".taskfile");
}

function getStoreFile(): string {
  return path.join(getStoreDir(), "tasks.db");
}

function rowToTask(row: TaskRow): Task {
  return {
    id: row.id,
    text: row.text,
    done: !!row.done,
    parentId: row.parentId,
    priority: !!row.priority,
    createdAt: row.createdAt,
  };
}

function ensureSchema(database: DatabaseSync): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      text TEXT NOT NULL,
      done INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL,
      parentId INTEGER REFERENCES tasks(id),
      priority INTEGER NOT NULL DEFAULT 0
    )
  `);

  const columns = database.prepare("PRAGMA table_info(tasks)").all() as unknown as { name: string }[];
  const hasParentId = columns.some((column) => column.name === "parentId");
  if (!hasParentId) {
    database.exec("ALTER TABLE tasks ADD COLUMN parentId INTEGER REFERENCES tasks(id)");
  }

  const hasPriority = columns.some((column) => column.name === "priority");
  if (!hasPriority) {
    database.exec("ALTER TABLE tasks ADD COLUMN priority INTEGER NOT NULL DEFAULT 0");
  }
}

function getDb(): DatabaseSync {
  const currentPath = getStoreFile();

  if (db && dbPath === currentPath) {
    return db;
  }

  if (db) {
    db.close();
  }

  const storeDir = getStoreDir();
  if (!fs.existsSync(storeDir)) {
    fs.mkdirSync(storeDir, { recursive: true });
  }

  db = new DatabaseSync(currentPath);
  ensureSchema(db);
  dbPath = currentPath;

  return db;
}

export function loadTasks(): Task[] {
  const rows = getDb()
    .prepare(
      `SELECT id, text, done, parentId, priority, createdAt FROM tasks
       ORDER BY
         (SELECT priority FROM tasks p WHERE p.id = COALESCE(tasks.parentId, tasks.id)) DESC,
         COALESCE(parentId, id),
         parentId IS NOT NULL,
         priority DESC,
         id`,
    )
    .all() as unknown as TaskRow[];
  return rows.map(rowToTask);
}

export function addTask(text: string, parentId: number | null = null): Task {
  const createdAt = new Date().toISOString();
  const info = getDb()
    .prepare("INSERT INTO tasks (text, done, createdAt, parentId) VALUES (?, 0, ?, ?)")
    .run(text, createdAt, parentId);
  return { id: Number(info.lastInsertRowid), text, done: false, parentId, priority: false, createdAt };
}

export function removeTask(id: number): RemoveResult {
  const row = getDb()
    .prepare("SELECT id, text, done, parentId, priority, createdAt FROM tasks WHERE id = ?")
    .get(id) as unknown as TaskRow | undefined;

  if (!row) {
    return { status: "not-found" };
  }

  if (row.parentId === null) {
    const { count } = getDb()
      .prepare("SELECT COUNT(*) AS count FROM tasks WHERE parentId = ?")
      .get(id) as unknown as { count: number };
    if (count > 0) {
      return { status: "blocked", reason: "Delete all sub-items first." };
    }
  }

  getDb().prepare("DELETE FROM tasks WHERE id = ?").run(id);
  return { status: "ok", task: rowToTask(row) };
}

export function toggleTask(id: number): ToggleResult {
  const row = getDb()
    .prepare("SELECT id, text, done, parentId, priority, createdAt FROM tasks WHERE id = ?")
    .get(id) as unknown as TaskRow | undefined;

  if (!row) {
    return { status: "not-found" };
  }

  const nextDone = !row.done;

  if (nextDone && row.parentId === null) {
    const { count } = getDb()
      .prepare("SELECT COUNT(*) AS count FROM tasks WHERE parentId = ? AND done = 0")
      .get(id) as unknown as { count: number };
    if (count > 0) {
      return { status: "blocked", reason: "Complete all sub-items before completing this item." };
    }
  }

  getDb()
    .prepare("UPDATE tasks SET done = ? WHERE id = ?")
    .run(nextDone ? 1 : 0, id);

  if (!nextDone && row.parentId !== null) {
    getDb().prepare("UPDATE tasks SET done = 0 WHERE id = ? AND done = 1").run(row.parentId);
  }

  const updated = getDb()
    .prepare("SELECT id, text, done, parentId, priority, createdAt FROM tasks WHERE id = ?")
    .get(id) as unknown as TaskRow;
  return { status: "ok", task: rowToTask(updated) };
}

export function updateTask(id: number, text: string): UpdateResult {
  const row = getDb()
    .prepare("SELECT id, text, done, parentId, priority, createdAt FROM tasks WHERE id = ?")
    .get(id) as unknown as TaskRow | undefined;

  if (!row) {
    return { status: "not-found" };
  }

  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return { status: "blocked", reason: "Task text cannot be empty." };
  }

  getDb().prepare("UPDATE tasks SET text = ? WHERE id = ?").run(trimmed, id);

  return { status: "ok", task: { ...rowToTask(row), text: trimmed } };
}

export function hasSubItems(id: number): boolean {
  const { count } = getDb()
    .prepare("SELECT COUNT(*) AS count FROM tasks WHERE parentId = ?")
    .get(id) as unknown as { count: number };
  return count > 0;
}

export function setPriority(id: number, priority: boolean): UpdateResult {
  const row = getDb()
    .prepare("SELECT id, text, done, parentId, priority, createdAt FROM tasks WHERE id = ?")
    .get(id) as unknown as TaskRow | undefined;

  if (!row) {
    return { status: "not-found" };
  }

  getDb()
    .prepare("UPDATE tasks SET priority = ? WHERE id = ?")
    .run(priority ? 1 : 0, id);

  if (row.parentId === null) {
    getDb()
      .prepare("UPDATE tasks SET priority = ? WHERE parentId = ?")
      .run(priority ? 1 : 0, id);
  }

  const updated = getDb()
    .prepare("SELECT id, text, done, parentId, priority, createdAt FROM tasks WHERE id = ?")
    .get(id) as unknown as TaskRow;
  return { status: "ok", task: rowToTask(updated) };
}
