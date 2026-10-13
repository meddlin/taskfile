# Native installers

Besides npm, taskfile ships self-contained installers that need no Node.js on the user's machine:

| Platform | Artifact | Installs to | Puts `taskfile` on PATH via |
| --- | --- | --- | --- |
| macOS (Apple Silicon / Intel) | `taskfile-X.Y.Z-macos-arm64.pkg`, `…-macos-x64.pkg` | `/usr/local/lib/taskfile` | launcher at `/usr/local/bin/taskfile` |
| Debian/Ubuntu (amd64 / arm64) | `taskfile_X.Y.Z_amd64.deb`, `…_arm64.deb` | `/usr/lib/taskfile` | launcher at `/usr/bin/taskfile` |
| Windows (x64; also runs on ARM via emulation) | `taskfile-X.Y.Z-windows-x64-setup.exe` | `%LOCALAPPDATA%\Programs\taskfile` | per-user `PATH` entry |

Every release also carries a `SHA256SUMS` file.

## How an installer is built

Each installer is the same three things, wrapped in the platform's native package format:

```
taskfile/
  runtime/node        official Node.js binary for that OS/arch (pinned in scripts/installers/targets.ts)
  app/dist            compiled TypeScript (`npm run build`)
  app/node_modules    production dependencies only (`npm ci --omit=dev`)
```

plus a tiny launcher script that runs `runtime/node app/dist/index.js "$@"`. Node.js is bundled
rather than compiled into a single executable because the CLI relies on `node:sqlite` and an
ESM-only Ink/yoga stack, neither of which survives single-executable bundling reliably. The cost is
size (~40 MB per installer).

The Node.js archive is downloaded from nodejs.org and verified against the published
`SHASUMS256.txt` before use; the build fails on a mismatch. To bump the bundled Node.js, change
`NODE_VERSION` in [`scripts/installers/targets.ts`](../scripts/installers/targets.ts).

Code lives in [`scripts/installers/`](../scripts/installers):

- `targets.ts` — platform/arch matrix, artifact names, launcher and `.deb` control file contents (pure, unit-tested)
- `stage.ts` — builds the `runtime/` + `app/` tree
- `package-macos.ts` (`pkgbuild`), `package-deb.ts` (`dpkg-deb`), `package-windows.ts` + `taskfile.iss` (Inno Setup)
- `build.ts` — entry point

## Building locally

```bash
npm install
npm run installers -- --platform macos --arch arm64
```

| Flag | Meaning |
| --- | --- |
| `--platform macos\|linux\|windows` | Defaults to the machine you're on. |
| `--arch x64\|arm64\|all` | Defaults to the machine's architecture. Architectures can be cross-built on any host because only the bundled Node.js binary differs. |
| `--skip-compile` | Reuse the existing `dist/` instead of running `npm run build`. |

Output goes to `release/` (git-ignored). Each platform's installer can only be assembled on a
matching host, because the packaging tools are OS-specific:

| Building | Needs |
| --- | --- |
| `.pkg` | macOS (`pkgbuild`, ships with the OS) |
| `.deb` | `dpkg-deb` — Debian/Ubuntu, or `brew install dpkg` on macOS |
| `.exe` | Windows with [Inno Setup 6.3+](https://jrsoftware.org/isinfo.php) (`choco install innosetup`); set `ISCC` if it isn't in the default location |

Set `TASKFILE_DEB_MAINTAINER="Name <email>"` to override the `.deb`'s Maintainer field.

## Cutting a release by hand

CI is not used for releases right now (see [Building in CI](#building-in-ci)), so installers are
built on your machine and uploaded to the GitHub Release yourself. Do this after the version-bump
PR is merged and the tag is pushed (steps 1-4 in [deploy.md](./deploy.md)), replacing `vX.Y.Z`:

```bash
# 1. Build from exactly what's tagged, on a clean checkout
git checkout vX.Y.Z
npm ci

# 2. Build the installers (macOS host: both .pkg files, plus the .deb files if dpkg is installed)
brew install dpkg                                  # one-time, only needed for the .deb files
npm run installers -- --platform macos --arch all
npm run installers -- --platform linux --arch all

# 3. Check them (see "Checking a build" below), then write checksums
(cd release && shasum -a 256 *.pkg *.deb > SHA256SUMS)   # add *.exe if you have one

# 4. Create the release with generated notes and upload the binaries in one step
gh release create vX.Y.Z --title "vX.Y.Z" --generate-notes release/*.pkg release/*.deb release/SHA256SUMS
```

Notes:

- **Windows:** the `.exe` can only be built on a Windows machine with Inno Setup (see the table
  above). On Windows, run `npm run installers -- --platform windows` there, then copy the file into
  `release/` before step 3 and add `release/*.exe` to the `gh release create` command (or upload it
  later with `gh release upload vX.Y.Z path\to\taskfile-X.Y.Z-windows-x64-setup.exe`). Skip it if you
  don't have a Windows machine; the release is valid without it, but the README and docs mention it.
- **Pre-release:** add `--prerelease` to `gh release create` for tags like `v1.0.0-rc.1`.
- **Add to an existing release:** if the release already exists, use
  `gh release upload vX.Y.Z release/* --clobber` instead of `gh release create`.
- **Preview first:** `gh release create ... --draft` creates it unpublished so you can review the
  notes and attachments on GitHub, then publish from the release page.
- Re-running `npm run installers` rebuilds `release/` artifacts in place; delete old ones
  (`rm -rf release`) if the version changed, so you don't upload stale files.

### Checking a build

Before uploading, install what you built (on a matching machine) and confirm it works:

```bash
# macOS (installs to /usr/local; see "Installing" below to uninstall)
sudo installer -pkg release/taskfile-X.Y.Z-macos-arm64.pkg -target /
taskfile --version && taskfile list

# Debian/Ubuntu
sudo apt install ./release/taskfile_X.Y.Z_amd64.deb
taskfile --version && taskfile list
```

This also uses your real `~/.taskfile` database; prefix with `HOME=$(mktemp -d)` for a throwaway one.
The `.deb` and Windows paths have not been run end to end yet, so treat the first build of each as
something to verify, not just ship.

## Building in CI

[`.github/workflows/release-installers.yml`](../.github/workflows/release-installers.yml) builds all
installers on macOS, Linux, and Windows runners. **Its automatic tag trigger is currently disabled**
to save Actions minutes, so it only runs when started manually:

- **Run workflow** (Actions tab) — builds and smoke-tests every installer; nothing is released.
  The installers are downloadable as workflow artifacts for 14 days. This is also the easiest way
  to get a Windows `.exe` or to verify a `.deb` without a Debian machine. If you pick a tag under
  *Use workflow from*, it also runs the version/branch checks and creates the GitHub Release.
- **To turn automatic releases back on**, uncomment the `push: tags: v*.*.*` trigger at the top of
  the workflow. A pushed tag then runs tests, verifies the tag matches `package.json` and is on
  `main`, builds, smoke-tests, and creates the release with generated notes and `SHA256SUMS`
  (tags containing `-` become pre-releases; an existing release gets the installers added).

The **smoke test** is the integration test for this feature. On a fresh runner it installs the real
artifact the way a user would (`installer -pkg`, `dpkg -i`, or the silent Windows installer), then
checks that `taskfile --version` matches `package.json`, that `add`/`list` work (exercising the
bundled runtime and `node:sqlite`), and that uninstalling removes the files (Debian) or the `PATH`
entry (Windows). It runs only against the runner's own architecture.

## Installing (for users)

**macOS** — double-click the `.pkg`, or `sudo installer -pkg taskfile-X.Y.Z-macos-arm64.pkg -target /`.
Pick `arm64` for Apple Silicon and `x64` for Intel. To uninstall:

```bash
sudo rm -rf /usr/local/lib/taskfile /usr/local/bin/taskfile
sudo pkgutil --forget com.rushinglabs.taskfile
```

**Debian/Ubuntu** — `sudo apt install ./taskfile_X.Y.Z_amd64.deb` (use `dpkg -i` if you prefer).
Uninstall with `sudo apt remove taskfile`.

**Windows** — run the `-setup.exe`. It installs for the current user only (no administrator
prompt) and adds taskfile to your `PATH`; open a new terminal afterwards. Uninstall from
*Settings → Apps*.

## Known limitations

- **Installers are not code-signed or notarized.** macOS Gatekeeper will refuse to open a
  downloaded `.pkg` on double-click (right-click → Open, or use the `installer` command above), and
  Windows SmartScreen will show an "unrecognized app" warning. Fixing this needs an Apple Developer
  ID and a Windows code-signing certificate, wired into the workflow as secrets.
- **No apt repository / Homebrew tap / winget manifest.** Installers are downloaded from the
  GitHub Release manually; there is no auto-update.
- Windows on ARM uses the x64 build under emulation; Linux packages are `.deb` only (no `.rpm`).
- The bundled Node.js is the user-visible runtime: Node.js security releases require a new taskfile
  release to reach installer users.
