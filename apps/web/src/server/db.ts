import { resolveDbPath } from "./data-location";
import { TaskStore } from "./store";

let store: TaskStore | undefined;

export function getStore(): TaskStore {
  store ??= new TaskStore(resolveDbPath().path);
  return store;
}
