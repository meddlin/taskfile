import { startTransition, useEffect, useOptimistic, useRef, useState, type FormEvent } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { PageNav } from "~/components/PageNav";
import { cn } from "~/lib/utils";
import { STATUS_LABELS, stepStatus } from "~/server/board";
import {
  addTask,
  createList,
  getBoard,
  removeTask,
  sendToBoard,
  setTaskStatus,
  toggleTask,
  type ActionResult,
} from "~/server/functions";
import type { Task } from "~/server/store";

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): { list?: number } => {
    const list = Number(search.list);
    return Number.isInteger(list) && list > 0 ? { list } : {};
  },
  loaderDeps: ({ search }) => ({ list: search.list }),
  loader: ({ deps }) => getBoard({ data: { listId: deps.list } }),
  component: TasksPage,
});

type Change = { type: "toggle"; id: number } | { type: "remove"; id: number } | { type: "board"; id: number };

// Applies a pending change straight away so the UI never waits on the server round trip.
function applyChange(tasks: Task[], change: Change): Task[] {
  if (change.type === "remove") return tasks.filter((t) => t.id !== change.id);
  if (change.type === "board") {
    return tasks.map((t) => (t.id === change.id && t.status === null ? { ...t, status: t.done ? "done" : "backlog" } : t));
  }
  return tasks.map((t) => {
    if (t.id !== change.id) return t;
    const done = !t.done;
    // A task on the board keeps its column in step with the checkbox.
    return { ...t, done, status: t.status === null ? null : done ? "done" : t.status === "done" ? "todo" : t.status };
  });
}

function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.tagName === "INPUT" || target.isContentEditable);
}

function TasksPage() {
  const { lists, activeListId, tasks: serverTasks } = Route.useLoaderData();
  const navigate = Route.useNavigate();
  const router = useRouter();
  const [tasks, change] = useOptimistic(serverTasks, applyChange);
  const [text, setText] = useState("");
  const [listName, setListName] = useState("");
  const [addingList, setAddingList] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState(0);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const taskInput = useRef<HTMLInputElement>(null);

  const cursor = Math.min(selected, Math.max(tasks.length - 1, 0));
  const activeList = lists.find((l) => l.id === activeListId);

  // Runs a mutation, shows its error if any, and refreshes the loader data afterwards.
  async function run(action: Promise<ActionResult>): Promise<ActionResult> {
    const result = await action;
    setError(result.error ?? null);
    await router.invalidate();
    return result;
  }

  function toggle(id: number) {
    startTransition(async () => {
      change({ type: "toggle", id });
      await run(toggleTask({ data: { id } }));
    });
  }

  function sendTaskToBoard(task: Task) {
    startTransition(async () => {
      change({ type: "board", id: task.id });
      await run(sendToBoard({ data: { id: task.id } }));
    });
  }

  // Steps a task through the board columns; past the last one it comes off the board again.
  function cycleStatus(task: Task) {
    startTransition(async () => {
      await run(setTaskStatus({ data: { id: task.id, status: stepStatus(task.status, 1, true) } }));
    });
  }

  function remove(id: number) {
    setConfirmId(null);
    startTransition(async () => {
      change({ type: "remove", id });
      await run(removeTask({ data: { id } }));
    });
  }

  async function onAddTask(e: FormEvent) {
    e.preventDefault();
    const result = await run(addTask({ data: { listId: activeListId, text } }));
    if (!result.error) setText("");
  }

  async function onAddList(e: FormEvent) {
    e.preventDefault();
    const result = await run(createList({ data: { name: listName } }));
    if (!result.error) {
      setListName("");
      setAddingList(false);
      await navigate({ search: { list: result.id } });
    }
  }

  // Keyboard layer, mirroring the CLI's TUI: j/k move, space toggles, d deletes (y/n), a adds.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTyping(e.target)) {
        if (e.key === "Escape") {
          (e.target as HTMLElement).blur();
          setAddingList(false);
        }
        return;
      }
      const current = tasks[cursor];
      if (confirmId !== null) {
        if (e.key === "y") remove(confirmId);
        else if (e.key === "n" || e.key === "Escape") setConfirmId(null);
        else return;
        e.preventDefault();
        return;
      }
      switch (e.key) {
        case "j":
        case "ArrowDown":
          setSelected(Math.min(cursor + 1, tasks.length - 1));
          break;
        case "k":
        case "ArrowUp":
          setSelected(Math.max(cursor - 1, 0));
          break;
        case " ":
        case "Enter":
          if (!current || (e.target as HTMLElement).tagName === "BUTTON") return;
          toggle(current.id);
          break;
        case "d":
        case "x":
          if (current) setConfirmId(current.id);
          break;
        case "m":
          if (current) sendTaskToBoard(current);
          break;
        case "t":
          if (current) cycleStatus(current);
          break;
        case "a":
        case "/":
          taskInput.current?.focus();
          break;
        case "[":
        case "]": {
          const i = lists.findIndex((l) => l.id === activeListId);
          const next = lists[(i + (e.key === "]" ? 1 : lists.length - 1)) % lists.length];
          if (next) navigate({ search: { list: next.id } });
          break;
        }
        default:
          return;
      }
      e.preventDefault();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const done = tasks.filter((t) => t.done).length;

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-5 px-4 py-6 sm:px-8 sm:py-10">
      <header className="flex items-baseline justify-between gap-4">
        <h1 className="font-bold">
          <span className="text-accent">$</span> taskfile
          <span aria-hidden className="animate-blink ml-1 inline-block h-[1em] w-[0.6em] translate-y-[0.15em] bg-accent" />
        </h1>
        <div className="flex items-baseline gap-4">
          <span className="text-muted-foreground">
            {done}/{tasks.length} done
          </span>
          <PageNav />
        </div>
      </header>

      <nav aria-label="Lists" className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {lists.map((list) => (
          <button
            key={list.id}
            type="button"
            aria-current={list.id === activeListId ? "page" : undefined}
            onClick={() => navigate({ search: { list: list.id } })}
            className={cn(
              "cursor-pointer border-b border-transparent py-0.5 transition-colors duration-150 hover:text-foreground",
              list.id === activeListId ? "border-accent text-accent" : "text-muted-foreground",
            )}
          >
            {list.name}
          </button>
        ))}
        {addingList ? (
          <form onSubmit={onAddList} className="animate-fade-in flex items-center gap-2">
            <span className="text-accent">+</span>
            <input
              autoFocus
              aria-label="New list name"
              placeholder="list name"
              value={listName}
              onChange={(e) => setListName(e.target.value)}
              onBlur={() => listName === "" && setAddingList(false)}
              className="w-32 bg-transparent outline-none placeholder:text-muted-foreground"
            />
          </form>
        ) : (
          <button
            type="button"
            aria-label="New list"
            onClick={() => setAddingList(true)}
            className="cursor-pointer text-muted-foreground transition-colors duration-150 hover:text-accent"
          >
            [+]
          </button>
        )}
      </nav>

      <form onSubmit={onAddTask} className="flex items-center gap-2 border-y border-border py-2">
        <span aria-hidden className="text-accent">
          &gt;
        </span>
        <input
          ref={taskInput}
          aria-label="New task"
          placeholder={`add to ${activeList?.name ?? "list"}…`}
          autoComplete="off"
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="min-w-0 flex-1 bg-transparent caret-accent outline-none placeholder:text-muted-foreground"
        />
        <kbd className="hidden text-muted-foreground sm:inline">{text.trim() ? "↵ add" : "a"}</kbd>
      </form>

      {error && (
        <p role="alert" className="animate-fade-in text-destructive">
          error: {error}
        </p>
      )}

      {tasks.length === 0 ? (
        <p className="text-muted-foreground">-- nothing here yet --</p>
      ) : (
        <ul className="flex flex-col">
          {tasks.map((task, i) => {
            const isSelected = i === cursor;
            return (
              <li
                key={task.id}
                onMouseEnter={() => setSelected(i)}
                className={cn(
                  "animate-row-in flex items-center gap-2 px-1 py-1 transition-colors duration-100",
                  isSelected && "bg-highlight",
                  task.parentId !== null && "pl-7",
                )}
              >
                <span aria-hidden className={cn("w-3 text-accent", !isSelected && "invisible")}>
                  &gt;
                </span>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={task.done}
                  aria-label={`Mark "${task.text}" ${task.done ? "not done" : "done"}`}
                  onClick={() => toggle(task.id)}
                  className="cursor-pointer"
                >
                  {/* Keyed on state so each flip replays the small pop. */}
                  <span key={String(task.done)} className={cn("inline-block", task.done ? "animate-pop text-accent" : "text-muted-foreground")}>
                    {task.done ? "[x]" : "[ ]"}
                  </span>
                </button>
                <span
                  className={cn(
                    "flex-1 break-words transition-colors duration-200",
                    task.done && "text-muted-foreground line-through",
                  )}
                >
                  {task.priority && (
                    <span aria-label="Priority" className="text-accent">
                      ★{" "}
                    </span>
                  )}
                  {task.text}
                </span>
                {task.status !== null && (
                  <button
                    type="button"
                    aria-label={`Status of "${task.text}": ${STATUS_LABELS[task.status]}. Cycle status`}
                    onClick={() => cycleStatus(task)}
                    className="animate-fade-in cursor-pointer text-accent transition-opacity duration-150 hover:opacity-70"
                  >
                    [{task.status}]
                  </button>
                )}
                {task.status === null && (
                  <button
                    type="button"
                    aria-label={`Send "${task.text}" to the board`}
                    onClick={() => sendTaskToBoard(task)}
                    className={cn(
                      "cursor-pointer text-muted-foreground transition-opacity duration-150 hover:text-accent focus-visible:opacity-100",
                      !isSelected && "opacity-0",
                    )}
                  >
                    [m]
                  </button>
                )}
                {confirmId === task.id ? (
                  <span className="animate-fade-in flex items-center gap-2 text-destructive">
                    delete?
                    <button type="button" onClick={() => remove(task.id)} className="cursor-pointer underline">
                      y
                    </button>
                    <button type="button" onClick={() => setConfirmId(null)} className="cursor-pointer underline">
                      n
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    aria-label={`Delete "${task.text}"`}
                    onClick={() => setConfirmId(task.id)}
                    className={cn(
                      "cursor-pointer text-muted-foreground transition-opacity duration-150 hover:text-destructive focus-visible:opacity-100",
                      !isSelected && "opacity-0",
                    )}
                  >
                    [d]
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <footer className="mt-auto pt-6 text-muted-foreground">
        j/k move · space toggle · d delete · m board · t status · a add · [ ] switch list
      </footer>
    </main>
  );
}
