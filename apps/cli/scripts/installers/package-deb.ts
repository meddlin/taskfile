import { chmodSync, cpSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { commandExists, run } from "./exec.js";
import { Arch, DebControl, INSTALL_DIR, LINUX_BIN_PATH, debControl, unixLauncher } from "./targets.js";

const DEFAULT_MAINTAINER = "meddlin <meddlin@users.noreply.github.com>";

/** Builds a .deb that installs to /usr/lib/taskfile with a launcher at /usr/bin/taskfile. */
export function packageDeb(
  stage: string,
  workDir: string,
  outFile: string,
  version: string,
  arch: Arch,
): void {
  if (!commandExists("dpkg-deb")) {
    throw new Error(
      "dpkg-deb not found. Build .deb packages on Debian/Ubuntu, or install it (macOS: `brew install dpkg`).",
    );
  }

  const root = join(workDir, "debroot");
  rmSync(root, { recursive: true, force: true });

  const libDir = join(root, INSTALL_DIR.linux);
  mkdirSync(join(root, "usr/lib"), { recursive: true });
  cpSync(stage, libDir, { recursive: true });

  const binFile = join(root, LINUX_BIN_PATH);
  mkdirSync(join(root, "usr/bin"), { recursive: true });
  writeFileSync(binFile, unixLauncher(INSTALL_DIR.linux));
  chmodSync(binFile, 0o755);

  // Debian policy: the license text lives under /usr/share/doc/<package>/copyright.
  const docDir = join(root, "usr/share/doc/taskfile");
  mkdirSync(docDir, { recursive: true });
  cpSync(join(stage, "LICENSE"), join(docDir, "copyright"));
  chmodSync(docDir, 0o755);
  chmodSync(join(docDir, "copyright"), 0o644);
  for (const dir of ["usr", "usr/lib", "usr/bin", "usr/share", "usr/share/doc"]) {
    chmodSync(join(root, dir), 0o755);
  }

  const control: DebControl = {
    version,
    arch,
    installedSizeKb: Math.ceil(treeSize(root) / 1024),
    maintainer: process.env.TASKFILE_DEB_MAINTAINER ?? DEFAULT_MAINTAINER,
    homepage: "https://github.com/meddlin/taskfile",
    description: "A simple todo list CLI with an interactive terminal UI",
  };
  mkdirSync(join(root, "DEBIAN"), { recursive: true });
  chmodSync(join(root, "DEBIAN"), 0o755);
  writeFileSync(join(root, "DEBIAN/control"), debControl(control));
  chmodSync(join(root, "DEBIAN/control"), 0o644);

  run("dpkg-deb", ["--root-owner-group", "-Zxz", "--build", root, outFile]);
}

function treeSize(dir: string): number {
  let total = 0;
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const stats = statSync(path);
    total += stats.isDirectory() ? treeSize(path) : stats.size;
  }
  return total;
}
