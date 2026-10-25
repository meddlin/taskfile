# Repository Guidelines

## Project Structure & Module Organization

This is an npm-workspaces monorepo: `apps/cli` is the command-line/TUI task manager
(`@rushinglabs/taskfile`, published to npm and packaged as native installers) and `apps/web` is a
minimal web version (`@taskfile/web`: TanStack Start, Tailwind, shadcn/ui, SQLite via `node:sqlite`).
All paths below that start with `src/` or `scripts/` are relative to `apps/cli`. Run `npm install`,
`npm test` and `npm run build` from the repository root; they cover every workspace. The lockfile and
`LICENSE` live at the root.

The web app keeps its own store (`apps/web/src/server/store.ts`) with the same table layout as the
CLI's, so both can open one database file. `TASKFILE_DB` selects the file (default `~/.taskfile/tasks.db`).
Ports are never hardcoded: set `PORT` to choose one, otherwise a free port is picked (dev server:
`vite.config.ts`; production: `server.mjs`). `apps/web/Dockerfile` (build from the repo root) and
`docker-compose.yml` run it locally; the host port comes from `TASKFILE_PORT` or Docker picks a free one.

The web app's `/settings` page (`apps/web/src/routes/settings.tsx`) sets the color scheme and page
background and shows where the database lives. Both preferences are per-browser (`localStorage`, applied
before first paint by inline init scripts: `src/lib/theme.ts`, `src/lib/background.ts`). Backgrounds are
CSS in `src/styles.css`, keyed by `html[data-background]` and reused as `.backdrop-*` for the previews;
add one by extending `BACKGROUND_OPTIONS` and adding a light and dark rule there. The database path
comes from `src/server/data-location.ts` (`TASKFILE_DB` or the default).

The CLI is a small TypeScript command-line task manager. `src/index.ts` defines the
Commander CLI and routes subcommands. Command handlers live in `src/commands/` (`add.ts`, `list.ts`,
and `remove.ts`), while `src/store.ts` owns the SQLite persistence layer and shared `Task` type.
Tests are colocated with their subjects as `*.test.ts`/`*.test.tsx`. TypeScript builds into the
ignored `dist/` directory. The CLI stores runtime data outside the repository at
`~/.taskfile/tasks.db`; do not commit local databases or generated output.

Running `taskfile` with no subcommand launches an interactive TUI (falls back to `--help` output if
stdin isn't a TTY). The TUI lives in `src/tui/` (`index.tsx` entry, `App.tsx` state/keybindings,
`TaskList.tsx` and `AddTaskInput.tsx` presentational components) and is built with Ink/React — this
is why the project is `"type": "module"` with `NodeNext` module resolution (Ink v4+ is ESM-only) and
why relative imports need explicit `.js` extensions. TUI code calls `store.ts` functions directly
rather than the `commands/*.ts` wrappers, since those `console.log`/`console.error`, which would
corrupt Ink's full-screen render. Keybindings: arrows/`j`/`k` to navigate, `space`/`enter` to toggle
done, `a` to add, `d`/`x` to delete (asks `y`/`n` to confirm), `q`/`Esc` to quit.

Tasks can be put on a Kanban-style status board (`src/board.ts` holds the statuses `backlog`, `todo`,
`in-progress`, `done` and their parsing/grouping helpers). A task's `status` is nullable (null = not
on the board); the `done` column and the done checkbox are kept in sync by `store.ts`
(`setStatus`, `moveToBoard`, `toggleTask`). CLI: `taskfile status <id> <status|none>` and
`taskfile board`. TUI: `m` sends the selected todo to the board, `t` cycles its status, and the
"Board" sidebar page (`BoardPage.tsx`, all lists combined) uses `[`/`]` to pick a column, `,`/`.` to
move a card, and `r` to take it off the board.

The Settings page can set a background image (PNG path, `src/tui/backgroundImage.ts`). `tui/index.tsx`
probes the terminal for the kitty graphics protocol before rendering; if supported, the image is
placed under the text (`z=-1`) by `BackgroundLayer.tsx`, otherwise a dimmed half-block (`▀`)
backdrop is drawn in the frame's empty space and a warning is shown.

Native installers (macOS `.pkg`, Debian `.deb`, Windows `.exe`) are built by `scripts/installers/`
(run `npm run installers`, output in the ignored `release/` directory) and, optionally, by
`.github/workflows/release-installers.yml` (manual-dispatch only for now; the tag trigger is
commented out to save Actions minutes). Releases are currently built and uploaded by hand — see
`docs/installers.md`.

## Build, Test, and Development Commands

- `npm install` installs dependencies from `package-lock.json`; use Node.js 22.5 or newer.
- `npm run dev -- list` runs the TypeScript entry point directly with `ts-node`. Replace `list` with commands such as `add "Buy milk"` or `remove 1`.
- `npm run build` compiles production JavaScript into `dist/` using `tsc`.
- `node dist/index.js list` exercises the compiled CLI as users will receive it.
- `npm test` runs the complete Vitest suite once.

## Coding Style & Naming Conventions

Follow the existing TypeScript style: two-space indentation, double-quoted strings, semicolons, and
explicit return types for exported functions. Keep filenames and command names lowercase; use
`camelCase` for functions and variables and `PascalCase` for interfaces such as `Task`. Preserve
strict TypeScript compatibility. No formatter or linter is configured, so match neighboring code and
run the compiler before submitting changes.

## Testing Guidelines

Use Vitest with `describe`, `it`, and `expect`. Name tests `<module>.test.ts` and place them beside
the implementation. Tests that touch persistence must redirect `process.env.HOME` to a temporary
directory and clean it up in `afterEach`; never write to a developer's real `~/.taskfile`. Cover
both successful output and failure behavior, including `process.exitCode`. Run `npm test` and `npm
run build` before opening a pull request.

## Commit & Pull Request Guidelines

Recent commits use short, imperative summaries such as `Store tasks in a local SQLite database`.
Keep each commit focused and avoid committing `dist/`, `node_modules/`, or local task data. Pull
requests should explain the user-visible behavior, summarize implementation and tests, and link
relevant issues. Include terminal output examples when CLI messages or command syntax changes;
screenshots are generally unnecessary for this text-only application.


## Engineering Standards

### Testing

- Every new feature needs to have unit tests to accompany it. Tests should be meaningful, not slop.
- Consider when to create unit tests, regression tests, and integration tests.
- End-to-end testing should be reserved for large features in the application.

## Secure Coding

- GitHub Actions should be written using pinned commit SHAs. Use this convention to pin the actions to commit SHAs: 
<action>@<commit-sha> # <version>

### Writing Tests

Focus on meaningful unit tests, not slop. Focus on fewer tests that fit an explicit purpose rather
than tests for the sake of blind code coverage.

Integration tests need to be clearly documented.
