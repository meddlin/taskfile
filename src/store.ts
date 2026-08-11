import * as fs from "fs";
import * as os from "os";
import * as path from "path";

export interface Task {
  id: number;
  text: string;
  done: boolean;
  createdAt: string;
}

function getStoreDir(): string {
  return path.join(os.homedir(), ".taskfile");
}

function getStoreFile(): string {
  return path.join(getStoreDir(), "tasks.json");
}

export function loadTasks(): Task[] {
  const storeFile = getStoreFile();
  if (!fs.existsSync(storeFile)) {
    return [];
  }
  const raw = fs.readFileSync(storeFile, "utf-8");
  return JSON.parse(raw) as Task[];
}

export function saveTasks(tasks: Task[]): void {
  const storeDir = getStoreDir();
  if (!fs.existsSync(storeDir)) {
    fs.mkdirSync(storeDir, { recursive: true });
  }
  fs.writeFileSync(getStoreFile(), JSON.stringify(tasks, null, 2));
}

export function getNextId(tasks: Task[]): number {
  return tasks.reduce((max, task) => Math.max(max, task.id), 0) + 1;
}
