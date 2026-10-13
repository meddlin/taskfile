import { chmodSync, cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, posix } from "node:path";
import { run } from "./exec.js";
import {
  INSTALL_DIR,
  MACOS_BIN_PATH,
  MACOS_PKG_IDENTIFIER,
  MACOS_PREFIX,
  unixLauncher,
} from "./targets.js";

/**
 * Wraps a staged tree in a flat .pkg that installs to /usr/local/lib/taskfile and drops a launcher
 * at /usr/local/bin/taskfile (already on PATH for every macOS shell).
 */
export function packageMacos(
  stage: string,
  workDir: string,
  outFile: string,
  version: string,
): void {
  // Install location is /usr/local, not /, so the installer never touches the mode of /usr itself.
  const root = join(workDir, "pkgroot");
  rmSync(root, { recursive: true, force: true });

  const libDir = join(root, posix.relative(MACOS_PREFIX, INSTALL_DIR.macos));
  mkdirSync(dirname(libDir), { recursive: true });
  cpSync(stage, libDir, { recursive: true });

  const binFile = join(root, posix.relative(MACOS_PREFIX, MACOS_BIN_PATH));
  mkdirSync(dirname(binFile), { recursive: true });
  writeFileSync(binFile, unixLauncher(INSTALL_DIR.macos));
  chmodSync(binFile, 0o755);

  run(
    "pkgbuild",
    [
      "--root", root,
      "--identifier", MACOS_PKG_IDENTIFIER,
      "--version", version,
      "--install-location", MACOS_PREFIX,
      "--ownership", "recommended",
      // Extended attributes on build-machine files otherwise get packed as AppleDouble "._*" files.
      "--filter", "/\\._[^/]*$",
      outFile,
    ],
    { env: { COPYFILE_DISABLE: "1" } },
  );
}
