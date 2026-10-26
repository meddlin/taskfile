import { useEffect, useState } from "react";
import { Section } from "~/components/settings-section";
import { canCheck, describeUpdateState, type TaskfileDesktopBridge, type UpdateState } from "~/lib/desktop-updates";

declare global {
  interface Window {
    /** Present only inside the desktop app (apps/desktop's preload script). */
    taskfileDesktop?: TaskfileDesktopBridge;
  }
}

const BUTTON =
  "cursor-pointer border border-border px-3 py-2 hover:border-foreground disabled:cursor-not-allowed disabled:opacity-60";

// The desktop app's over-the-air updates. In a browser (or Docker) there is no bridge, so nothing
// renders. The bridge is read after mount, so the server-rendered page and the first client render match.
export function UpdatesSection() {
  const [bridge, setBridge] = useState<TaskfileDesktopBridge | undefined>();
  const [state, setState] = useState<UpdateState | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    const found = window.taskfileDesktop;
    if (!found) return;
    setBridge(found);
    let live = true;
    const stop = found.updates.onChange((next) => live && setState(next));
    found.updates.getUpdateState().then(
      (initial) => live && setState((current) => current ?? initial),
      () => live && setFailure("Could not reach the desktop app."),
    );
    return () => {
      live = false;
      stop();
    };
  }, []);

  if (!bridge || !state) return null;
  const { updates } = bridge;

  // The main process answers with the new state, and pushes it too; either way the page follows.
  async function run(action: () => Promise<UpdateState>) {
    setFailure(null);
    try {
      setState(await action());
    } catch {
      setFailure("Could not reach the desktop app.");
    }
  }

  const showError = state.supported && state.phase === "error";

  return (
    <Section title="updates">
      <p role={showError ? "alert" : "status"} className={showError ? "text-red-500" : undefined}>
        {describeUpdateState(state)}
      </p>
      {state.phase === "downloading" && (
        <progress value={state.percent ?? 0} max={100} aria-label="download progress" className="w-full accent-[var(--accent)]" />
      )}
      {state.supported && (
        <div className="flex flex-wrap gap-2">
          <button type="button" className={BUTTON} disabled={!canCheck(state)} onClick={() => run(updates.checkForUpdates)}>
            {state.phase === "checking" ? "checking…" : "check for updates"}
          </button>
          {state.phase === "available" && (
            <button type="button" className={BUTTON} onClick={() => run(updates.downloadUpdate)}>
              download version {state.version}
            </button>
          )}
          {state.phase === "ready" && (
            <button type="button" className={BUTTON} onClick={() => run(updates.installUpdate)}>
              restart and install
            </button>
          )}
        </div>
      )}
      {failure && (
        <p role="alert" className="text-red-500">
          {failure}
        </p>
      )}
      {state.releaseNotes && (state.phase === "available" || state.phase === "ready") && (
        <pre className="max-h-48 overflow-auto bg-highlight px-3 py-2 whitespace-pre-wrap">{state.releaseNotes}</pre>
      )}
      {state.supported && (
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={state.autoCheck}
              onChange={(e) => run(() => updates.setAutoCheckUpdates(e.target.checked))}
              className="accent-[var(--accent)]"
            />
            check for updates automatically
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={state.allowPrerelease}
              onChange={(e) => run(() => updates.setAllowPrerelease(e.target.checked))}
              className="accent-[var(--accent)]"
            />
            include pre-release versions
          </label>
          <p className="text-muted-foreground">
            pre-releases are early builds that may be unstable. updates come from this app's releases on GitHub; nothing about you
            or your tasks is sent, and nothing is downloaded or installed until you ask.
          </p>
        </div>
      )}
    </Section>
  );
}
