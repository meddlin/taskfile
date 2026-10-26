import { describe, expect, it, vi } from "vitest";
import { UPDATE_METHODS, type UpdatesApi } from "../../../web/src/lib/desktop-updates";
import { channelFor } from "../shared/channels";
import { registerUpdateIpc } from "./ipc";

function setup(trusted: (url: string) => boolean) {
  const handlers = new Map<string, (event: unknown, ...args: unknown[]) => unknown>();
  const updates = Object.fromEntries(UPDATE_METHODS.map((method) => [method, vi.fn(async () => ({ phase: "idle" }))])) as unknown as {
    [K in keyof UpdatesApi]: ReturnType<typeof vi.fn>;
  };
  registerUpdateIpc({
    ipcMain: { handle: (channel, handler) => void handlers.set(channel, handler as never) },
    updates: updates as unknown as UpdatesApi,
    isTrustedUrl: trusted,
  });
  const call = (method: string, url: string, ...args: unknown[]) => handlers.get(channelFor(method))!({ senderFrame: { url } }, ...args);
  return { handlers, updates, call };
}

describe("registerUpdateIpc", () => {
  it("registers a channel for every update method", () => {
    const { handlers } = setup(() => true);
    expect([...handlers.keys()].sort()).toEqual(UPDATE_METHODS.map(channelFor).sort());
  });

  it("answers the app's own page and refuses any other frame", async () => {
    const { call, updates } = setup((url) => url.startsWith("http://127.0.0.1:5000/"));
    await call("checkForUpdates", "http://127.0.0.1:5000/settings");
    expect(updates.checkForUpdates).toHaveBeenCalledOnce();
    expect(() => call("checkForUpdates", "https://evil.example/")).toThrow(/Refused/);
    expect(() => call("installUpdate", "")).toThrow(/Refused/);
    expect(updates.installUpdate).not.toHaveBeenCalled();
  });

  it("forwards the setters' one argument and nothing extra to the other methods", async () => {
    const { call, updates } = setup(() => true);
    await call("setAllowPrerelease", "x", true, "ignored");
    expect(updates.setAllowPrerelease).toHaveBeenCalledWith(true);
    await call("downloadUpdate", "x", "https://evil.example/file.zip");
    expect(updates.downloadUpdate).toHaveBeenCalledWith();
  });
});
