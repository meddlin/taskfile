# Taskfile

A simple todo list CLI, runnable via `npx`.

## Install

Download the installer for your platform from the
[latest release](https://github.com/meddlin/taskfile/releases/latest) — no Node.js required:

- **macOS**: `taskfile-<version>-macos-arm64.pkg` (Apple Silicon) or `…-macos-x64.pkg` (Intel)
- **Debian/Ubuntu**: `sudo apt install ./taskfile_<version>_amd64.deb` (or `_arm64.deb`)
- **Windows**: `taskfile-<version>-windows-x64-setup.exe`

Then run `taskfile`. Details, uninstall steps, and how to build installers yourself are in
[docs/installers.md](docs/installers.md). Or use npm, below.

## Usage

```bash
npx @rushinglabs/taskfile add "Buy milk"
npx @rushinglabs/taskfile list
npx @rushinglabs/taskfile remove 1
```

## Web app

`apps/web` is a minimal web version (TanStack Start, Tailwind, shadcn/ui, SQLite). This repo is an
npm-workspaces monorepo: the CLI lives in `apps/cli`, the web app in `apps/web`.

```bash
npm install
npm run dev:web          # starts on a free port (printed at startup); PORT=4321 npm run dev:web to choose
```

Run it in Docker (build from the repo root; data persists in the `taskfile-data` volume):

```bash
TASKFILE_PORT=4321 docker compose up --build   # http://localhost:4321
docker compose up --build                      # Docker picks a free port: docker compose port web 8080
```

Locally the web app uses the same database as the CLI (`~/.taskfile/tasks.db`); override with `TASKFILE_DB`.

## Development

```bash
npm install
```

### Running commands against the dev instance

There are a few ways to run the CLI locally while developing, without publishing anything.

**Option 1: `ts-node` (no build step)**

Runs the TypeScript source directly — fastest way to iterate:

```bash
npm run dev -- add "Buy milk"
npm run dev -- list
npm run dev -- remove 1
```

This starts the TUI via the development build.
```bash
npm run dev --
```

**Option 2: build once, run compiled output**

Matches what actually ships:

```bash
npm run build
node dist/index.js add "Buy milk"
node dist/index.js list
node dist/index.js remove 1
```

**Option 3: `npm link` (test the real `taskfile` command)**

Simulates installing the package globally, so you can run it as `taskfile` from anywhere, the same way `npx` would invoke it:

```bash
npm run build
npm link
taskfile add "Buy milk"
taskfile list
```

When you're done, remove the link with:

```bash
npm unlink -g @rushinglabs/taskfile
```

Tasks are stored at `~/.taskfile/tasks.json` regardless of which option you use.

### Running tests

```bash
npm test
```
