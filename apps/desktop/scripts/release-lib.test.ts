import { describe, expect, it } from "vitest";
import * as lib from "./release-lib.mjs";

describe("tagVersion", () => {
  it("reads desktop tags", () => {
    expect(lib.tagVersion("desktop-v1.2.3")).toBe("1.2.3");
    expect(lib.tagVersion("desktop-v1.2.3-beta.1")).toBe("1.2.3-beta.1");
  });

  it("ignores the CLI's tags and malformed ones", () => {
    for (const tag of ["v1.2.3", "desktop-1.2.3", "desktop-v1.2", "desktop-v1.2.3 ", "desktop-vx", null]) {
      expect(lib.tagVersion(tag)).toBeNull();
    }
  });
});

describe("parseArgs", () => {
  it("parses --tag in both spellings and --unsigned", () => {
    expect(lib.parseArgs(["--tag", "desktop-v0.1.0", "--unsigned"])).toMatchObject({ tag: "desktop-v0.1.0", unsigned: true });
    expect(lib.parseArgs(["--tag=desktop-v0.1.0"]).tag).toBe("desktop-v0.1.0");
  });

  it("rejects a tag that isn't a desktop tag, and unknown options", () => {
    expect(() => lib.parseArgs(["--tag", "v0.1.0"])).toThrow(/desktop-v/);
    expect(() => lib.parseArgs(["--tag"])).toThrow(/needs a value/);
    expect(() => lib.parseArgs(["--nope"])).toThrow(/Unknown option/);
  });
});

describe("signingProblems", () => {
  const full = { CSC_LINK: "x", APPLE_API_KEY: "/k.p8", APPLE_API_KEY_ID: "ID", APPLE_API_ISSUER: "ISS" };

  it("passes with a certificate and all three notarization variables", () => {
    expect(lib.signingProblems(full, { keychainHasIdentity: false })).toEqual([]);
  });

  it("accepts a keychain identity in place of CSC_LINK", () => {
    const { CSC_LINK: _unused, ...local } = full;
    expect(lib.signingProblems(local, { keychainHasIdentity: true })).toEqual([]);
  });

  it("names every missing piece, so a build can't silently skip notarization", () => {
    const problems = lib.signingProblems({ CSC_LINK: "x", APPLE_API_KEY: "/k.p8" }, { keychainHasIdentity: false });
    expect(problems).toHaveLength(2);
    expect(problems.join(" ")).toContain("APPLE_API_KEY_ID");
    expect(problems.join(" ")).toContain("APPLE_API_ISSUER");
    expect(lib.signingProblems({}, { keychainHasIdentity: false })[0]).toContain("No signing certificate");
  });
});

describe("hasDeveloperId", () => {
  it("finds a Developer ID Application identity and ignores others", () => {
    const hash = "8FCDC2448C12D893E5AA3C46C361498D55EEEE59";
    expect(lib.hasDeveloperId(`  1) ${hash} "Developer ID Application: Someone (ABCDE12345)"\n     1 valid identities found`)).toBe(true);
    expect(lib.hasDeveloperId(`  1) ${hash} "Apple Development: Someone (ABCDE12345)"`)).toBe(false);
    expect(lib.hasDeveloperId("     0 valid identities found")).toBe(false);
  });
});

describe("release files", () => {
  it("formats checksums the way `shasum -c` reads them", () => {
    expect(lib.checksumFile([{ name: "a.dmg", sha256: "abc" }, { name: "b.zip", sha256: "def" }])).toBe("abc  a.dmg\ndef  b.zip\n");
  });

  it("publishes downloads and checksums, not electron-builder's other output", () => {
    const files = ["builder-debug.yml", "Taskfile-0.1.0-arm64.dmg", "Taskfile-0.1.0-arm64.dmg.blockmap", "Taskfile-0.1.0-x64.zip", "mac-arm64", "SHA256SUMS.txt"];
    expect(lib.releaseAssetNames(files)).toEqual([
      "SHA256SUMS.txt",
      "Taskfile-0.1.0-arm64.dmg",
      "Taskfile-0.1.0-x64.zip",
    ]);
  });

  it("treats a version suffix as a pre-release", () => {
    expect(lib.isPrerelease("1.0.0-beta.1")).toBe(true);
    expect(lib.isPrerelease("1.0.0")).toBe(false);
  });
});
