/**
 * Where updates are read from: this repository's GitHub releases.
 *
 * The repository also publishes the CLI's installers (`v*` tags), so GitHub's "latest release" is
 * not necessarily a desktop release. Instead the app lists the repository's releases, takes the
 * newest published `desktop-v*` one that carries a macOS update file (pre-releases only when the
 * person allows them), and reads that file straight from the release's download folder. Only GitHub
 * is contacted and nothing about the person or their tasks is sent.
 *
 * No Electron imports: `fetch` is passed in, so tests feed it canned responses.
 */

export const RELEASE_REPO = "meddlin/taskfile";

/** Releases for other products in this repo (the CLI) are not ours to offer. */
export const DESKTOP_TAG_PREFIX = "desktop-v";

/** A generic-provider feed: the folder holding the update file, and which update file to read. */
export interface ReleaseFeed {
  url: string;
  channel: string;
}

interface GitHubRelease {
  tag_name?: unknown;
  draft?: unknown;
  prerelease?: unknown;
  assets?: unknown;
}

export interface PickedRelease extends ReleaseFeed {
  /** The release's version, from its tag. */
  version: string;
  prerelease: boolean;
}

/**
 * Picks the newest published desktop release that carries a macOS update file. GitHub lists
 * releases newest first, so the first match wins. The update file's name is the channel:
 * `latest-mac.yml` is channel "latest", and `rc-mac.yml` (what electron-builder writes for a
 * `1.0.0-rc.1` version) is channel "rc".
 */
export function pickRelease(releases: unknown, allowPrerelease: boolean): PickedRelease | null {
  if (!Array.isArray(releases)) return null;
  for (const release of releases as GitHubRelease[]) {
    if (release?.draft === true) continue;
    const prerelease = release?.prerelease === true;
    if (prerelease && !allowPrerelease) continue;
    const tag = release?.tag_name;
    if (typeof tag !== "string" || !tag.startsWith(DESKTOP_TAG_PREFIX)) continue;
    const assets = Array.isArray(release.assets) ? (release.assets as { name?: unknown }[]) : [];
    for (const asset of assets) {
      const name = asset?.name;
      if (typeof name === "string" && /^[a-z0-9.]+-mac\.yml$/i.test(name)) {
        return {
          url: `https://github.com/${RELEASE_REPO}/releases/download/${encodeURIComponent(tag)}`,
          channel: name.slice(0, -"-mac.yml".length),
          version: tag.slice(DESKTOP_TAG_PREFIX.length),
          prerelease,
        };
      }
    }
  }
  return null;
}

/** Asks GitHub for the newest release to update from; null when there is none. */
export async function findLatestRelease(
  allowPrerelease: boolean,
  fetchJson: typeof fetch = fetch,
): Promise<PickedRelease | null> {
  const response = await fetchJson(`https://api.github.com/repos/${RELEASE_REPO}/releases?per_page=30`, {
    headers: { Accept: "application/vnd.github+json" },
  });
  if (!response.ok) {
    throw Object.assign(new Error(`GitHub answered ${response.status} when listing releases`), {
      statusCode: response.status,
    });
  }
  return pickRelease(await response.json(), allowPrerelease);
}
