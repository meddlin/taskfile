import * as fs from "fs";
import * as os from "os";
import * as path from "path";

export interface Settings {
  width: number;
  height: number;
}

const DEFAULT_SETTINGS: Settings = { width: 120, height: 40 };

const WIDTH_RANGE = { min: 40, max: 300 };
const HEIGHT_RANGE = { min: 10, max: 100 };

function clamp(value: number, range: { min: number; max: number }): number {
  return Math.min(Math.max(Math.round(value), range.min), range.max);
}

function getStoreDir(): string {
  return path.join(os.homedir(), ".taskfile");
}

function getSettingsFile(): string {
  return path.join(getStoreDir(), "settings.json");
}

export function loadSettings(): Settings {
  const settingsFile = getSettingsFile();

  if (!fs.existsSync(settingsFile)) {
    return { ...DEFAULT_SETTINGS };
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(settingsFile, "utf-8")) as Partial<Settings>;
    return {
      width: typeof parsed.width === "number" ? clamp(parsed.width, WIDTH_RANGE) : DEFAULT_SETTINGS.width,
      height: typeof parsed.height === "number" ? clamp(parsed.height, HEIGHT_RANGE) : DEFAULT_SETTINGS.height,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(update: Partial<Settings>): Settings {
  const current = loadSettings();
  const next: Settings = {
    width: update.width !== undefined ? clamp(update.width, WIDTH_RANGE) : current.width,
    height: update.height !== undefined ? clamp(update.height, HEIGHT_RANGE) : current.height,
  };

  const storeDir = getStoreDir();
  if (!fs.existsSync(storeDir)) {
    fs.mkdirSync(storeDir, { recursive: true });
  }

  fs.writeFileSync(getSettingsFile(), JSON.stringify(next, null, 2));
  return next;
}
