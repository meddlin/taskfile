/**
 * Pure helpers describing what an installer build produces: which platforms/architectures exist,
 * which Node.js archive each one bundles, how artifacts are named, and the text of the generated
 * launcher/control files. Nothing in here touches the filesystem or network, so it is unit-tested
 * directly (see targets.test.ts).
 */

export type Platform = "macos" | "linux" | "windows";
export type Arch = "x64" | "arm64";

export interface Target {
  platform: Platform;
  arch: Arch;
}

/** The Node.js runtime bundled into every installer. `node:sqlite` needs >= 22.5 (unflagged in 22.13+). */
export const NODE_VERSION = "24.21.0";

export const PLATFORMS: Platform[] = ["macos", "linux", "windows"];

/** Architectures built for a platform when `--arch all` is requested. Windows on ARM runs the x64 build under emulation. */
const ALL_ARCHES: Record<Platform, Arch[]> = {
  macos: ["arm64", "x64"],
  linux: ["x64", "arm64"],
  windows: ["x64"],
};

/** Where the app lives once installed. Launchers hard-code these, so they must match the packagers. */
export const INSTALL_DIR: Record<Exclude<Platform, "windows">, string> = {
  macos: "/usr/local/lib/taskfile",
  linux: "/usr/lib/taskfile",
};

/** pkg install location; payload paths are relative to it so the installer never touches /usr itself. */
export const MACOS_PREFIX = "/usr/local";
export const MACOS_BIN_PATH = "/usr/local/bin/taskfile";
export const LINUX_BIN_PATH = "/usr/bin/taskfile";
export const MACOS_PKG_IDENTIFIER = "com.rushinglabs.taskfile";

export function expandArch(platform: Platform, arch: Arch | "all"): Arch[] {
  return arch === "all" ? ALL_ARCHES[platform] : [arch];
}

export function hostPlatform(nodePlatform: string = process.platform): Platform {
  switch (nodePlatform) {
    case "darwin":
      return "macos";
    case "linux":
      return "linux";
    case "win32":
      return "windows";
    default:
      throw new Error(`Unsupported host platform: ${nodePlatform}`);
  }
}

export function hostArch(nodeArch: string = process.arch): Arch {
  if (nodeArch === "x64" || nodeArch === "arm64") {
    return nodeArch;
  }
  throw new Error(`Unsupported host architecture: ${nodeArch}`);
}

export interface BuildOptions {
  platform: Platform;
  arches: Arch[];
  skipCompile: boolean;
}

/** Parses `--platform <p> [--arch <a|all>] [--skip-compile]`. Defaults to the host platform and arch. */
export function parseArgs(argv: string[]): BuildOptions {
  let platform: Platform | undefined;
  let arch: Arch | "all" | undefined;
  let skipCompile = false;

  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (flag === "--skip-compile") {
      skipCompile = true;
    } else if (flag === "--platform" || flag === "--arch") {
      const value = argv[++i];
      if (value === undefined) {
        throw new Error(`${flag} requires a value`);
      }
      if (flag === "--platform") {
        if (!(PLATFORMS as string[]).includes(value)) {
          throw new Error(`Invalid --platform "${value}" (expected ${PLATFORMS.join(", ")})`);
        }
        platform = value as Platform;
      } else {
        if (value !== "x64" && value !== "arm64" && value !== "all") {
          throw new Error(`Invalid --arch "${value}" (expected x64, arm64, or all)`);
        }
        arch = value;
      }
    } else {
      throw new Error(`Unknown argument: ${flag}`);
    }
  }

  const resolvedPlatform = platform ?? hostPlatform();
  return {
    platform: resolvedPlatform,
    arches: expandArch(resolvedPlatform, arch ?? hostArch()),
    skipCompile,
  };
}

/** Archive that contains the Node.js binary for a target, as published at nodejs.org/dist. */
export function nodeArchive(target: Target, version: string = NODE_VERSION): {
  fileName: string;
  url: string;
  checksumsUrl: string;
  /** Path of the node executable inside the archive. */
  binaryPath: string;
} {
  const slug = { macos: "darwin", linux: "linux", windows: "win" }[target.platform];
  const base = `node-v${version}-${slug}-${target.arch}`;
  const fileName = target.platform === "windows" ? `${base}.zip` : `${base}.tar.gz`;
  const dist = `https://nodejs.org/dist/v${version}`;
  return {
    fileName,
    url: `${dist}/${fileName}`,
    checksumsUrl: `${dist}/SHASUMS256.txt`,
    binaryPath: target.platform === "windows" ? `${base}/node.exe` : `${base}/bin/node`,
  };
}

/** Finds the SHA-256 for `fileName` in the contents of a `SHASUMS256.txt` file. */
export function findChecksum(shasums: string, fileName: string): string {
  for (const line of shasums.split("\n")) {
    const [hash, name] = line.trim().split(/\s+/);
    if (name === fileName && hash) {
      return hash.toLowerCase();
    }
  }
  throw new Error(`No checksum listed for ${fileName}`);
}

/** Debian uses `~` (sorts before the release) where semver uses `-` for prereleases. */
export function debVersion(version: string): string {
  return version.replace("-", "~");
}

export function debArch(arch: Arch): "amd64" | "arm64" {
  return arch === "x64" ? "amd64" : "arm64";
}

export function artifactName(target: Target, version: string): string {
  switch (target.platform) {
    case "macos":
      return `taskfile-${version}-macos-${target.arch}.pkg`;
    case "linux":
      return `taskfile_${debVersion(version)}_${debArch(target.arch)}.deb`;
    case "windows":
      return `taskfile-${version}-windows-${target.arch}-setup.exe`;
  }
}

export function unixLauncher(installDir: string): string {
  return `#!/bin/sh
exec "${installDir}/runtime/node" "${installDir}/app/dist/index.js" "$@"
`;
}

/** Lives at the install root on Windows, which is also the directory added to PATH. */
export function windowsLauncher(): string {
  return `@echo off\r\n"%~dp0runtime\\node.exe" "%~dp0app\\dist\\index.js" %*\r\n`;
}

export interface DebControl {
  version: string;
  arch: Arch;
  installedSizeKb: number;
  maintainer: string;
  homepage: string;
  description: string;
}

export function debControl(c: DebControl): string {
  return [
    "Package: taskfile",
    `Version: ${debVersion(c.version)}`,
    "Section: utils",
    "Priority: optional",
    `Architecture: ${debArch(c.arch)}`,
    `Installed-Size: ${c.installedSizeKb}`,
    `Maintainer: ${c.maintainer}`,
    `Homepage: ${c.homepage}`,
    `Description: ${c.description}`,
    "",
  ].join("\n");
}
