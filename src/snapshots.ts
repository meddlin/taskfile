import { getDb, loadLists, loadTasks, type Task } from "./store.js";
import type { Settings, SnapshotRetention } from "./settings.js";

export interface SnapshotSummary {
  id: number;
  date: string;
}

export interface SnapshotDetail {
  id: number;
  date: string;
  lists: { name: string; tasks: Task[] }[];
}

interface SnapshotRow {
  id: number;
  date: string;
}

interface SnapshotListRow {
  id: number;
  name: string;
}

interface SnapshotTaskRow {
  id: number;
  snapshotListId: number;
  text: string;
  done: number;
  priority: number;
  parentSnapshotTaskId: number | null;
  createdAt: string;
}

const RETENTION_DAYS: Record<Exclude<SnapshotRetention, "forever">, number> = {
  "1-week": 7,
  "1-month": 30,
  "3-months": 90,
  "6-months": 180,
  "12-months": 365,
};

function localDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function captureSnapshot(date: string): void {
  const db = getDb();
  const createdAt = new Date().toISOString();
  const snapshotInfo = db.prepare("INSERT INTO snapshots (date, createdAt) VALUES (?, ?)").run(date, createdAt);
  const snapshotId = Number(snapshotInfo.lastInsertRowid);

  const lists = loadLists();
  lists.forEach((list, listOrderIndex) => {
    const listInfo = db
      .prepare("INSERT INTO snapshot_lists (snapshotId, name, createdAt, orderIndex) VALUES (?, ?, ?, ?)")
      .run(snapshotId, list.name, list.createdAt, listOrderIndex);
    const snapshotListId = Number(listInfo.lastInsertRowid);

    const originalToSnapshotTaskId = new Map<number, number>();
    loadTasks(list.id).forEach((task, taskOrderIndex) => {
      const parentSnapshotTaskId = task.parentId === null ? null : (originalToSnapshotTaskId.get(task.parentId) ?? null);
      const taskInfo = db
        .prepare(
          `INSERT INTO snapshot_tasks
             (snapshotListId, text, done, priority, parentSnapshotTaskId, createdAt, orderIndex)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          snapshotListId,
          task.text,
          task.done ? 1 : 0,
          task.priority ? 1 : 0,
          parentSnapshotTaskId,
          task.createdAt,
          taskOrderIndex,
        );
      originalToSnapshotTaskId.set(task.id, Number(taskInfo.lastInsertRowid));
    });
  });
}

export function captureSnapshotIfNeeded(settings: Settings): void {
  if (!settings.dailySnapshotsEnabled) return;

  const today = localDateString(new Date());
  const existing = getDb().prepare("SELECT id FROM snapshots WHERE date = ?").get(today);
  if (existing) return;

  captureSnapshot(today);
}

export function pruneSnapshots(retention: SnapshotRetention): void {
  if (retention === "forever") return;

  const cutoff = localDateString(new Date(Date.now() - RETENTION_DAYS[retention] * 24 * 60 * 60 * 1000));
  const db = getDb();

  db.prepare(
    `DELETE FROM snapshot_tasks WHERE snapshotListId IN (
       SELECT id FROM snapshot_lists WHERE snapshotId IN (SELECT id FROM snapshots WHERE date < ?)
     )`,
  ).run(cutoff);
  db.prepare("DELETE FROM snapshot_lists WHERE snapshotId IN (SELECT id FROM snapshots WHERE date < ?)").run(cutoff);
  db.prepare("DELETE FROM snapshots WHERE date < ?").run(cutoff);
}

export function runStartupSnapshotMaintenance(settings: Settings): void {
  pruneSnapshots(settings.dailySnapshotRetention);
  captureSnapshotIfNeeded(settings);
}

export function listSnapshots(): SnapshotSummary[] {
  const rows = getDb().prepare("SELECT id, date FROM snapshots ORDER BY date DESC").all() as unknown as SnapshotRow[];
  return rows.map((row) => ({ id: row.id, date: row.date }));
}

export function loadSnapshotDetail(id: number): SnapshotDetail | undefined {
  const db = getDb();
  const snapshot = db.prepare("SELECT id, date FROM snapshots WHERE id = ?").get(id) as unknown as
    | SnapshotRow
    | undefined;
  if (!snapshot) return undefined;

  const listRows = db
    .prepare("SELECT id, name FROM snapshot_lists WHERE snapshotId = ? ORDER BY orderIndex")
    .all(id) as unknown as SnapshotListRow[];

  const lists = listRows.map((listRow) => {
    const taskRows = db
      .prepare(
        `SELECT id, snapshotListId, text, done, priority, parentSnapshotTaskId, createdAt
         FROM snapshot_tasks WHERE snapshotListId = ? ORDER BY orderIndex`,
      )
      .all(listRow.id) as unknown as SnapshotTaskRow[];

    const tasks: Task[] = taskRows.map((row) => ({
      id: row.id,
      text: row.text,
      done: !!row.done,
      parentId: row.parentSnapshotTaskId,
      priority: !!row.priority,
      listId: row.snapshotListId,
      createdAt: row.createdAt,
    }));

    return { name: listRow.name, tasks };
  });

  return { id: snapshot.id, date: snapshot.date, lists };
}

export function deleteSnapshot(id: number): void {
  const db = getDb();
  db.prepare(
    `DELETE FROM snapshot_tasks WHERE snapshotListId IN (SELECT id FROM snapshot_lists WHERE snapshotId = ?)`,
  ).run(id);
  db.prepare("DELETE FROM snapshot_lists WHERE snapshotId = ?").run(id);
  db.prepare("DELETE FROM snapshots WHERE id = ?").run(id);
}
