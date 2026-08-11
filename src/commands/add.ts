import { loadTasks, saveTasks, getNextId } from "../store";

export function addItem(text: string): void {
  const tasks = loadTasks();
  const task = {
    id: getNextId(tasks),
    text,
    done: false,
    createdAt: new Date().toISOString(),
  };
  tasks.push(task);
  saveTasks(tasks);
  console.log(`Added task #${task.id}: ${task.text}`);
}
