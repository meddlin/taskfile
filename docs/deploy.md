# Deploying to npm

This is the runbook for cutting a release of `@rushinglabs/taskfile` and publishing it to npm so
it's installable via `npx @rushinglabs/taskfile`. The process below is manual by design — the goal
right now is a process that's *repeatable and correct*, not fully automated. See
[Future: automating this in CI](#future-automating-this-in-ci) for where this is headed later.

## Quick Reference

Already done this before and just need the commands? Replace `vX.Y.Z` with the real version
throughout (e.g. `v0.2.0`), and see [Release Process](#release-process) below for what each step
does and why.

```bash
# 1. Version bump PR
git checkout main && git pull
git checkout -b release/vX.Y.Z
npm version minor -m "chore: release v%s"   # patch|minor|major
git push -u origin release/vX.Y.Z
gh pr create --title "chore: release vX.Y.Z" --body "..."

# 2. Merge the PR on GitHub, then sync main locally
git checkout main && git pull

# 3. Tag the release and create the GitHub Release
git push origin vX.Y.Z
gh release create vX.Y.Z --generate-notes --title "vX.Y.Z"

# 4. Publish to npm
git checkout vX.Y.Z
npm ci
npm publish --dry-run --access public
npm publish --access public
git checkout main

# 5. Verify
npm view @rushinglabs/taskfile version
npx @rushinglabs/taskfile@latest --version
```

## Prerequisites (one-time setup)

These only need to happen once, before your first release:

1. **Create an npm account** at [npmjs.com](https://www.npmjs.com) if you don't already have one,
   and verify your email address — npm will not let you publish until it's verified.
2. **Enable two-factor authentication**: Account Settings → Two-Factor Authentication → Enable 2FA.
   A security key (WebAuthn — Touch ID, Face ID, Windows Hello, or a hardware key) is the strongest
   option; an authenticator app (TOTP) is the accessible alternative if you don't have one. Save the
   recovery codes it shows you — they're shown once.
3. **Get access to the `rushinglabs` npm scope.** `@rushinglabs/taskfile` is a *scoped* package —
   the `@rushinglabs` part has to be either your own npm username or an npm Organization you belong
   to. There's no CLI command to create an org (`npm org` only supports `set`/`rm`/`ls`), so this is
   done on the website:
   - If the `rushinglabs` org doesn't exist yet: click your profile picture (top right) → "Add an
     Organization" → name it `rushinglabs` → choose the **Free** plan.
   - If it already exists: whoever owns it adds you as a Member (or Admin) via the org's Members
     page, using your npm username.
   - This is free as long as everything published under the scope stays public — a paid Teams plan
     is only required for private packages, which doesn't apply here.
   - **This is completely separate from GitHub repository access.** Being a collaborator on the
     `taskfile` GitHub repo does not grant you npm publish rights, and vice versa.
4. **Authenticate this machine to npm**: run `npm login` and confirm it worked with `npm whoami`.
5. **Confirm `gh` is authenticated** for creating GitHub Releases: `gh auth status`.

`LICENSE` and `package.json`'s `publishConfig.access` are already set up in this repo — you don't
need to touch either as part of your first release.

## Key Concepts

### Scoped packages and public access

`@rushinglabs/taskfile` is a *scoped* package (the `@rushinglabs/` prefix). npm defaults every
scoped package to `restricted` (private) visibility, and publishing a restricted package requires a
paid plan. Since we want this public and free, `package.json` sets:

```json
"publishConfig": { "access": "public" }
```

This makes every `npm publish` public automatically, so you never need to remember a
`--access public` flag by hand. (Historically the rule was "only the *first* publish of a scoped
package needs `--access public`, since npm remembers it after that" — `publishConfig.access` just
makes that setting explicit and version-controlled instead of implicit and easy to forget.)

### Versioning (semver) in this repo

Standard [semver](https://semver.org/): `MAJOR.MINOR.PATCH`.

- **patch** — bug fixes, no behavior change (`0.1.0` → `0.1.1`)
- **minor** — backward-compatible additions, e.g. a new command or flag (`0.1.0` → `0.2.0`)
- **major** — breaking changes to CLI flags, output format, or behavior a script might depend on

The package currently sits at `0.1.0` and has never been published. We're staying on the `0.x` line
for the first publish (bumping to `0.2.0`) rather than jumping to `1.0.0` — `0.x` is semver's own
signal that the CLI's interface may still shift.

### `npm version` vs. git tags vs. npm dist-tags

These three all involve the word "tag" but are different things:

- **`npm version <patch|minor|major>`** is a local command. It edits `package.json` and
  `package-lock.json`, commits that change, and creates a local **git tag** (`vX.Y.Z` by default).
  Nothing is pushed or published by this command alone.
- **git tag** (`vX.Y.Z`) is a marker on a specific commit in the repo's history. This is what a
  GitHub Release is built from.
- **npm dist-tag** (e.g. `latest`) is a *registry-side* pointer that decides what
  `npm install @rushinglabs/taskfile` or `npx @rushinglabs/taskfile` resolves to when no version is
  specified. `npm publish` moves the `latest` dist-tag to the newly published version automatically.
  Inspect it with:

  ```bash
  npm dist-tag ls @rushinglabs/taskfile
  ```

### What `npm publish` actually does here

1. Runs the `prepublishOnly` script (`npm run build`, i.e. `tsc`), which produces `dist/`. This is
   why you don't need to build manually before publishing — but it also means publishing only makes
   sense from a clean checkout of the exact commit you intend to ship (see
   [step 5](#5-publish-to-npm) below).
2. Packs everything listed in `package.json`'s `files` field (`dist/`) plus the files npm always
   includes regardless of `files` — `package.json`, `README.md`, and `LICENSE` — into a tarball, and
   uploads it to the registry.
3. Publishes are **immutable per version** — you cannot overwrite `0.2.0` once it's published. You
   can only publish a new version, or `npm unpublish` within npm's 72-hour window (see
   [Troubleshooting](#troubleshooting)).
4. Authentication comes from `npm login`, which stores a token in your local `~/.npmrc`. Check who
   you're logged in as with `npm whoami`.

Note: `npm publish --provenance` (a Sigstore-backed attestation that ties a published package back
to the CI run that built it) exists, but requires a CI environment with OIDC support, like GitHub
Actions. It's not usable from a local, manual publish — see
[Future: automating this in CI](#future-automating-this-in-ci).

## Release Process

Each release follows the same six steps. Replace `X.Y.Z` with the real version throughout — for the
first release that's `0.2.0`.

### 1. Decide the version bump

Apply the semver rules above to decide patch/minor/major.

The CLI's `--version` output ([`src/index.ts`](../src/index.ts)) reads the version from
`package.json` at runtime, so it always matches whatever `npm version` just set — no separate file
to remember to update.

### 2. Open a version-bump PR

```bash
git checkout main && git pull
git checkout -b release/v0.2.0
npm version minor -m "chore: release v%s"   # edits package.json + lockfile, commits, tags locally as v0.2.0
git push -u origin release/v0.2.0            # push the branch only — do NOT push the tag yet
gh pr create --title "chore: release v0.2.0" --body "..."
```

Follow [AGENTS.md](../AGENTS.md)'s existing PR guidance for the description. In addition to that,
include:

- The version bump and why (patch/minor/major).
- A summary of what's shipping since the last release, e.g.:

  ```bash
  git log v0.1.0..HEAD --oneline
  ```

### 3. Merge the PR

Merge normally. `main` has no branch protection requiring review, but give it a self-review pass
before merging anyway — a release PR is a bad place for a typo to slip through.

This repo merges via merge commits (not squash), so the commit `npm version` created — and the
local `v0.2.0` tag pointing at it — remain valid ancestors of `main` after the merge. (If this repo
ever switches to squash-merge, the tag would need to be re-created against `main`'s tip after
merging instead of before.)

### 4. Tag the release and create a GitHub Release

```bash
git checkout main && git pull        # main now includes the release commit
git push origin v0.2.0               # push the tag created back in step 2
gh release create v0.2.0 --generate-notes --title "v0.2.0"
```

`--generate-notes` builds release notes from merged PR titles automatically — there's no
hand-maintained `CHANGELOG.md` to update.

### 5. Publish to npm

```bash
git checkout v0.2.0                      # publish exactly what's tagged, not whatever's in your working tree
npm ci
npm publish --dry-run --access public    # sanity check: lists exactly what would be published
npm publish --access public
git checkout main
```

The `--dry-run` first is worth doing every time — it shows you the full file list and package size
before anything actually goes to the registry. `--access public` is redundant with
`publishConfig.access` in `package.json`, but harmless to keep explicit.

### 6. Verify

```bash
npm view @rushinglabs/taskfile version
npm dist-tag ls @rushinglabs/taskfile
npx @rushinglabs/taskfile@latest --version
npx @rushinglabs/taskfile@latest list
```

The `--version` check confirms both that the published package resolves via `npx` and that it
reports the correct version, since that value is read from `package.json` at runtime.

## Troubleshooting

**Before publishing:**

- **`402` / "You must sign up for private packages"** — you forgot `--access public` and
  `publishConfig.access` isn't set (shouldn't happen now that it's in `package.json`, but relevant
  if that ever gets removed).
- **`403` / "you do not have permission to publish"** — you're not a member of the `rushinglabs` npm
  org. This is unrelated to GitHub repo access; see [Prerequisites](#prerequisites-one-time-setup).
- **"You cannot publish over the previously published version"** — the version in `package.json`
  wasn't actually bumped, or you're publishing from the wrong checkout.
- **`ENEEDAUTH`** — run `npm login` again; your local token expired or was never set.
- **OTP prompt** — if 2FA is set to require it on writes, pass it directly:
  `npm publish --otp=123456`.

**After publishing something broken:**

- **Deprecate it** (recommended first move) — warns anyone installing it, without removing it:

  ```bash
  npm deprecate @rushinglabs/taskfile@0.2.0 "Broken build, use 0.2.1 instead"
  ```

- **Unpublish it** — only possible within npm's 72-hour window after publishing, and subject to
  npm's unpublish policy (e.g. it may be restricted if other packages already depend on that
  version):

  ```bash
  npm unpublish @rushinglabs/taskfile@0.2.0
  ```

- In most cases, the simplest fix is to just ship a new patch version rather than trying to erase
  the broken one.

## Future: automating this in CI

The steps above are entirely manual on purpose for now. Once this process has been run a few times
by hand, it's a reasonable candidate to automate as a GitHub Actions workflow triggered on
`release: types: [published]` — using `actions/checkout` and `actions/setup-node` (with
`registry-url` set), `npm ci`, and `npm publish` (relying on `publishConfig.access`), authenticated
via an npm **Automation** token stored as a repo secret (automation tokens skip interactive
2FA/OTP prompts, unlike a personal token). Once publishing happens from GitHub Actions,
`npm publish --provenance` also becomes viable, since it needs the OIDC support CI provides. Any
actions used in that workflow should be pinned to commit SHAs, per the existing convention in
[AGENTS.md](../AGENTS.md)'s Secure Coding section. None of this is built yet — this section is a
pointer for later, not a description of anything that exists today.

## Related docs

- [AGENTS.md](../AGENTS.md) — commit message style and PR content expectations referenced above.
- [docs/index.md](./index.md) — feature/roadmap checklist, including the "Deploy to NPM" item this
  doc fulfills.
