import type { IpcMain } from "electron";
import { UPDATE_METHODS, type UpdateMethod, type UpdatesApi } from "../../../web/src/lib/desktop-updates";
import { channelFor } from "../shared/channels";

type Handler = (updates: UpdatesApi, args: unknown[]) => Promise<unknown>;

// Each method forwards only the arguments it takes, so a page can't pass anything else through.
// (The setters check the type of what they get themselves.)
export const UPDATE_HANDLERS: Record<UpdateMethod, Handler> = {
  getUpdateState: (updates) => updates.getUpdateState(),
  checkForUpdates: (updates) => updates.checkForUpdates(),
  downloadUpdate: (updates) => updates.downloadUpdate(),
  installUpdate: (updates) => updates.installUpdate(),
  setAutoCheckUpdates: (updates, args) => updates.setAutoCheckUpdates(args[0] as boolean),
  setAllowPrerelease: (updates, args) => updates.setAllowPrerelease(args[0] as boolean),
};

/**
 * One IPC channel per method. A call is answered only when it comes from the app's own page
 * (`isTrustedUrl`), not from any frame or window that might end up in the session.
 */
export function registerUpdateIpc(options: {
  ipcMain: Pick<IpcMain, "handle">;
  updates: UpdatesApi;
  isTrustedUrl: (url: string) => boolean;
}): void {
  for (const method of UPDATE_METHODS) {
    options.ipcMain.handle(channelFor(method), (event, ...args) => {
      if (!options.isTrustedUrl(event.senderFrame?.url ?? "")) throw new Error("Refused: not the Taskfile window.");
      return UPDATE_HANDLERS[method](options.updates, args);
    });
  }
}
