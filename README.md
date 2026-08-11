# Taskfile

A simple todo list CLI, runnable via `npx`.

## Usage

```bash
npx @rushinglabs/taskfile add "Buy milk"
npx @rushinglabs/taskfile list
npx @rushinglabs/taskfile remove 1
```

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
