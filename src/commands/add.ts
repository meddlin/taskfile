import { addTask } from "../store.js";

export function addItem(text: string): void {
  const task = addTask(text);
  console.log(`Added task #${task.id}: ${task.text}`);
}
