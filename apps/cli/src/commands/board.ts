import { STATUS_LABELS, TASK_STATUSES, groupByStatus } from "../board.js";
import { loadBoardTasks } from "../store.js";

export function showBoard(): void {
  const tasks = loadBoardTasks();

  if (tasks.length === 0) {
    console.log("The board is empty. Put a task on it with `taskfile status <id> <status>`.");
    return;
  }

  const columns = groupByStatus(tasks);
  TASK_STATUSES.forEach((status, index) => {
    if (index > 0) console.log("");
    console.log(`${STATUS_LABELS[status].toUpperCase()} (${columns[status].length})`);
    for (const task of columns[status]) {
      console.log(`  #${task.id} ${task.text}`);
    }
  });
}
