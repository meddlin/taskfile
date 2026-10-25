import { removeTask } from "../store.js";

export function removeItem(id: number): void {
  const result = removeTask(id);

  if (result.status === "not-found") {
    console.error(`No task found with id #${id}`);
    process.exitCode = 1;
    return;
  }

  if (result.status === "blocked") {
    console.error(result.reason);
    process.exitCode = 1;
    return;
  }

  console.log(`Removed task #${result.task.id}: ${result.task.text}`);
}
