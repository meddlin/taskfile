import { loadTasks } from "../store";

export function listItems(): void {
  const tasks = loadTasks();

  if (tasks.length === 0) {
    console.log("No tasks yet. Add one with `taskfile add <text>`.");
    return;
  }

  for (const task of tasks) {
    const marker = task.done ? "[x]" : "[ ]";
    console.log(`${marker} #${task.id} ${task.text}`);
  }
}
