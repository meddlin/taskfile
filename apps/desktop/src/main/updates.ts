import type { UpdatesApi, UpdateState } from "../../../web/src/lib/desktop-updates";
import type { PickedRelease } from "./releaseFeed";
import type { UpdatePrefsStore } from "./updatePrefs";

/**
 * The desktop app's updater: a small state machine around electron-updater (docs/desktop-updates.md).
 *
 * Nothing here imports Electron or electron-updater. The updater, the stored preferences and the
 * cleanup before quitting are passed in, so tests drive every transition without a packaged, signed
 * app. `updater.ts` supplies the real ones.
 *
 * Rules the rest of the app can rely on:
 *   - Nothing is downloaded until `downloadUpdate()` and nothing restarts until `installUpdate()`;
 *     both are only ever started by the person. (A downloaded update is also installed when the app
 *     is next quit, which is what "ready" tells them.)
 *   - A check nobody asked for (after launch, on the timer) fails silently: being offline is not an
 *     error worth showing. A check the person asked for reports it.
 *   - Failures are returned as `phase: "error"`, never thrown.
 */

/** The slice of electron-updater's `AppUpdater` this uses. */
export interface UpdaterLike {
  autoDownload: boolean;
  autoInstallOnAppQuit: boolean;
  allowPrerelease: boolean;
  /** Points the updater at the folder of the release to update from. */
  setFeedURL(options: { provider: "generic"; url: string; channel: string }): void;
  checkForUpdates(): Promise<{
    isUpdateAvailable: boolean;
    updateInfo: { version: string; releaseNotes?: string | { note?: string | null }[] | null };
  } | null>;
  downloadUpdate(): Promise<unknown>;
  quitAndInstall(): void;
  on(event: "download-progress", listener: (progress: { percent: number }) => void): unknown;
}

export interface UpdateManagerOptions {
  updater: UpdaterLike;
  currentVersion: string;
  /** `{ ok: false }` in a development run: the manager then never touches the network. */
  support: { ok: true } | { ok: false; reason: string };
  prefs: UpdatePrefsStore;
  /** Finds the release to update from (see releaseFeed.ts); null when GitHub lists none. */
  findLatest: (allowPrerelease: boolean) => Promise<PickedRelease | null>;
  /** Called before the app restarts into an update, to stop what would block the installer. */
  prepareToQuit: () => Promise<void>;
  /** Called with the new state after every change, to push it to the window. */
  onChange?: (state: UpdateState) => void;
  now?: () => Date;
  log?: (message: string, detail?: unknown) => void;
  /** First automatic check, after launch. Not at once: startup has enough to do. */
  firstCheckDelayMs?: number;
  /** Automatic checks after that. */
  checkIntervalMs?: number;
}

export const FIRST_CHECK_DELAY_MS = 30_000;
export const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

/** Release notes come as text, a list of notes, or nothing; the page only ever gets plain text. */
export function releaseNotesText(notes: string | { note?: string | null }[] | null | undefined): string | undefined {
  const raw = Array.isArray(notes) ? notes.map((entry) => entry.note ?? "").filter(Boolean).join("\n\n") : notes;
  if (typeof raw !== "string") return undefined;
  const text = raw
    .replace(/<br\s*\/?>|<\/(?:p|h[1-6]|li|div)>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text === "" ? undefined : text;
}

const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));

const NETWORK_PROBLEM =
  /ERR_INTERNET_DISCONNECTED|ERR_NETWORK|ERR_NAME_NOT_RESOLVED|ERR_CONNECTION|ERR_TIMED_OUT|ERR_PROXY|ENOTFOUND|ECONNREFUSED|ECONNRESET|ETIMEDOUT|EAI_AGAIN|fetch failed/;

/**
 * electron-updater's errors carry the whole HTTP response (headers, cookies, a stack). The person
 * gets a sentence; the full error goes to the log.
 */
export function friendlyUpdateError(error: unknown, action: "check" | "download"): string {
  if (NETWORK_PROBLEM.test(messageOf(error))) {
    return "Couldn't reach GitHub. Check your internet connection and try again.";
  }
  const status = (error as { statusCode?: unknown } | null)?.statusCode;
  if (action === "check" && (status === 403 || status === 429)) {
    return "GitHub is limiting requests right now. Please try again in a little while.";
  }
  return action === "check"
    ? "Something went wrong while checking for updates. Please try again later."
    : "Something went wrong while downloading the update. Please try again later.";
}

export class UpdateManager implements UpdatesApi {
  private readonly o: UpdateManagerOptions;
  private state: UpdateState;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private inFlightCheck: Promise<UpdateState> | undefined;
  private lastPercent = -1;

  constructor(options: UpdateManagerOptions) {
    this.o = options;
    const { updater } = options;
    updater.autoDownload = false;
    updater.autoInstallOnAppQuit = true;
    // The feed is chosen per check from the person's setting (releaseFeed.ts), not by electron-updater.
    updater.allowPrerelease = false;
    updater.on("download-progress", ({ percent }) => this.onProgress(percent));

    this.state = {
      phase: "idle",
      currentVersion: options.currentVersion,
      supported: options.support.ok,
      ...(options.support.ok ? {} : { unsupportedReason: options.support.reason }),
      ...options.prefs.load(),
    };
  }

  /** Begins the automatic checks: one soon after launch, then on a timer. */
  start(): void {
    if (!this.state.supported) return;
    this.schedule(this.o.firstCheckDelayMs ?? FIRST_CHECK_DELAY_MS);
  }

  stop(): void {
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
  }

  async getUpdateState(): Promise<UpdateState> {
    return this.state;
  }

  checkForUpdates(): Promise<UpdateState> {
    return this.check(true);
  }

  async downloadUpdate(): Promise<UpdateState> {
    if (this.state.phase !== "available") return this.state;
    const version = this.state.version;
    this.lastPercent = -1;
    this.set({ phase: "downloading", percent: 0 });
    try {
      await this.o.updater.downloadUpdate();
      this.set({ phase: "ready", percent: undefined });
    } catch (error) {
      this.o.log?.("update download failed", error);
      this.set({ phase: "error", error: friendlyUpdateError(error, "download"), version, percent: undefined });
    }
    return this.state;
  }

  async installUpdate(): Promise<UpdateState> {
    if (this.state.phase !== "ready") return this.state;
    try {
      await this.o.prepareToQuit();
    } catch (error) {
      // The app is about to quit either way; a failed cleanup shouldn't strand the update.
      this.o.log?.("cleanup before installing an update failed", error);
    }
    this.o.updater.quitAndInstall();
    return this.state;
  }

  async setAutoCheckUpdates(enabled: boolean): Promise<UpdateState> {
    if (typeof enabled !== "boolean") return this.state;
    this.o.prefs.save({ autoCheck: enabled, allowPrerelease: this.state.allowPrerelease });
    this.set({ autoCheck: enabled });
    // Turning it on checks at once; turning it off lets a timer already running find it off.
    if (enabled && this.state.phase === "idle") void this.check(false);
    return this.state;
  }

  async setAllowPrerelease(enabled: boolean): Promise<UpdateState> {
    if (typeof enabled !== "boolean") return this.state;
    this.o.prefs.save({ autoCheck: this.state.autoCheck, allowPrerelease: enabled });
    this.set({ allowPrerelease: enabled });
    const phase = this.state.phase;
    // An offer found under the other setting no longer stands; look again. A download under way is left alone.
    if (phase === "idle" || phase === "available" || phase === "error") {
      this.set({ phase: "idle", version: undefined, prerelease: undefined, releaseNotes: undefined, error: undefined });
      void this.check(false);
    }
    return this.state;
  }

  // ---- internals ------------------------------------------------------------------------

  private check(manual: boolean): Promise<UpdateState> {
    if (!this.state.supported) return Promise.resolve(this.state);
    // One check at a time, and nothing to check once an update is on its way.
    if (this.inFlightCheck) return this.inFlightCheck;
    if (this.state.phase === "downloading" || this.state.phase === "ready") return Promise.resolve(this.state);

    this.inFlightCheck = this.runCheck(manual).finally(() => {
      this.inFlightCheck = undefined;
    });
    return this.inFlightCheck;
  }

  private async runCheck(manual: boolean): Promise<UpdateState> {
    const before = this.state;
    this.set({ phase: "checking", error: undefined });
    try {
      const release = await this.o.findLatest(this.state.allowPrerelease);
      let result = null;
      if (release) {
        this.o.updater.setFeedURL({ provider: "generic", url: release.url, channel: release.channel });
        result = await this.o.updater.checkForUpdates();
      }
      const lastCheckedAt = (this.o.now?.() ?? new Date()).toISOString();
      if (release && result?.isUpdateAvailable) {
        this.set({
          phase: "available",
          version: result.updateInfo.version,
          prerelease: release.prerelease,
          releaseNotes: releaseNotesText(result.updateInfo.releaseNotes),
          lastCheckedAt,
        });
      } else {
        // Nothing newer, or nothing published to update to: the same answer for the person.
        this.set({ phase: "idle", version: undefined, prerelease: undefined, releaseNotes: undefined, lastCheckedAt });
      }
    } catch (error) {
      this.o.log?.("update check failed", error);
      if (manual) this.set({ phase: "error", error: friendlyUpdateError(error, "check") });
      else this.set({ phase: before.phase, error: before.error });
    }
    return this.state;
  }

  private schedule(delayMs: number): void {
    this.stop();
    this.timer = setTimeout(() => {
      // Checked when it fires, not when it was set, so the toggle takes effect at once.
      if (this.state.autoCheck) void this.check(false);
      this.schedule(this.o.checkIntervalMs ?? CHECK_INTERVAL_MS);
    }, delayMs);
  }

  private onProgress(percent: number): void {
    if (this.state.phase !== "downloading") return;
    const whole = Math.max(0, Math.min(100, Math.floor(percent)));
    // The updater reports many times a second; the page only needs each whole percent.
    if (whole === this.lastPercent) return;
    this.lastPercent = whole;
    this.set({ percent: whole });
  }

  private set(change: Partial<UpdateState>): void {
    const next = { ...this.state, ...change };
    // `undefined` means "clear it", so the state never carries a key that has no value.
    for (const key of Object.keys(next) as (keyof UpdateState)[]) {
      if (next[key] === undefined) delete next[key];
    }
    this.state = next;
    this.o.onChange?.(this.state);
  }
}
