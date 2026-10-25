import { createServerFn } from "@tanstack/react-start";
import type { TaskStatus } from "./board";
import type { List, Task } from "./store";

// Handlers import the store lazily so node:sqlite never reaches the client bundle.
async function store() {
  return (await import("./db")).getStore();
}

export interface Board {
  lists: List[];
  activeListId: number;
  tasks: Task[];
}

export const getBoard = createServerFn({ method: "GET" })
  .validator((data: { listId?: number }) => data)
  .handler(async ({ data }): Promise<Board> => {
    const s = await store();
    const lists = s.loadLists();
    const active = lists.find((l) => l.id === data.listId) ?? lists[0]!;
    return { lists, activeListId: active.id, tasks: s.loadTasks(active.id) };
  });

// Mutations return a message on failure rather than throwing, so the UI can show it inline.
export interface ActionResult {
  error?: string;
  id?: number;
}

function toResult(r: { status: string; reason?: string; value?: { id: number } }): ActionResult {
  if (r.status === "ok") return { id: r.value?.id };
  if (r.status === "blocked") return { error: r.reason };
  return { error: "Not found." };
}

export const addTask = createServerFn({ method: "POST" })
  .validator((data: { listId: number; text: string }) => data)
  .handler(async ({ data }): Promise<ActionResult> => toResult((await store()).addTask(data.listId, data.text)));

export const addSubTask = createServerFn({ method: "POST" })
  .validator((data: { parentId: number; text: string }) => data)
  .handler(async ({ data }): Promise<ActionResult> => toResult((await store()).addSubTask(data.parentId, data.text)));

export const toggleTask =createServerFn({ method: "POST" })
  .validator((data: { id: number }) => data)
  .handler(async ({ data }): Promise<ActionResult> => toResult((await store()).toggleTask(data.id)));

export const removeTask = createServerFn({ method: "POST" })
  .validator((data: { id: number }) => data)
  .handler(async ({ data }): Promise<ActionResult> => toResult((await store()).removeTask(data.id)));

export const createList = createServerFn({ method: "POST" })
  .validator((data: { name: string }) => data)
  .handler(async ({ data }): Promise<ActionResult> => toResult((await store()).createList(data.name)));

export interface StatusBoard {
  lists: List[];
  tasks: Task[];
}

export const getStatusBoard = createServerFn({ method: "GET" }).handler(async (): Promise<StatusBoard> => {
  const s = await store();
  return { lists: s.loadLists(), tasks: s.loadBoardTasks() };
});

export const setTaskStatus = createServerFn({ method: "POST" })
  .validator((data: { id: number; status: TaskStatus | null }) => data)
  .handler(async ({ data }): Promise<ActionResult> => toResult((await store()).setStatus(data.id, data.status)));

export const sendToBoard = createServerFn({ method: "POST" })
  .validator((data: { id: number }) => data)
  .handler(async ({ data }): Promise<ActionResult> => toResult((await store()).moveToBoard(data.id)));
