import { startTransition, useEffect, useOptimistic, useState } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { PageNav } from "~/components/PageNav";
import { cn } from "~/lib/utils";
import { STATUS_LABELS, TASK_STATUSES, groupByStatus, stepStatus, type TaskStatus } from "~/server/board";
import { getStatusBoard, sendToBoard, setTaskStatus, type ActionResult } from "~/server/functions";
import type { Task } from "~/server/store";

export const Route = createFileRoute("/board")({
  loader: () => getStatusBoard(),
  component: BoardPage,
});

interface Change {
  id: number;
  status: TaskStatus | null;
}

// Applies a column move straight away; the done checkbox follows the done column like on the server.
function applyChange(tasks: Task[], { id, status }: Change): Task[] {
  if (status === null) return tasks.filter((t) => t.id !== id);
  return tasks.map((t) => (t.id === id ? { ...t, status, done: status === "done" } : t));
}

function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.tagName === "INPUT" || target.isContentEditable);
}

function BoardPage() {
  const { lists, tasks: serverTasks } = Route.useLoaderData();
  const router = useRouter();
  const [tasks, change] = useOptimistic(serverTasks, applyChange);
  const [error, setError] = useState<string | null>(null);
  const [col, setCol] = useState(0);
  const [row, setRow] = useState(0);
  // Drag and drop: the card being dragged and the column it is currently over.
  const [dragId, setDragId] = useState<number | null>(null);
  const [overStatus, setOverStatus] = useState<TaskStatus | null>(null);
  const [overRemove, setOverRemove] = useState(false);

  const columns = groupByStatus(tasks);
  const listName = (id: number) => lists.find((l) => l.id === id)?.name ?? "?";
  const column = columns[TASK_STATUSES[col]!];
  const cursor = Math.min(row, Math.max(column.length - 1, 0));
  const current = column[cursor];

  function move(task: Task, status: TaskStatus | null) {
    if (status === task.status) return;
    if (status !== null) {
      // Follow the card to its new column, landing where it sorts (columns are in creation order).
      const target = TASK_STATUSES.indexOf(status);
      setCol(target);
      setRow(columns[status].filter((t) => t.id < task.id).length);
    }
    startTransition(async () => {
      change({ id: task.id, status });
      const result: ActionResult = await setTaskStatus({ data: { id: task.id, status } });
      setError(result.error ?? null);
      await router.invalidate();
    });
  }

  // Keyboard layer, mirroring the TUI's board page: [ ] pick a column, , . move a card, r removes it.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      switch (e.key) {
        case "j":
        case "ArrowDown":
          setRow(Math.min(cursor + 1, column.length - 1));
          break;
        case "k":
        case "ArrowUp":
          setRow(Math.max(cursor - 1, 0));
          break;
        case "[":
        case "h":
        case "ArrowLeft":
          setCol(Math.max(col - 1, 0));
          setRow(0);
          break;
        case "]":
        case "l":
        case "ArrowRight":
          setCol(Math.min(col + 1, TASK_STATUSES.length - 1));
          setRow(0);
          break;
        case ",":
          if (current) move(current, stepStatus(current.status, -1, false));
          break;
        case ".":
          if (current) move(current, stepStatus(current.status, 1, false));
          break;
        case "r":
          if (current) move(current, null);
          break;
        default:
          return;
      }
      e.preventDefault();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-5 px-4 py-6 sm:px-8 sm:py-10">
      <header className="flex items-baseline justify-between gap-4">
        <h1 className="font-bold">
          <span className="text-accent">$</span> taskfile board
          <span aria-hidden className="animate-blink ml-1 inline-block h-[1em] w-[0.6em] translate-y-[0.15em] bg-accent" />
        </h1>
        <PageNav />
      </header>

      {error && (
        <p role="alert" className="animate-fade-in text-destructive">
          error: {error}
        </p>
      )}

      {tasks.length === 0 && (
        <p className="text-muted-foreground">-- nothing on the board; press m on a task to send it here --</p>
      )}

      <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
        {TASK_STATUSES.map((status, c) => (
          <section
            key={status}
            aria-label={STATUS_LABELS[status]}
            onDragOver={(e) => {
              if (dragId === null) return;
              e.preventDefault(); // marks the column as a valid drop target
              e.dataTransfer.dropEffect = "move";
              setOverStatus(status);
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOverStatus(null);
            }}
            onDrop={(e) => {
              e.preventDefault();
              const dropped = tasks.find((t) => t.id === dragId);
              setDragId(null);
              setOverStatus(null);
              if (dropped) move(dropped, status);
            }}
            className={cn(
              "flex min-h-24 min-w-0 flex-col gap-1 transition-colors duration-150",
              overStatus === status && dragId !== null && "bg-highlight outline-1 outline-dashed outline-accent",
            )}
          >
            <h2
              className={cn(
                "flex justify-between border-b pb-1 transition-colors duration-150",
                c === col ? "border-accent text-accent" : "border-border text-muted-foreground",
              )}
            >
              <span>{STATUS_LABELS[status]}</span>
              <span>{columns[status].length}</span>
            </h2>
            <ul className="flex flex-col">
              {columns[status].map((task, r) => {
                const isSelected = c === col && r === cursor;
                return (
                  <li
                    key={task.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("text/plain", String(task.id));
                      setDragId(task.id);
                      setCol(c);
                      setRow(r);
                    }}
                    onDragEnd={() => {
                      setDragId(null);
                      setOverStatus(null);
                      setOverRemove(false);
                    }}
                    onClick={() => {
                      setCol(c);
                      setRow(r);
                    }}
                    className={cn(
                      "animate-row-in flex cursor-grab flex-col gap-0.5 px-1 py-1 transition-[background-color,opacity] duration-100 active:cursor-grabbing",
                      isSelected && "bg-highlight",
                      dragId === task.id && "opacity-40",
                    )}
                  >
                    <span className={cn("break-words", task.done && "text-muted-foreground line-through")}>
                      <span aria-hidden className={cn("mr-1 text-accent", !isSelected && "invisible")}>
                        &gt;
                      </span>
                      {task.priority && <span className="text-accent">★ </span>}
                      {task.text}
                    </span>
                    <span className="flex items-center justify-between pl-4 text-muted-foreground">
                      <span>{listName(task.listId)}</span>
                      <span className="flex gap-2">
                        <button
                          type="button"
                          aria-label={`Move "${task.text}" left`}
                          disabled={c === 0}
                          onClick={() => move(task, stepStatus(task.status, -1, false))}
                          className={cn(
                            "cursor-pointer transition-opacity duration-150 hover:text-accent disabled:cursor-default disabled:opacity-30",
                            !isSelected && "invisible",
                          )}
                        >
                          [&lt;]
                        </button>
                        <button
                          type="button"
                          aria-label={`Move "${task.text}" right`}
                          disabled={c === TASK_STATUSES.length - 1}
                          onClick={() => move(task, stepStatus(task.status, 1, false))}
                          className={cn(
                            "cursor-pointer transition-opacity duration-150 hover:text-accent disabled:cursor-default disabled:opacity-30",
                            !isSelected && "invisible",
                          )}
                        >
                          [&gt;]
                        </button>
                        <button
                          type="button"
                          aria-label={`Take "${task.text}" off the board`}
                          onClick={() => move(task, null)}
                          className="cursor-pointer hover:text-destructive"
                        >
                          [r]
                        </button>
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      {dragId !== null && (
        <div
          aria-label="Drop here to take off the board"
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            setOverRemove(true);
          }}
          onDragLeave={() => setOverRemove(false)}
          onDrop={(e) => {
            e.preventDefault();
            const dropped = tasks.find((t) => t.id === dragId);
            setDragId(null);
            setOverRemove(false);
            if (dropped) move(dropped, null);
          }}
          className={cn(
            "animate-fade-in border border-dashed py-3 text-center transition-colors duration-150",
            overRemove ? "border-destructive bg-highlight text-destructive" : "border-border text-muted-foreground",
          )}
        >
          drop here to take off the board
        </div>
      )}

      <footer className="mt-auto pt-6 text-muted-foreground">
        drag cards between columns or onto the remove bar · j/k move · [ ] column · , . move card · r remove
      </footer>
    </main>
  );
}
