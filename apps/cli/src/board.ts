import type { Task } from "./store.js";

export const TASK_STATUSES = ["backlog", "todo", "in-progress", "done"] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];

export const STATUS_LABELS: Record<TaskStatus, string> = {
  backlog: "Backlog",
  todo: "To-do",
  "in-progress": "In progress",
  done: "Done",
};

// Parses user input such as "to-do", "In Progress" or "none". Returns undefined for anything
// unrecognised and null for "none"/"off" (take the task off the board).
export function parseStatus(input: string): TaskStatus | null | undefined {
  const normalized = input.trim().toLowerCase().replace(/[\s_]+/g, "-");
  if (normalized === "none" || normalized === "off") return null;
  if (normalized === "to-do") return "todo";
  if (normalized === "inprogress") return "in-progress";
  return TASK_STATUSES.find((status) => status === normalized);
}

export function groupByStatus(tasks: Task[]): Record<TaskStatus, Task[]> {
  const columns: Record<TaskStatus, Task[]> = { backlog: [], todo: [], "in-progress": [], done: [] };
  for (const task of tasks) {
    if (task.status !== null) columns[task.status].push(task);
  }
  return columns;
}

// Next status in board order; stepping past either end takes the task off the board when
// `wrap` is set (used by the list view's cycle key), otherwise it stays at the end.
export function stepStatus(current: TaskStatus | null, delta: 1 | -1, wrap: boolean): TaskStatus | null {
  if (current === null) return delta === 1 ? TASK_STATUSES[0] : null;
  const next = TASK_STATUSES.indexOf(current) + delta;
  if (next < 0 || next >= TASK_STATUSES.length) return wrap ? null : current;
  return TASK_STATUSES[next]!;
}
