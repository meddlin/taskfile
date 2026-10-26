# Releasing the desktop app

Step-by-step setup for tag-driven, signed, **approval-gated** releases of the Electron app in
[`apps/desktop`](../apps/desktop), the same pipeline the `composition` project uses
(`desktop-v*` tag, macOS runner, Developer ID signing, notarization, secrets in a GitHub
Environment) with one change you asked for: **nothing reaches the GitHub Releases page until you
approve it.**

Do Part 1 and Part 2 once. Part 3 is what you do for every release.

## How a release flows

```
git push origin desktop-v0.1.0
        │
        ▼
 verify-tag   (Linux)   tag == apps/desktop version, commit is on main, tests pass
        │
        ▼
 build        (macOS)   environment: release          ← holds the signing secrets
        │               builds arm64 + x64, signs, notarizes, verifies, smoke-tests
        │               uploads the DMGs/ZIPs as a workflow artifact (private, 14 days)
        ▼
 publish      (Linux)   environment: release-publish  ← required reviewer: YOU
                        waits for your approval, then creates the GitHub Release
```

The approval is GitHub's *required reviewers* rule on the `release-publish` environment. While the
run waits you can download the `desktop-release` artifact from the run page and try the app. Click
**Reject** and nothing is published; the artifact expires on its own.

The workflow is [`.github/workflows/release-desktop.yml`](../.github/workflows/release-desktop.yml). It
runs [`apps/desktop/scripts/release.mjs`](../apps/desktop/scripts/release.mjs), which you can also run
on your Mac.

## What differs from `composition`

| | composition | taskfile |
|---|---|---|
| Trigger | `desktop-v*` tag | `desktop-v*` tag (the CLI's installers use plain `v*`, so they never collide) |
| Approval | Optional reviewers on the `release` environment (gate *before* the build), then you publish a **draft** by hand | Required reviewer on a separate `release-publish` environment, gating *publish*. No draft step: approving creates the release |
| Package manager | pnpm, one lockfile per app | npm workspaces, one root `package-lock.json` |
| Bundled extras | Meilisearch, a Node runtime, the CLI | None. The web app's server is bundled into the app |
| Auto-update | `electron-updater` + `latest-mac.yml` from "latest release" | `electron-updater`, but the app picks the newest `desktop-v*` release itself (this repo also publishes CLI releases), with an opt-in for pre-releases: [desktop-updates.md](desktop-updates.md) |
| Platforms | macOS | macOS (Apple Silicon and Intel) |

---

## Part 1: Apple credentials (one time)

You need a paid Apple Developer Program membership. **If you already did this for `composition`, reuse
the same certificate and the same API key**: both belong to your Apple account, not to a project.
Skip to step 1.3 and 1.5 only to re-export or re-find them.

### 1.1 Developer ID Application certificate

Follow [composition's guide, section 1](https://github.com/meddlin/composition/blob/main/docs/deployment/manual-build-release.md#1-get-and-install-the-signing-certificate-one-time).
In short: Keychain Access → Certificate Assistant → *Request a Certificate From a Certificate
Authority* → save the CSR; developer.apple.com → Certificates → **+** → *Developer ID Application*;
upload the CSR; download the `.cer`; import it into the **login** keychain. Check:

```bash
security find-identity -v -p codesigning
```

It must list `Developer ID Application: <you> (<TEAMID>)`.

### 1.2 Notarization API key

App Store Connect → Users and Access → Integrations → Team Keys → **+**, role **Developer**. Download
the `.p8` (Apple lets you download it once), and note the **Key ID** and the **Issuer ID**. Keep the
`.p8` outside the repository, for example in `~/.private_keys/`.

### 1.3 Export the certificate as a `.p12`

A runner has no login keychain, so the certificate travels as a file. In Keychain Access open
**login → My Certificates**, right-click *Developer ID Application: …* → **Export**, save it as
`DeveloperID.p12` and set a strong password. Exporting from *My Certificates* includes the private
key; without it nothing can sign.

### 1.4 Rehearse locally (optional, recommended)

An unsigned dry run proves the build and packaging work before you involve GitHub:

```bash
npm install
npm run release -w @taskfile/desktop -- --unsigned
```

It builds both architectures into `apps/desktop/release/` and smoke-tests the app. **Never publish an
unsigned build.** For a signed local run, export `APPLE_API_KEY` (path to the `.p8`),
`APPLE_API_KEY_ID` and `APPLE_API_ISSUER`, and run it without `--unsigned`; electron-builder uses the
identity in your login keychain.

---

## Part 2: GitHub setup (one time)

All commands assume [`gh`](https://cli.github.com) is signed in with admin rights on
`meddlin/taskfile` (`gh auth status`). The repository is public, so required reviewers are available
on the free plan. (On a private repository they need a paid plan.)

### 2.1 Create the `release` environment (holds the secrets)

UI: **Settings → Environments → New environment → `release`**. Under *Deployment branches and tags*
choose **Selected branches and tags**, then **Add deployment branch or tag rule**, set the type to
**Tag** and the name pattern to `desktop-v*`. This makes the signing secrets unreachable from any
branch, pull request or other tag.

Or with the CLI:

```bash
echo '{"deployment_branch_policy":{"protected_branches":false,"custom_branch_policies":true}}' |
  gh api -X PUT repos/meddlin/taskfile/environments/release --input -
gh api -X POST repos/meddlin/taskfile/environments/release/deployment-branch-policies \
  -f name='desktop-v*' -f type=tag
```

Do **not** add required reviewers here: approval happens at the publish step (2.3), after the build
has produced something you can look at.

### 2.2 Add the five secrets to `release`

Run from the directory with your files. Each command targets the environment, not the repository:

```bash
base64 -i DeveloperID.p12 | gh secret set CSC_LINK --env release --repo meddlin/taskfile
gh secret set CSC_KEY_PASSWORD --env release --repo meddlin/taskfile   # prompts: the .p12 password
gh secret set APPLE_API_KEY_P8 --env release --repo meddlin/taskfile < ~/.private_keys/AuthKey_XXXXXXXXXX.p8
gh secret set APPLE_API_KEY_ID --env release --repo meddlin/taskfile   # prompts: the Key ID
gh secret set APPLE_API_ISSUER --env release --repo meddlin/taskfile   # prompts: the Issuer ID
```

| Secret | What it is |
|---|---|
| `CSC_LINK` | The base64 of the `.p12` (certificate and private key) |
| `CSC_KEY_PASSWORD` | The password you set when exporting the `.p12` |
| `APPLE_API_KEY_P8` | The **contents** of the `.p8`. The workflow writes it to a temp file for `notarytool` and deletes it afterwards |
| `APPLE_API_KEY_ID` | The API key's Key ID |
| `APPLE_API_ISSUER` | The Issuer ID |

Then delete `DeveloperID.p12` from disk, or move it into your password manager. Check with
`gh secret list --env release --repo meddlin/taskfile`.

### 2.3 Create the `release-publish` environment (the approval gate)

UI: **Settings → Environments → New environment → `release-publish`**, tick **Required reviewers**,
add yourself, and save. Leave *Prevent self-review* **unticked**: you are the only person who pushes
tags, and ticking it would stop you approving your own release. Also set the same
`desktop-v*` tag rule as in 2.1.

Or with the CLI (this adds you as the reviewer):

```bash
echo '{"reviewers":[{"type":"User","id":'"$(gh api user --jq .id)"'}],"deployment_branch_policy":{"protected_branches":false,"custom_branch_policies":true}}' |
  gh api -X PUT repos/meddlin/taskfile/environments/release-publish --input -
gh api -X POST repos/meddlin/taskfile/environments/release-publish/deployment-branch-policies \
  -f name='desktop-v*' -f type=tag
```

This environment needs no secrets: the publish job uses the built-in `GITHUB_TOKEN`.

### 2.4 Turn on notifications so you notice the approval request

GitHub emails reviewers when a deployment is waiting. Check **github.com → Settings → Notifications →
Actions** if you don't get them. You can also approve from the GitHub mobile app.

### 2.5 Merge this change to `main`

The workflow only runs from a tag, and the tag must point at a commit on `main`, so merge the pull
request that adds `apps/desktop` and the workflows first.

---

## Part 3: Cut a release (every time)

1. **Pick the version** and set `"version"` in `apps/desktop/package.json` (for example `0.1.0`). Open a
   pull request, let CI pass, merge it to `main`. (The *Package desktop* check runs on pull requests that
   touch the desktop or web app, so a broken bundle shows up here, not at release time.)
2. **Tag that commit on `main` and push only that tag:**

   ```bash
   git checkout main && git pull
   git tag desktop-v0.1.0
   git push origin desktop-v0.1.0
   ```

   Do not use `git push --tags`: it pushes every local tag, and any `desktop-v*` among them starts a
   release. A `-` suffix (`desktop-v0.2.0-beta.1`) makes the release a pre-release.
3. **Watch it:** `gh run watch`, or the *Actions* tab. `verify-tag` fails fast if the tag doesn't match
   `package.json` or isn't on `main`. `build` takes about 10 to 20 minutes, mostly notarization.
4. **Try the build.** When `build` is green the run shows *Waiting for review*. Open the run page,
   download the **desktop-release** artifact, unzip it, open the DMG on a Mac that has not built the
   app, drag Taskfile to Applications, and check that it opens without a Gatekeeper warning and shows
   your tasks.
5. **Approve or reject.** On the run page click **Review deployments**, tick `release-publish`, and
   choose **Approve and deploy**. The `publish` job then creates the GitHub Release (`Taskfile desktop
   0.1.0`) with both DMGs, both ZIPs, the update feed (`latest-mac.yml`) with its blockmaps, and `SHA256SUMS.txt`, plus generated notes. **Approving is also what offers the release to installed apps as an update** (a pre-release version only reaches people who ticked *include pre-release versions*). **Reject** leaves
   nothing public.
6. **Check the Releases page:** `gh release view desktop-v0.1.0 --web`.

### When something goes wrong

| Symptom | What to do |
|---|---|
| `verify-tag` fails on the version | The tag and `apps/desktop/package.json` disagree. Delete the tag (below), fix the version on `main`, tag again |
| `verify-tag` fails on "not on main" | Merge first, then tag |
| `build` says it was not authorized to use the environment | The tag doesn't match the `desktop-v*` rule in 2.1, or the environment name differs from `release` |
| `build` fails in **Cannot sign** | A secret is missing or empty: `gh secret list --env release` |
| Notarization is rejected | The log names the binary. Fetch it with `xcrun notarytool log <id>` ([commands](https://github.com/meddlin/composition/blob/main/docs/deployment/manual-build-release.md#notarization-failed-or-was-rejected-how-do-i-see-why)) |
| `build` fails for a transient reason | **Re-run failed jobs** on the run page |
| You rejected, or want to redo a release | Delete the tag and run, then tag again (below) |
| A published release is bad | `gh release delete desktop-v0.1.0 --cleanup-tag --yes`, then ship `0.1.1` with the fix. Do not reuse a version that was ever public |

Deleting a tag you pushed by mistake:

```bash
git push origin :refs/tags/desktop-v0.1.0
git tag -d desktop-v0.1.0
```

## Notes

- **Not yet run on GitHub.** The workflow is parsed, linted for pinned actions, and its build script
  has been run end to end unsigned. Signing, notarization and the approval gate are untested until
  your first real tag, so expect to fix one small thing. A good first run is a pre-release tag such as
  `desktop-v0.1.0-rc.1` (set that version in `package.json` first).
- **The app identifier** `com.rushinglabs.taskfile` ([`electron-builder.yml`](../apps/desktop/electron-builder.yml))
  is part of the code signature. Confirm it before the first public release; changing it later
  orphans existing installs.
- **Actions are pinned to commit SHAs** (see [AGENTS.md](../AGENTS.md)). Keep that when editing the workflow.
- **Update files:** leave `*-mac.yml` and the `.blockmap` files attached to the release; installed apps read them ([desktop-updates.md](desktop-updates.md)).
- **Windows and Linux** builds are not part of this pipeline; the macOS signing identity doesn't apply to them.
