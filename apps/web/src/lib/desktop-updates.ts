/**
 * What the Settings page's "updates" section and the desktop app's main process exchange.
 * Types and small pure helpers only, so the browser bundle, the desktop preload script and the
 * desktop main process can all import it (docs/desktop-updates.md).
 *
 * Desktop only: in a browser there is no `window.taskfileDesktop`, and the section isn't shown.
 * The page never supplies a URL or a path; where updates come from is fixed in the desktop build.
 */

/** Where an update is in its life. "idle" means up to date, or not checked yet. */
export type UpdatePhase = "idle" | "checking" | "available" | "downloading" | "ready" | "error";

export interface UpdateState {
  phase: UpdatePhase;
  /** The version this app is running. */
  currentVersion: string;
  /** False in a development run, where there is nothing to update; `unsupportedReason` says why. */
  supported: boolean;
  unsupportedReason?: string;
  /** Whether the app checks on its own (shortly after launch, then every few hours). */
  autoCheck: boolean;
  /** Whether pre-release versions are offered too (early builds that may be unstable). */
  allowPrerelease: boolean;
  /** When the last check finished, as an ISO timestamp; absent until one has. */
  lastCheckedAt?: string;
  /** The newer version, in "available", "downloading" and "ready". */
  version?: string;
  /** Whether `version` is a pre-release. */
  prerelease?: boolean;
  /** Plain-text release notes for `version`, when the release has them. */
  releaseNotes?: string;
  /** Download progress, 0 to 100, in "downloading". */
  percent?: number;
  /** What went wrong, in "error". Check again to retry. */
  error?: string;
}

/** The desktop app's contract. Failures show up in the returned state (`phase: "error"`), never as a throw. */
export interface UpdatesApi {
  getUpdateState(): Promise<UpdateState>;
  /** Looks for a newer version now, whatever `autoCheck` says. */
  checkForUpdates(): Promise<UpdateState>;
  /** Downloads the version that "available" announced. Does nothing in any other phase. */
  downloadUpdate(): Promise<UpdateState>;
  /** Restarts into the downloaded version. Does nothing unless the phase is "ready". */
  installUpdate(): Promise<UpdateState>;
  setAutoCheckUpdates(enabled: boolean): Promise<UpdateState>;
  setAllowPrerelease(enabled: boolean): Promise<UpdateState>;
}

/** Every method of UpdatesApi, as data; the check below fails to compile if one is missing. */
export const UPDATE_METHODS = [
  "getUpdateState",
  "checkForUpdates",
  "downloadUpdate",
  "installUpdate",
  "setAutoCheckUpdates",
  "setAllowPrerelease",
] as const satisfies readonly (keyof UpdatesApi)[];

export type UpdateMethod = (typeof UPDATE_METHODS)[number];

type MissingFromUpdateMethods = Exclude<keyof UpdatesApi, UpdateMethod>;
const _everyMethodListed: [MissingFromUpdateMethods] extends [never] ? true : never = true;
void _everyMethodListed;

/** What the preload script puts on `window.taskfileDesktop`. */
export interface TaskfileDesktopBridge {
  platform: string;
  updates: UpdatesApi & {
    /** Calls `listener` with each state the main process pushes; returns the function that stops listening. */
    onChange(listener: (state: UpdateState) => void): () => void;
  };
}

/** The one-line status the Settings page shows. */
export function describeUpdateState(state: UpdateState): string {
  if (!state.supported) return state.unsupportedReason ?? "updates are not available in this build.";
  const kind = state.prerelease ? "pre-release " : "";
  switch (state.phase) {
    case "checking":
      return "checking for updates…";
    case "available":
      return `${kind}version ${state.version} is available.`;
    case "downloading":
      return `downloading ${kind}version ${state.version}… ${Math.round(state.percent ?? 0)}%`;
    case "ready":
      return `${kind}version ${state.version} is ready. restart to update.`;
    case "error":
      return state.error ?? "something went wrong while checking for updates. please try again later.";
    case "idle":
      return state.lastCheckedAt
        ? `taskfile ${state.currentVersion} is up to date.`
        : `taskfile ${state.currentVersion}. not checked yet.`;
  }
}

/** Whether a check can be started right now (not while one runs or an update is on its way). */
export function canCheck(state: UpdateState): boolean {
  return state.supported && (state.phase === "idle" || state.phase === "available" || state.phase === "error");
}
