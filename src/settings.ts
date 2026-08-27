import * as fs from "fs";
import * as os from "os";
import * as path from "path";

export type SnapshotRetention = "1-week" | "1-month" | "3-months" | "6-months" | "12-months" | "forever";

export const SNAPSHOT_RETENTION_OPTIONS: readonly SnapshotRetention[] = [
  "1-week",
  "1-month",
  "3-months",
  "6-months",
  "12-months",
  "forever",
];

export interface Settings {
  width: number;
  height: number;
  progressAnimation: boolean;
  lastActiveListId: number | null;
  dailySnapshotsEnabled: boolean;
  dailySnapshotRetention: SnapshotRetention;
}

const DEFAULT_SETTINGS: Settings = {
  width: 120,
  height: 40,
  progressAnimation: true,
  lastActiveListId: null,
  dailySnapshotsEnabled: true,
  dailySnapshotRetention: "12-months",
};

const WIDTH_RANGE = { min: 40, max: 300 };
const HEIGHT_RANGE = { min: 10, max: 100 };

function isValidRetention(value: unknown): value is SnapshotRetention {
  return typeof value === "string" && (SNAPSHOT_RETENTION_OPTIONS as readonly string[]).includes(value);
}

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
      progressAnimation:
        typeof parsed.progressAnimation === "boolean" ? parsed.progressAnimation : DEFAULT_SETTINGS.progressAnimation,
      lastActiveListId: typeof parsed.lastActiveListId === "number" ? parsed.lastActiveListId : DEFAULT_SETTINGS.lastActiveListId,
      dailySnapshotsEnabled:
        typeof parsed.dailySnapshotsEnabled === "boolean"
          ? parsed.dailySnapshotsEnabled
          : DEFAULT_SETTINGS.dailySnapshotsEnabled,
      dailySnapshotRetention: isValidRetention(parsed.dailySnapshotRetention)
        ? parsed.dailySnapshotRetention
        : DEFAULT_SETTINGS.dailySnapshotRetention,
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
    progressAnimation: update.progressAnimation !== undefined ? update.progressAnimation : current.progressAnimation,
    lastActiveListId: update.lastActiveListId !== undefined ? update.lastActiveListId : current.lastActiveListId,
    dailySnapshotsEnabled:
      update.dailySnapshotsEnabled !== undefined ? update.dailySnapshotsEnabled : current.dailySnapshotsEnabled,
    dailySnapshotRetention:
      update.dailySnapshotRetention !== undefined ? update.dailySnapshotRetention : current.dailySnapshotRetention,
  };

  const storeDir = getStoreDir();
  if (!fs.existsSync(storeDir)) {
    fs.mkdirSync(storeDir, { recursive: true });
  }

  fs.writeFileSync(getSettingsFile(), JSON.stringify(next, null, 2));
  return next;
}
