import { useState, type FormEvent } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { ThemeToggle } from "~/components/theme-toggle";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { cn } from "~/lib/utils";
import { addTask, createList, getBoard, removeTask, toggleTask, type ActionResult } from "~/server/functions";

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): { list?: number } => {
    const list = Number(search.list);
    return Number.isInteger(list) && list > 0 ? { list } : {};
  },
  loaderDeps: ({ search }) => ({ list: search.list }),
  loader: ({ deps }) => getBoard({ data: { listId: deps.list } }),
  component: TasksPage,
});

function TasksPage() {
  const { lists, activeListId, tasks } = Route.useLoaderData();
  const navigate = Route.useNavigate();
  const router = useRouter();
  const [text, setText] = useState("");
  const [listName, setListName] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Runs a mutation, shows its error if any, and refreshes the loader data afterwards.
  async function run(action: Promise<ActionResult>): Promise<ActionResult> {
    const result = await action;
    setError(result.error ?? null);
    await router.invalidate();
    return result;
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
      await navigate({ search: { list: result.id } });
    }
  }

  const done = tasks.filter((t) => t.done).length;

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-4 p-4 sm:p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Taskfile</h1>
        <ThemeToggle />
      </div>

      <nav aria-label="Lists" className="flex flex-wrap items-center gap-2">
        {lists.map((list) => (
          <Button
            key={list.id}
            variant={list.id === activeListId ? "default" : "outline"}
            size="sm"
            onClick={() => navigate({ search: { list: list.id } })}
          >
            {list.name}
          </Button>
        ))}
        <form onSubmit={onAddList} className="flex gap-2">
          <Input
            aria-label="New list name"
            placeholder="New list"
            value={listName}
            onChange={(e) => setListName(e.target.value)}
            className="h-8 w-32"
          />
          <Button type="submit" size="sm" variant="secondary" disabled={listName.trim() === ""}>
            Add
          </Button>
        </form>
      </nav>

      <Card>
        <CardHeader>
          <CardTitle>
            {lists.find((l) => l.id === activeListId)?.name}
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {done}/{tasks.length} done
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <form onSubmit={onAddTask} className="flex gap-2">
            <Input
              aria-label="New task"
              placeholder="Add a task…"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <Button type="submit" disabled={text.trim() === ""}>
              <Plus /> Add
            </Button>
          </form>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          {tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing here yet.</p>
          ) : (
            <ul className="flex flex-col divide-y">
              {tasks.map((task) => (
                <li key={task.id} className={cn("flex items-center gap-3 py-2", task.parentId !== null && "pl-8")}>
                  <Checkbox
                    aria-label={`Mark "${task.text}" ${task.done ? "not done" : "done"}`}
                    checked={task.done}
                    onCheckedChange={() => run(toggleTask({ data: { id: task.id } }))}
                  />
                  <span className={cn("flex-1", task.done && "text-muted-foreground line-through")}>
                    {task.priority && <span aria-label="Priority">★ </span>}
                    {task.text}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Delete "${task.text}"`}
                    onClick={() => run(removeTask({ data: { id: task.id } }))}
                  >
                    <Trash2 />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
