import { describe, expect, it } from "vitest";
import { groupByStatus, parseStatus, stepStatus } from "./board.js";
import type { Task } from "./store.js";

function makeTask(overrides: Partial<Task> = {}): Task {
  return { id: 1, text: "task", done: false, parentId: null, priority: false, listId: 1, status: null, createdAt: "", ...overrides };
}

describe("parseStatus", () => {
  it("accepts the spellings people actually type", () => {
    expect(parseStatus("backlog")).toBe("backlog");
    expect(parseStatus("to-do")).toBe("todo");
    expect(parseStatus("TODO")).toBe("todo");
    expect(parseStatus("In Progress")).toBe("in-progress");
    expect(parseStatus("in_progress")).toBe("in-progress");
    expect(parseStatus("done")).toBe("done");
  });

  it("maps none/off to null and rejects unknown input", () => {
    expect(parseStatus("none")).toBeNull();
    expect(parseStatus("off")).toBeNull();
    expect(parseStatus("blocked")).toBeUndefined();
  });
});

describe("groupByStatus", () => {
  it("buckets tasks by status and leaves off-board tasks out", () => {
    const columns = groupByStatus([
      makeTask({ id: 1, status: "backlog" }),
      makeTask({ id: 2, status: null }),
      makeTask({ id: 3, status: "done" }),
      makeTask({ id: 4, status: "backlog" }),
    ]);

    expect(columns.backlog.map((t) => t.id)).toEqual([1, 4]);
    expect(columns.done.map((t) => t.id)).toEqual([3]);
    expect(columns.todo).toEqual([]);
    expect(columns["in-progress"]).toEqual([]);
  });
});

describe("stepStatus", () => {
  it("moves along the board and stops at the ends when not wrapping", () => {
    expect(stepStatus("backlog", 1, false)).toBe("todo");
    expect(stepStatus("done", 1, false)).toBe("done");
    expect(stepStatus("backlog", -1, false)).toBe("backlog");
  });

  it("cycles off the board after done when wrapping", () => {
    expect(stepStatus(null, 1, true)).toBe("backlog");
    expect(stepStatus("done", 1, true)).toBeNull();
  });
});
