import * as fs from "node:fs";
import * as path from "node:path";

export interface UpdatePrefs {
  autoCheck: boolean;
  allowPrerelease: boolean;
}

export interface UpdatePrefsStore {
  load(): UpdatePrefs;
  save(prefs: UpdatePrefs): void;
}

/**
 * The update preferences, in their own small file under the app's data folder (not in the settings
 * file the web app and CLI share). Checking is on until the person turns it off, and a missing or
 * damaged file means "on": losing the file must never be what stops an app from learning about a
 * fix. Pre-releases are the opposite: off until the person turns them on.
 */
export const DEFAULT_UPDATE_PREFS: UpdatePrefs = { autoCheck: true, allowPrerelease: false };

export function createUpdatePrefsStore(file: string): UpdatePrefsStore {
  return {
    load() {
      try {
        const parsed = (JSON.parse(fs.readFileSync(file, "utf8")) ?? {}) as { autoCheck?: unknown; allowPrerelease?: unknown };
        return {
          autoCheck: typeof parsed.autoCheck === "boolean" ? parsed.autoCheck : DEFAULT_UPDATE_PREFS.autoCheck,
          allowPrerelease:
            typeof parsed.allowPrerelease === "boolean" ? parsed.allowPrerelease : DEFAULT_UPDATE_PREFS.allowPrerelease,
        };
      } catch {
        return { ...DEFAULT_UPDATE_PREFS };
      }
    },
    save(prefs) {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      // Write beside the file and rename over it, so a crash can't leave half a file.
      const temporary = `${file}.${process.pid}.tmp`;
      const body = JSON.stringify({ autoCheck: prefs.autoCheck, allowPrerelease: prefs.allowPrerelease }, null, 2);
      fs.writeFileSync(temporary, body + "\n");
      fs.renameSync(temporary, file);
    },
  };
}
