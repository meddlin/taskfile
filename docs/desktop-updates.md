# Desktop app updates

The desktop app updates itself over the air from this repository's
[GitHub Releases](https://github.com/meddlin/taskfile/releases). Normal releases are offered by
default; pre-releases only if the person turns them on.

## What the person sees

**Settings → updates** (desktop app only; the section is absent in a browser or Docker):

- the current status ("taskfile 0.1.0 is up to date", "version 0.2.0 is available", download progress,
  "ready, restart to update");
- **check for updates** (manual check), then **download version X**, then **restart and install**;
- **check for updates automatically** (on by default): one check 30 seconds after launch, then every
  6 hours, silently. A manual check reports failures; an automatic one does not;
- **include pre-release versions** (off by default).

The macOS app menu also has **Taskfile → Check for Updates…**, which does the same with dialogs.

Nothing is downloaded until the person clicks download, and nothing restarts until they click restart.
(A downloaded update is also installed when they next quit the app.) Only GitHub is contacted; nothing
about the person or their tasks is sent.

## How it finds a release

This repository also publishes the CLI's installers (`v*` tags), so GitHub's "latest release" can be a
CLI release. [`releaseFeed.ts`](../apps/desktop/src/main/releaseFeed.ts) therefore lists the releases
through GitHub's API and picks the newest one that:

- is published (not a draft) and has a `desktop-v*` tag;
- is not marked pre-release, unless the pre-release setting is on;
- has a macOS update file attached (`latest-mac.yml`, or `rc-mac.yml`, `beta-mac.yml`… for a
  pre-release version).

It then points `electron-updater` at that release's download folder, which reads the update file,
compares versions (semver) and offers the release only if it is newer than the running app. The API
call is anonymous (60 per hour per IP); a check every 6 hours is far below that, and a rate limit shows
as "GitHub is limiting requests right now".

## What a release must contain

The release workflow ([release-desktop.yml](../.github/workflows/release-desktop.yml)) attaches, besides the DMGs
and ZIPs, the **update feed** (`latest-mac.yml`, or `<id>-mac.yml` for a version like `0.2.0-rc.1`) and
the `.blockmap` files. Without the feed an installed app never sees the release. `release.mjs` checks
the feed before the build counts as done: it must name the version and a ZIP for **both** architectures.

Whether a release is a pre-release comes from the version: a `-` suffix (`0.2.0-rc.1`) makes the
GitHub Release a pre-release, so only people who opted in are offered it. Publishing a normal release
(approving it in the `release-publish` environment) is what offers it to every installed app, within
six hours or at their next launch. See [desktop-release.md](desktop-release.md).

## Things to know

- **Only signed builds can update.** macOS refuses to swap in an unsigned or differently signed app, so
  updates work between releases signed with the same Developer ID, and an unsigned local build will
  download but fail to install. A development run (`npm run dev:desktop`) has updates switched off, and
  says why.
- **Downgrades are not offered.** A person on `0.3.0-rc.1` who turns pre-releases off stays there until a
  stable release newer than it ships.
- **Rolling back:** delete or un-publish a bad release (`gh release delete desktop-vX.Y.Z --cleanup-tag`).
  The previous one becomes the newest again, but apps that already installed the bad one keep it, so
  ship a higher version with the fix.
- **Not yet tried against a real pair of signed releases.** The state machine and the release picker are
  unit-tested, and the packaged app was checked to start the updater and talk to the Settings page. An
  end-to-end update needs two signed releases; the first real one is the test (use a pre-release tag
  and tick "include pre-release versions" on an installed older build).

## Code

| Piece | Where |
|---|---|
| Shared contract (types, status text), used by the page, preload and main process | [`apps/web/src/lib/desktop-updates.ts`](../apps/web/src/lib/desktop-updates.ts) |
| Settings page section | [`apps/web/src/components/updates-section.tsx`](../apps/web/src/components/updates-section.tsx) |
| State machine around `electron-updater` | [`updates.ts`](../apps/desktop/src/main/updates.ts) |
| Release picker | [`releaseFeed.ts`](../apps/desktop/src/main/releaseFeed.ts) |
| Preferences file (`updates.json` in the app's data folder) | [`updatePrefs.ts`](../apps/desktop/src/main/updatePrefs.ts) |
| Electron wiring and menu item | [`updater.ts`](../apps/desktop/src/main/updater.ts) |
| IPC (only the app's own page may call it) and preload bridge | [`ipc.ts`](../apps/desktop/src/main/ipc.ts), [`preload/index.ts`](../apps/desktop/src/preload/index.ts) |

The page can only call the six methods in the contract. It never supplies a URL or path.
