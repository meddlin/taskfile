import { contextBridge, ipcRenderer } from "electron";
import { UPDATE_METHODS, type UpdateState } from "../../../web/src/lib/desktop-updates";
import { channelFor, UPDATE_STATE_CHANNEL } from "../shared/channels";

/**
 * Exposes `window.taskfileDesktop`: the update methods, each forwarded to the main process, plus
 * `onChange` for the update state the main process pushes. Nothing else from Electron or Node
 * reaches the page. The web app shows its Updates section only when this exists.
 */
const methods = Object.fromEntries(
  UPDATE_METHODS.map((method) => [method, (...args: unknown[]) => ipcRenderer.invoke(channelFor(method), ...args)]),
);

/** Calls `listener` with each pushed update state; returns the function that stops listening. */
function onChange(listener: (state: UpdateState) => void): () => void {
  const handler = (_event: unknown, state: UpdateState) => listener(state);
  ipcRenderer.on(UPDATE_STATE_CHANNEL, handler);
  return () => void ipcRenderer.removeListener(UPDATE_STATE_CHANNEL, handler);
}

contextBridge.exposeInMainWorld("taskfileDesktop", {
  platform: process.platform,
  updates: { ...methods, onChange },
});
