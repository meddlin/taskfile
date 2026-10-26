# Desktop app

`apps/desktop` (`@taskfile/desktop`) is an Electron app that wraps the web app in `apps/web`. It is
the same UI and the same SQLite database as the CLI and the web app (`~/.taskfile/tasks.db`, or
whatever `TASKFILE_DB` / the Settings page choose), in a native window.

## How it works

- The web app's production server (the TanStack Start fetch handler) runs **inside Electron's main
  process**, on `127.0.0.1` at a port the OS picks ([`webServer.ts`](../apps/desktop/src/main/webServer.ts)).
  Its server functions therefore run on Electron's own Node, where `node:sqlite` is available, and
  nothing else needs to be installed.
- A `BrowserWindow` loads that address. The window has no Node access (`sandbox`, `contextIsolation`);
  its only extra is the small preload bridge for updates (`window.taskfileDesktop`); links to other sites open in the user's browser and other schemes are
  refused ([`navigation.ts`](../apps/desktop/src/main/navigation.ts)).
- Because a loopback server is reachable by every local process and by web pages in the user's
  browser, each launch generates a random token. The window's session adds it to its requests, and the
  server answers 403 to anything without it, or with a foreign `Host` header
  ([`guard.ts`](../apps/desktop/src/main/guard.ts)).
- `scripts/build.mjs` bundles the main process **and the web server build with all its dependencies**
  into one file, `dist/main.mjs`, so the packaged app ships no `node_modules`. The web app's static
  assets are copied next to it and packaged under `Resources/client`.

## Develop

```bash
npm install
npm run dev:desktop        # builds the web app, bundles the main process, opens Electron
```

This is a production-style run (no hot reload). For UI work use `npm run dev:web` in a browser, then
rebuild here to check the window. `npm run build` at the repository root builds the CLI, the web app and
the desktop bundle in that order; the order matters, because the desktop build reads `apps/web/dist`
(workspace order is set in the root `package.json`).

## Test

```bash
npm test -w @taskfile/desktop     # unit tests, plus an integration test of the loopback server
npm run smoke -w @taskfile/desktop
```

`smoke` launches the real app with `--smoke-test` against a throwaway `HOME` and checks that it
renders the page, that requests without the token get 403, and that `node:sqlite` created a database
inside Electron. Pass the path to a packaged executable to test that instead, for example
`node apps/desktop/scripts/smoke.mjs apps/desktop/release/mac-arm64/Taskfile.app/Contents/MacOS/Taskfile`.

## Package

```bash
npm run package -w @taskfile/desktop     # unsigned, unpacked Taskfile.app in apps/desktop/release/
npm run release -w @taskfile/desktop -- --unsigned    # both architectures, DMG + ZIP + checksums
```

The app updates itself from GitHub Releases (Settings → updates): [desktop-updates.md](desktop-updates.md).
Signed, notarized releases are cut from GitHub: see [desktop-release.md](desktop-release.md).
