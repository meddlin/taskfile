import { removeTask } from "../store";

export function removeItem(id: number): void {
  const removed = removeTask(id);

  if (!removed) {
    console.error(`No task found with id #${id}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Removed task #${removed.id}: ${removed.text}`);
}
