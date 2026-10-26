import { describe, expect, it, vi } from "vitest";
import type { PickedRelease } from "./releaseFeed";
import type { UpdatePrefs } from "./updatePrefs";
import { friendlyUpdateError, releaseNotesText, UpdateManager, type UpdaterLike } from "./updates";

const stable: PickedRelease = { url: "https://example.test/desktop-v0.2.0", channel: "latest", version: "0.2.0", prerelease: false };
const rc: PickedRelease = { url: "https://example.test/desktop-v0.3.0-rc.1", channel: "rc", version: "0.3.0-rc.1", prerelease: true };

function fakeUpdater() {
  let progress: (p: { percent: number }) => void = () => {};
  const updater = {
    autoDownload: true,
    autoInstallOnAppQuit: false,
    allowPrerelease: true,
    setFeedURL: vi.fn(),
    checkForUpdates: vi.fn(async (): ReturnType<UpdaterLike["checkForUpdates"]> => ({ isUpdateAvailable: true, updateInfo: { version: "0.2.0", releaseNotes: "<p>Fixes</p>" } })),
    downloadUpdate: vi.fn(async () => {
      progress({ percent: 10.4 });
      progress({ percent: 10.9 });
      progress({ percent: 100 });
    }),
    quitAndInstall: vi.fn(),
    on: vi.fn((_event: "download-progress", listener: (p: { percent: number }) => void) => {
      progress = listener;
    }),
  };
  return updater satisfies UpdaterLike;
}

function manager(overrides: Partial<ConstructorParameters<typeof UpdateManager>[0]> = {}, saved: UpdatePrefs = { autoCheck: true, allowPrerelease: false }) {
  const updater = fakeUpdater();
  const stored: UpdatePrefs[] = [];
  const states: string[] = [];
  const findLatest = vi.fn(async (allowPrerelease: boolean) => (allowPrerelease ? rc : stable));
  const prepareToQuit = vi.fn(async () => {});
  const m = new UpdateManager({
    updater,
    currentVersion: "0.1.0",
    support: { ok: true },
    prefs: { load: () => saved, save: (p) => stored.push(p) },
    findLatest,
    prepareToQuit,
    onChange: (s) => states.push(s.phase),
    now: () => new Date("2026-10-26T12:00:00Z"),
    log: () => {},
    ...overrides,
  });
  return { m, updater, stored, states, findLatest, prepareToQuit };
}

describe("UpdateManager", () => {
  it("never downloads or installs on its own: autoDownload is off", () => {
    const { updater } = manager();
    expect(updater.autoDownload).toBe(false);
    expect(updater.allowPrerelease).toBe(false);
  });

  it("walks check, download, restart, and only touches the updater when asked", async () => {
    const { m, updater, prepareToQuit } = manager();
    let state = await m.checkForUpdates();
    expect(state).toMatchObject({ phase: "available", version: "0.2.0", prerelease: false, releaseNotes: "Fixes", lastCheckedAt: "2026-10-26T12:00:00.000Z" });
    expect(updater.setFeedURL).toHaveBeenCalledWith({ provider: "generic", url: stable.url, channel: "latest" });
    expect(updater.downloadUpdate).not.toHaveBeenCalled();

    state = await m.downloadUpdate();
    expect(state).toMatchObject({ phase: "ready", version: "0.2.0" });
    expect(state.percent).toBeUndefined();

    expect(updater.quitAndInstall).not.toHaveBeenCalled();
    await m.installUpdate();
    expect(prepareToQuit).toHaveBeenCalledBefore(updater.quitAndInstall);
    expect(updater.quitAndInstall).toHaveBeenCalledOnce();
  });

  it("reports each whole percent once while downloading", async () => {
    const { m, states } = manager();
    await m.checkForUpdates();
    const seen: (number | undefined)[] = [];
    const original = m["set"].bind(m);
    m["set"] = (change) => {
      if ("percent" in change) seen.push(change.percent);
      original(change);
    };
    await m.downloadUpdate();
    expect(seen).toEqual([0, 10, 100, undefined]);
    expect(states.at(-1)).toBe("ready");
  });

  it("does nothing for download or install out of order", async () => {
    const { m, updater } = manager();
    await m.downloadUpdate();
    await m.installUpdate();
    expect(updater.downloadUpdate).not.toHaveBeenCalled();
    expect(updater.quitAndInstall).not.toHaveBeenCalled();
  });

  it("says up to date when the feed has nothing newer or GitHub lists no release", async () => {
    const { m, updater } = manager();
    updater.checkForUpdates.mockResolvedValueOnce({ isUpdateAvailable: false, updateInfo: { version: "0.1.0" } });
    expect(await m.checkForUpdates()).toMatchObject({ phase: "idle", lastCheckedAt: expect.any(String) });

    const none = manager({ findLatest: async () => null });
    expect(await none.m.checkForUpdates()).toMatchObject({ phase: "idle", lastCheckedAt: expect.any(String) });
    expect(none.updater.checkForUpdates).not.toHaveBeenCalled();
  });

  it("looks at pre-releases only when allowed, and marks the offer", async () => {
    const off = manager();
    await off.m.checkForUpdates();
    expect(off.findLatest).toHaveBeenCalledWith(false);

    const on = manager({}, { autoCheck: true, allowPrerelease: true });
    on.updater.checkForUpdates.mockResolvedValue({ isUpdateAvailable: true, updateInfo: { version: "0.3.0-rc.1" } });
    expect(await on.m.checkForUpdates()).toMatchObject({ phase: "available", version: "0.3.0-rc.1", prerelease: true });
    expect(on.updater.setFeedURL).toHaveBeenCalledWith({ provider: "generic", url: rc.url, channel: "rc" });
  });

  it("drops a stale offer and checks again when the pre-release setting changes", async () => {
    const { m, stored, findLatest } = manager();
    await m.checkForUpdates();
    await m.setAllowPrerelease(true);
    expect(stored).toEqual([{ autoCheck: true, allowPrerelease: true }]);
    await vi.waitFor(() => expect(findLatest).toHaveBeenLastCalledWith(true));
    expect((await m.getUpdateState()).allowPrerelease).toBe(true);
  });

  it("leaves a download under way alone when a setting changes, and ignores non-booleans", async () => {
    const { m, updater, stored } = manager();
    await m.checkForUpdates();
    updater.downloadUpdate.mockImplementationOnce(() => new Promise(() => {}));
    void m.downloadUpdate();
    await m.setAllowPrerelease(true);
    expect((await m.getUpdateState()).phase).toBe("downloading");
    await m.setAutoCheckUpdates("yes" as unknown as boolean);
    expect(stored).toHaveLength(1);
  });

  it("shows an error for a check the person asked for, but stays quiet for an automatic one", async () => {
    const offline = new Error("net::ERR_INTERNET_DISCONNECTED");
    const { m, updater } = manager();
    updater.checkForUpdates.mockRejectedValue(offline);
    expect(await m.checkForUpdates()).toMatchObject({ phase: "error", error: expect.stringContaining("internet connection") });

    const quiet = manager({ firstCheckDelayMs: 1_000 });
    quiet.updater.checkForUpdates.mockRejectedValue(offline);
    vi.useFakeTimers();
    try {
      quiet.m.start();
      await vi.advanceTimersByTimeAsync(1_000);
      expect(quiet.updater.checkForUpdates).toHaveBeenCalledOnce();
      expect((await quiet.m.getUpdateState()).phase).toBe("idle");
      expect((await quiet.m.getUpdateState()).error).toBeUndefined();
    } finally {
      quiet.m.stop();
      vi.useRealTimers();
    }
  });

  it("shares one check between callers and skips the timer when automatic checks are off", async () => {
    const { m, updater, findLatest } = manager();
    await Promise.all([m.checkForUpdates(), m.checkForUpdates()]);
    expect(updater.checkForUpdates).toHaveBeenCalledOnce();
    expect(findLatest).toHaveBeenCalledOnce();

    const off = manager({ firstCheckDelayMs: 500 }, { autoCheck: false, allowPrerelease: false });
    vi.useFakeTimers();
    try {
      off.m.start();
      await vi.advanceTimersByTimeAsync(500);
      expect(off.findLatest).not.toHaveBeenCalled();
    } finally {
      off.m.stop();
      vi.useRealTimers();
    }
  });

  it("never touches the network in a development run", async () => {
    const dev = manager({ support: { ok: false, reason: "dev run" } });
    expect(await dev.m.checkForUpdates()).toMatchObject({ phase: "idle", supported: false, unsupportedReason: "dev run" });
    expect(dev.findLatest).not.toHaveBeenCalled();
  });
});

describe("helpers", () => {
  it("turns release notes into plain text", () => {
    expect(releaseNotesText("<h2>New</h2><ul><li>One</li><li>Two</li></ul>")).toBe("New\nOne\nTwo");
    expect(releaseNotesText([{ note: "a" }, { note: null }, { note: "b" }])).toBe("a\n\nb");
    // Nested or broken tags can't leave markup behind.
    expect(releaseNotesText("a <scr<script>ipt>b <img src=x onerror=alert(1)")).not.toMatch(/[<>]/);
    expect(releaseNotesText(null)).toBeUndefined();
    expect(releaseNotesText("  <br>  ")).toBeUndefined();
  });

  it("gives people a sentence, never the raw updater error", () => {
    expect(friendlyUpdateError(new Error("getaddrinfo ENOTFOUND github.com"), "check")).toContain("internet connection");
    expect(friendlyUpdateError(Object.assign(new Error("x"), { statusCode: 403 }), "check")).toContain("limiting requests");
    const generic = friendlyUpdateError(new Error("Cannot find latest-mac.yml {headers: {...}}"), "download");
    expect(generic).toBe("Something went wrong while downloading the update. Please try again later.");
  });
});
