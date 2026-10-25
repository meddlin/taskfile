import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { addTask, createList, getDefaultListId, loadTasks, removeTask, renameList, toggleTask } from "./store.js";
import type { Settings } from "./settings.js";
import {
  captureSnapshot,
  captureSnapshotIfNeeded,
  deleteSnapshot,
  listSnapshots,
  loadSnapshotDetail,
  pruneSnapshots,
} from "./snapshots.js";

function makeSettings(overrides: Partial<Settings> = {}): Settings {
  return {
    width: 120,
    height: 40,
    progressAnimation: true,
    lastActiveListId: null,
    dailySnapshotsEnabled: true,
    dailySnapshotRetention: "12-months",
    ...overrides,
  };
}

describe("snapshots", () => {
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

  it("captureSnapshotIfNeeded creates one snapshot on first call", () => {
    addTask(listId, "Buy milk");

    captureSnapshotIfNeeded(makeSettings());

    expect(listSnapshots()).toHaveLength(1);
  });

  it("captureSnapshotIfNeeded is idempotent for repeated calls the same day", () => {
    addTask(listId, "Buy milk");

    captureSnapshotIfNeeded(makeSettings());
    captureSnapshotIfNeeded(makeSettings());

    expect(listSnapshots()).toHaveLength(1);
  });

  it("captureSnapshotIfNeeded is a no-op when daily snapshots are disabled", () => {
    addTask(listId, "Buy milk");

    captureSnapshotIfNeeded(makeSettings({ dailySnapshotsEnabled: false }));

    expect(listSnapshots()).toHaveLength(0);
  });

  it("captured snapshots are independent of later changes to the live data", () => {
    addTask(listId, "Buy milk");
    captureSnapshot("2026-08-20");

    renameList(listId, "Groceries");
    toggleTask(1);
    removeTask(1);

    const [summary] = listSnapshots();
    const detail = loadSnapshotDetail(summary!.id)!;

    expect(detail.lists).toEqual([{ name: "Todos", tasks: expect.arrayContaining([expect.objectContaining({ text: "Buy milk", done: false })]) }]);
  });

  it("preserves sub-item structure, remapping parentId to the copied row's own id", () => {
    addTask(listId, "Main"); // live id 1
    addTask(listId, "Sub", 1); // live id 2, parentId 1

    captureSnapshot("2026-08-01"); // advances the snapshot_tasks id sequence ahead of the live tasks table
    captureSnapshot("2026-08-20");

    const detail = loadSnapshotDetail(listSnapshots().find((s) => s.date === "2026-08-20")!.id)!;
    const main = detail.lists[0]!.tasks.find((t) => t.text === "Main")!;
    const sub = detail.lists[0]!.tasks.find((t) => t.text === "Sub")!;

    expect(main.parentId).toBeNull();
    expect(sub.parentId).toBe(main.id); // a self-consistent reference to the copied row within this snapshot
    expect(sub.parentId).not.toBe(1); // not the live task's id (1), proving it was remapped rather than copied verbatim
  });

  it("captures multiple lists", () => {
    const second = createList("Work");
    addTask(listId, "Personal task");
    addTask(second.id, "Work task");

    captureSnapshot("2026-08-20");

    const [summary] = listSnapshots();
    const detail = loadSnapshotDetail(summary!.id)!;

    expect(detail.lists.map((l) => l.name)).toEqual(["Todos", "Work"]);
    expect(detail.lists[0]!.tasks[0]!.text).toBe("Personal task");
    expect(detail.lists[1]!.tasks[0]!.text).toBe("Work task");
  });

  it("listSnapshots orders most-recent first", () => {
    captureSnapshot("2026-08-01");
    captureSnapshot("2026-08-20");
    captureSnapshot("2026-08-10");

    expect(listSnapshots().map((s) => s.date)).toEqual(["2026-08-20", "2026-08-10", "2026-08-01"]);
  });

  it("loadSnapshotDetail returns undefined for an unknown id", () => {
    expect(loadSnapshotDetail(999)).toBeUndefined();
  });

  it("deleteSnapshot removes the snapshot and its lists/tasks", () => {
    addTask(listId, "Buy milk");
    captureSnapshot("2026-08-20");
    const [summary] = listSnapshots();

    deleteSnapshot(summary!.id);

    expect(listSnapshots()).toHaveLength(0);
    expect(loadSnapshotDetail(summary!.id)).toBeUndefined();
  });

  it("pruneSnapshots does nothing when retention is forever", () => {
    captureSnapshot("2000-01-01");

    pruneSnapshots("forever");

    expect(listSnapshots()).toHaveLength(1);
  });

  it("pruneSnapshots removes snapshots older than the cutoff and keeps newer ones", () => {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    captureSnapshot("2000-01-01");
    captureSnapshot(today);

    pruneSnapshots("1-week");

    expect(listSnapshots().map((s) => s.date)).toEqual([today]);
  });
});
