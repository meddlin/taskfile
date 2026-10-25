import * as os from "node:os";
import * as path from "node:path";
import { TaskStore } from "./store";

let store: TaskStore | undefined;

// TASKFILE_DB selects the database file. The default is the CLI's database, so `npm run dev:web`
// shows the same tasks as `taskfile`; the Docker image points it at a mounted volume instead.
export function getStore(): TaskStore {
  store ??= new TaskStore(process.env.TASKFILE_DB ?? path.join(os.homedir(), ".taskfile", "tasks.db"));
  return store;
}
