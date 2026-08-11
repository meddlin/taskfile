import { loadTasks, saveTasks } from "../store";

export function removeItem(id: number): void {
  const tasks = loadTasks();
  const index = tasks.findIndex((task) => task.id === id);

  if (index === -1) {
    console.error(`No task found with id #${id}`);
    process.exitCode = 1;
    return;
  }

  const [removed] = tasks.splice(index, 1);
  saveTasks(tasks);
  console.log(`Removed task #${removed.id}: ${removed.text}`);
}
