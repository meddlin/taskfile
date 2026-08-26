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
  listId: number;
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

export interface List {
  id: number;
  name: string;
  createdAt: string;
}

interface ListRow {
  id: number;
  name: string;
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

export type ListUpdateResult =
  | { status: "ok"; list: List }
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
    listId: row.listId,
    createdAt: row.createdAt,
  };
}

function rowToList(row: ListRow): List {
  return { id: row.id, name: row.name, createdAt: row.createdAt };
}

function ensureSchema(database: DatabaseSync): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS lists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      createdAt TEXT NOT NULL
    )
  `);

  database.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      text TEXT NOT NULL,
      done INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL,
      parentId INTEGER REFERENCES tasks(id),
      priority INTEGER NOT NULL DEFAULT 0,
      listId INTEGER REFERENCES lists(id)
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

  const hasListId = columns.some((column) => column.name === "listId");
  if (!hasListId) {
    database.exec("ALTER TABLE tasks ADD COLUMN listId INTEGER REFERENCES lists(id)");
  }

  const { count } = database.prepare("SELECT COUNT(*) AS count FROM lists").get() as unknown as { count: number };
  let defaultListId: number;
  if (count === 0) {
    const createdAt = new Date().toISOString();
    const info = database.prepare("INSERT INTO lists (name, createdAt) VALUES (?, ?)").run("Todos", createdAt);
    defaultListId = Number(info.lastInsertRowid);
  } else {
    const first = database.prepare("SELECT id FROM lists ORDER BY id LIMIT 1").get() as unknown as { id: number };
    defaultListId = first.id;
  }

  database.prepare("UPDATE tasks SET listId = ? WHERE listId IS NULL").run(defaultListId);
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

export function loadTasks(listId: number): Task[] {
  const rows = getDb()
    .prepare(
      `SELECT id, text, done, parentId, priority, listId, createdAt FROM tasks
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

export function addTask(listId: number, text: string, parentId: number | null = null): Task {
  const createdAt = new Date().toISOString();
  const info = getDb()
    .prepare("INSERT INTO tasks (text, done, createdAt, parentId, listId) VALUES (?, 0, ?, ?, ?)")
    .run(text, createdAt, parentId, listId);
  return { id: Number(info.lastInsertRowid), text, done: false, parentId, priority: false, listId, createdAt };
}

export function loadLists(): List[] {
  const rows = getDb().prepare("SELECT id, name, createdAt FROM lists ORDER BY id").all() as unknown as ListRow[];
  return rows.map(rowToList);
}

export function createList(name: string): List {
  const trimmed = name.trim();
  const createdAt = new Date().toISOString();
  const info = getDb().prepare("INSERT INTO lists (name, createdAt) VALUES (?, ?)").run(trimmed, createdAt);
  return { id: Number(info.lastInsertRowid), name: trimmed, createdAt };
}

export function renameList(id: number, name: string): ListUpdateResult {
  const row = getDb().prepare("SELECT id, name, createdAt FROM lists WHERE id = ?").get(id) as unknown as
    | ListRow
    | undefined;

  if (!row) {
    return { status: "not-found" };
  }

  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return { status: "blocked", reason: "List name cannot be empty." };
  }

  getDb().prepare("UPDATE lists SET name = ? WHERE id = ?").run(trimmed, id);

  return { status: "ok", list: { ...rowToList(row), name: trimmed } };
}

export function getDefaultListId(): number {
  return loadLists()[0]!.id;
}

export function removeTask(id: number): RemoveResult {
  const row = getDb()
    .prepare("SELECT id, text, done, parentId, priority, listId, createdAt FROM tasks WHERE id = ?")
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
    .prepare("SELECT id, text, done, parentId, priority, listId, createdAt FROM tasks WHERE id = ?")
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
    .prepare("SELECT id, text, done, parentId, priority, listId, createdAt FROM tasks WHERE id = ?")
    .get(id) as unknown as TaskRow;
  return { status: "ok", task: rowToTask(updated) };
}

export function updateTask(id: number, text: string): UpdateResult {
  const row = getDb()
    .prepare("SELECT id, text, done, parentId, priority, listId, createdAt FROM tasks WHERE id = ?")
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

// Counts all tasks flat, ignoring parentId (main items and sub-items count equally).
export function computeProgress(tasks: Task[]): { done: number; total: number; percent: number } {
  const total = tasks.length;
  const done = tasks.filter((task) => task.done).length;
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  return { done, total, percent };
}

export function hasSubItems(id: number): boolean {
  const { count } = getDb()
    .prepare("SELECT COUNT(*) AS count FROM tasks WHERE parentId = ?")
    .get(id) as unknown as { count: number };
  return count > 0;
}

export function setPriority(id: number, priority: boolean): UpdateResult {
  const row = getDb()
    .prepare("SELECT id, text, done, parentId, priority, listId, createdAt FROM tasks WHERE id = ?")
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
    .prepare("SELECT id, text, done, parentId, priority, listId, createdAt FROM tasks WHERE id = ?")
    .get(id) as unknown as TaskRow;
  return { status: "ok", task: rowToTask(updated) };
}
