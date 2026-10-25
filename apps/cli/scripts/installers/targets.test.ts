import { describe, expect, it } from "vitest";
import {
  INSTALL_DIR,
  NODE_VERSION,
  artifactName,
  debControl,
  expandArch,
  findChecksum,
  nodeArchive,
  parseArgs,
  unixLauncher,
  windowsLauncher,
} from "./targets.js";

describe("parseArgs", () => {
  it("builds every architecture for a platform with --arch all", () => {
    expect(parseArgs(["--platform", "macos", "--arch", "all"])).toEqual({
      platform: "macos",
      arches: ["arm64", "x64"],
      skipCompile: false,
    });
  });

  it("builds a single architecture and honours --skip-compile", () => {
    expect(parseArgs(["--platform", "linux", "--arch", "arm64", "--skip-compile"])).toEqual({
      platform: "linux",
      arches: ["arm64"],
      skipCompile: true,
    });
  });

  it("defaults to the host platform and architecture", () => {
    const options = parseArgs([]);
    expect(options.arches).toHaveLength(1);
    expect(["macos", "linux", "windows"]).toContain(options.platform);
  });

  it.each([
    [["--platform", "freebsd"], /Invalid --platform/],
    [["--arch", "riscv"], /Invalid --arch/],
    [["--platform"], /requires a value/],
    [["--nope"], /Unknown argument/],
  ])("rejects bad input %j", (argv, message) => {
    expect(() => parseArgs(argv)).toThrow(message);
  });

  it("only builds x64 for Windows, which covers Windows on ARM via emulation", () => {
    expect(expandArch("windows", "all")).toEqual(["x64"]);
  });
});

describe("nodeArchive", () => {
  it("points at the official nodejs.org tarball for unix targets", () => {
    expect(nodeArchive({ platform: "macos", arch: "arm64" }, "24.0.0")).toEqual({
      fileName: "node-v24.0.0-darwin-arm64.tar.gz",
      url: "https://nodejs.org/dist/v24.0.0/node-v24.0.0-darwin-arm64.tar.gz",
      checksumsUrl: "https://nodejs.org/dist/v24.0.0/SHASUMS256.txt",
      binaryPath: "node-v24.0.0-darwin-arm64/bin/node",
    });
    expect(nodeArchive({ platform: "linux", arch: "x64" }, "24.0.0").fileName).toBe(
      "node-v24.0.0-linux-x64.tar.gz",
    );
  });

  it("uses the zip and node.exe for Windows", () => {
    const archive = nodeArchive({ platform: "windows", arch: "x64" }, "24.0.0");
    expect(archive.fileName).toBe("node-v24.0.0-win-x64.zip");
    expect(archive.binaryPath).toBe("node-v24.0.0-win-x64/node.exe");
  });

  it("bundles a Node release that ships unflagged node:sqlite (>= 22.13)", () => {
    const [major, minor] = NODE_VERSION.split(".").map(Number);
    expect(major > 22 || (major === 22 && minor >= 13)).toBe(true);
  });
});

describe("findChecksum", () => {
  const shasums = [
    "aaaa  node-v1-darwin-arm64.tar.gz",
    "BBBB  node-v1-linux-x64.tar.gz",
    "",
  ].join("\n");

  it("returns the lowercase hash for the requested file", () => {
    expect(findChecksum(shasums, "node-v1-linux-x64.tar.gz")).toBe("bbbb");
  });

  it("fails loudly rather than skipping verification when the file is unlisted", () => {
    expect(() => findChecksum(shasums, "node-v1-win-x64.zip")).toThrow(/No checksum listed/);
  });
});

describe("artifactName", () => {
  it("names each installer after its platform's conventions", () => {
    expect(artifactName({ platform: "macos", arch: "arm64" }, "0.2.1")).toBe(
      "taskfile-0.2.1-macos-arm64.pkg",
    );
    expect(artifactName({ platform: "linux", arch: "x64" }, "0.2.1")).toBe("taskfile_0.2.1_amd64.deb");
    expect(artifactName({ platform: "windows", arch: "x64" }, "0.2.1")).toBe(
      "taskfile-0.2.1-windows-x64-setup.exe",
    );
  });

  it("translates semver prereleases to Debian's ~ ordering so they sort before the release", () => {
    expect(artifactName({ platform: "linux", arch: "arm64" }, "1.0.0-rc.1")).toBe(
      "taskfile_1.0.0~rc.1_arm64.deb",
    );
  });
});

describe("launchers", () => {
  it("execs the bundled runtime by absolute path and forwards arguments", () => {
    const script = unixLauncher(INSTALL_DIR.linux);
    expect(script.startsWith("#!/bin/sh\n")).toBe(true);
    expect(script).toContain(
      `exec "/usr/lib/taskfile/runtime/node" "/usr/lib/taskfile/app/dist/index.js" "$@"`,
    );
  });

  it("resolves the Windows launcher relative to itself, with CRLF line endings", () => {
    const script = windowsLauncher();
    expect(script).toContain(`"%~dp0runtime\\node.exe" "%~dp0app\\dist\\index.js" %*`);
    expect(script.split("\r\n").length).toBeGreaterThan(2);
    expect(script.replace(/\r\n/g, "")).not.toContain("\n");
  });
});

describe("debControl", () => {
  it("emits a control file with the Debian architecture and version, ending in a newline", () => {
    const control = debControl({
      version: "0.3.0-beta.2",
      arch: "x64",
      installedSizeKb: 123,
      maintainer: "Someone <someone@example.com>",
      homepage: "https://example.com",
      description: "A CLI",
    });
    expect(control).toContain("Package: taskfile\n");
    expect(control).toContain("Version: 0.3.0~beta.2\n");
    expect(control).toContain("Architecture: amd64\n");
    expect(control).toContain("Installed-Size: 123\n");
    expect(control.endsWith("\n")).toBe(true);
  });
});
