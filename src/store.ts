import { DatabaseSync } from "node:sqlite";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

export interface Task {
  id: number;
  text: string;
  done: boolean;
  createdAt: string;
}

interface TaskRow {
  id: number;
  text: string;
  done: number;
  createdAt: string;
}

let db: DatabaseSync | undefined;
let dbPath: string | undefined;

function getStoreDir(): string {
  return path.join(os.homedir(), ".taskfile");
}

function getStoreFile(): string {
  return path.join(getStoreDir(), "tasks.db");
}

function rowToTask(row: TaskRow): Task {
  return { id: row.id, text: row.text, done: !!row.done, createdAt: row.createdAt };
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
  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      text TEXT NOT NULL,
      done INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL
    )
  `);
  dbPath = currentPath;

  return db;
}

export function loadTasks(): Task[] {
  const rows = getDb()
    .prepare("SELECT id, text, done, createdAt FROM tasks ORDER BY id")
    .all() as unknown as TaskRow[];
  return rows.map(rowToTask);
}

export function addTask(text: string): Task {
  const createdAt = new Date().toISOString();
  const info = getDb()
    .prepare("INSERT INTO tasks (text, done, createdAt) VALUES (?, 0, ?)")
    .run(text, createdAt);
  return { id: Number(info.lastInsertRowid), text, done: false, createdAt };
}

export function removeTask(id: number): Task | undefined {
  const row = getDb()
    .prepare("SELECT id, text, done, createdAt FROM tasks WHERE id = ?")
    .get(id) as unknown as TaskRow | undefined;

  if (!row) {
    return undefined;
  }

  getDb().prepare("DELETE FROM tasks WHERE id = ?").run(id);
  return rowToTask(row);
}
