import { addTask, getDefaultListId } from "../store.js";

export function addItem(text: string): void {
  const task = addTask(getDefaultListId(), text);
  console.log(`Added task #${task.id}: ${task.text}`);
}
