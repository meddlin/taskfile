import { describe, expect, it } from "vitest";
import { findLatestRelease, pickRelease, RELEASE_REPO } from "./releaseFeed";

const feedFile = (name: string) => [{ name: "Taskfile-1.0.0-arm64.zip" }, { name }];
const release = (tag: string, assets: { name: string }[], extra: object = {}) => ({ tag_name: tag, assets, ...extra });

describe("pickRelease", () => {
  it("skips the CLI's releases, which share this repository", () => {
    const releases = [release("v0.3.0", [{ name: "taskfile-0.3.0-macos-arm64.pkg" }]), release("desktop-v0.1.0", feedFile("latest-mac.yml"))];
    expect(pickRelease(releases, true)).toMatchObject({ version: "0.1.0", channel: "latest" });
  });

  it("offers only normal releases unless pre-releases are allowed", () => {
    const releases = [
      release("desktop-v0.2.0-rc.1", feedFile("rc-mac.yml"), { prerelease: true }),
      release("desktop-v0.1.0", feedFile("latest-mac.yml")),
    ];
    expect(pickRelease(releases, false)).toMatchObject({ version: "0.1.0", prerelease: false });
    expect(pickRelease(releases, true)).toMatchObject({
      version: "0.2.0-rc.1",
      prerelease: true,
      channel: "rc",
      url: `https://github.com/${RELEASE_REPO}/releases/download/desktop-v0.2.0-rc.1`,
    });
  });

  it("ignores drafts and releases that lack the macOS update file", () => {
    const releases = [
      release("desktop-v0.3.0", feedFile("latest-mac.yml"), { draft: true }),
      release("desktop-v0.2.0", [{ name: "Taskfile-0.2.0-arm64.zip" }]),
      release("desktop-v0.1.0", feedFile("latest-mac.yml")),
    ];
    expect(pickRelease(releases, true)?.version).toBe("0.1.0");
  });

  it("returns null for no usable release or an unexpected response", () => {
    expect(pickRelease([], true)).toBeNull();
    expect(pickRelease({ message: "Not Found" }, true)).toBeNull();
    expect(pickRelease([release("desktop-v1.0.0-beta.1", feedFile("beta-mac.yml"), { prerelease: true })], false)).toBeNull();
  });
});

describe("findLatestRelease", () => {
  it("asks GitHub's release list and applies the pre-release choice", async () => {
    let requested = "";
    const fetchJson = (async (url: string) => {
      requested = url;
      return Response.json([release("desktop-v0.1.0", feedFile("latest-mac.yml"))]);
    }) as unknown as typeof fetch;
    expect(await findLatestRelease(false, fetchJson)).toMatchObject({ version: "0.1.0" });
    expect(requested).toBe(`https://api.github.com/repos/${RELEASE_REPO}/releases?per_page=30`);
  });

  it("throws with the HTTP status, so a rate limit can be told from being offline", async () => {
    const fetchJson = (async () => new Response("{}", { status: 403 })) as unknown as typeof fetch;
    await expect(findLatestRelease(false, fetchJson)).rejects.toMatchObject({ statusCode: 403 });
  });
});
