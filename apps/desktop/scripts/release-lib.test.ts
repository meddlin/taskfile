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

  it("publishes downloads, the update feed with its blockmaps, and checksums, not electron-builder's other output", () => {
    const files = ["builder-debug.yml", "latest-mac.yml", "Taskfile-0.1.0-arm64.dmg", "Taskfile-0.1.0-arm64.zip.blockmap", "Taskfile-0.1.0-x64.zip", "mac-arm64", "SHA256SUMS.txt"];
    expect(lib.releaseAssetNames(files)).toEqual([
      "SHA256SUMS.txt",
      "Taskfile-0.1.0-arm64.dmg",
      "Taskfile-0.1.0-arm64.zip.blockmap",
      "Taskfile-0.1.0-x64.zip",
      "latest-mac.yml",
    ]);
    expect(lib.releaseAssetNames(["rc-mac.yml"])).toEqual(["rc-mac.yml"]);
  });

  it("treats a version suffix as a pre-release", () => {
    expect(lib.isPrerelease("1.0.0-beta.1")).toBe(true);
    expect(lib.isPrerelease("1.0.0")).toBe(false);
  });
});

describe("update feed", () => {
  const feed = (version: string, zips: string[]) =>
    [`version: ${version}`, "files:", ...zips.flatMap((z) => [`  - url: ${z}`, "    sha512: abc==", "    size: 1"]), `path: ${zips[0]}`, "sha512: abc=="].join("\n");

  it("names the feed after the release channel, as electron-builder does", () => {
    expect(lib.updateFeedName("0.1.0")).toBe("latest-mac.yml");
    expect(lib.updateFeedName("0.2.0-rc.1")).toBe("rc-mac.yml");
    expect(lib.updateFeedName("1.0.0-beta")).toBe("beta-mac.yml");
  });

  it("accepts a feed that lists the version and a ZIP for every architecture", () => {
    const text = feed("0.1.0", ["Taskfile-0.1.0-arm64.zip", "Taskfile-0.1.0-x64.zip"]);
    expect(lib.checkUpdateFeed(text, "0.1.0", ["arm64", "x64"], "Taskfile")).toEqual([]);
  });

  it("flags a missing architecture, a wrong version and missing checksums", () => {
    const text = feed("0.1.0", ["Taskfile-0.1.0-arm64.zip"]);
    expect(lib.checkUpdateFeed(text, "0.1.0", ["arm64", "x64"], "Taskfile").join(" ")).toContain("Taskfile-0.1.0-x64.zip");
    expect(lib.checkUpdateFeed(text, "0.2.0", ["arm64"], "Taskfile").join(" ")).toContain("says version 0.1.0, expected 0.2.0");
    expect(lib.checkUpdateFeed("version: 0.1.0\nfiles:\n  - url: Taskfile-0.1.0-arm64.zip", "0.1.0", ["arm64"], "Taskfile").join(" ")).toContain("sha512");
  });
});
