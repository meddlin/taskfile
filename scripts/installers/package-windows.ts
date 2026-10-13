import { copyFileSync, existsSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { run } from "./exec.js";
import { windowsLauncher } from "./targets.js";

const ISCC_FALLBACKS = [
  "C:\\Program Files (x86)\\Inno Setup 6\\ISCC.exe",
  "C:\\Program Files\\Inno Setup 6\\ISCC.exe",
];

/** Compiles the staged tree into a per-user Inno Setup installer that adds taskfile to PATH. */
export function packageWindows(stage: string, outFile: string, version: string): void {
  if (process.platform !== "win32") {
    throw new Error("Windows installers can only be built on Windows (Inno Setup).");
  }
  writeFileSync(join(stage, "taskfile.cmd"), windowsLauncher());

  const script = join(dirname(fileURLToPath(import.meta.url)), "taskfile.iss");
  run(findIscc(), [
    `/DAppVersion=${version}`,
    `/DSourceDir=${stage}`,
    `/DOutputDir=${dirname(outFile)}`,
    `/DOutputBaseFilename=${basename(outFile, ".exe")}`,
    script,
  ]);
}

function findIscc(): string {
  const found = [process.env.ISCC, ...ISCC_FALLBACKS].find((p) => p && existsSync(p));
  if (!found) {
    throw new Error(
      "Inno Setup compiler (ISCC.exe) not found. Install Inno Setup 6 (`choco install innosetup`) or set the ISCC env var.",
    );
  }
  return found;
}
