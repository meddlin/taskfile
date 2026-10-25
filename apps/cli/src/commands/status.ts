import { STATUS_LABELS, TASK_STATUSES, parseStatus } from "../board.js";
import { setStatus } from "../store.js";

export function setItemStatus(id: number, statusInput: string): void {
  const status = parseStatus(statusInput);

  if (status === undefined) {
    console.error(`Unknown status "${statusInput}". Use one of: ${TASK_STATUSES.join(", ")}, none.`);
    process.exitCode = 1;
    return;
  }

  const result = setStatus(id, status);

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

  if (status === null) {
    console.log(`Removed task #${result.task.id} from the board: ${result.task.text}`);
    return;
  }
  console.log(`Moved task #${result.task.id} to ${STATUS_LABELS[status]}: ${result.task.text}`);
}
