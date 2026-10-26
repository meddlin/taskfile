// Builds the release artifacts: both macOS architectures, signed and notarized, verified, with
// checksums. The release workflow runs exactly this; run it locally to rehearse.
//
//   node scripts/release.mjs --tag desktop-v0.1.0     what CI runs
//   node scripts/release.mjs --unsigned               a test build; never publish the result
//
// Credentials come from the environment only (see electron-builder.yml).
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { APP_DIRS, checksumFile, hasDeveloperId, parseArgs, releaseAssetNames, signingProblems, tagVersion } from "./release-lib.mjs";

const desktopDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(desktopDir, "../..");
const releaseDir = path.join(desktopDir, "release");
const pkg = JSON.parse(fs.readFileSync(path.join(desktopDir, "package.json"), "utf8"));

function run(command, args, options = {}) {
  console.log(`\n$ ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, { stdio: "inherit", cwd: desktopDir, ...options });
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed (exit ${result.status})`);
}

function capture(command, args) {
  return spawnSync(command, args, { encoding: "utf8" }).stdout ?? "";
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log("Usage: node scripts/release.mjs [--tag desktop-vX.Y.Z] [--unsigned]");
    return;
  }
  if (process.platform !== "darwin") throw new Error("Release builds need macOS (codesign, notarytool, hdiutil).");

  if (options.tag && tagVersion(options.tag) !== pkg.version) {
    throw new Error(`Tag ${options.tag} doesn't match apps/desktop/package.json version ${pkg.version} (expected desktop-v${pkg.version}).`);
  }
  if (!options.unsigned) {
    const problems = signingProblems(process.env, {
      keychainHasIdentity: hasDeveloperId(capture("security", ["find-identity", "-v", "-p", "codesigning"])),
    });
    if (problems.length > 0) throw new Error(`Cannot sign:\n  - ${problems.join("\n  - ")}\nUse --unsigned for a test build.`);
  }

  fs.rmSync(releaseDir, { recursive: true, force: true });
  run("npm", ["run", "build", "-w", "@taskfile/web"], { cwd: repoRoot });
  run("npm", ["run", "build"]);
  run("npx", ["electron-builder", "--mac", "--arm64", "--x64", "--publish", "never", ...(options.unsigned ? ["-c.mac.identity=null"] : [])]);

  const apps = Object.entries(APP_DIRS).map(([arch, dir]) => ({ arch, app: path.join(releaseDir, dir, `${pkg.productName}.app`) }));
  for (const { arch, app } of apps) {
    if (!fs.existsSync(app)) throw new Error(`Expected ${app} for ${arch}; electron-builder did not produce it.`);
    if (!options.unsigned) {
      run("codesign", ["--verify", "--deep", "--strict", "--verbose=2", app]);
      run("spctl", ["--assess", "--type", "execute", "--verbose", app]);
      run("xcrun", ["stapler", "validate", app]);
    }
  }

  // The runner can only launch the architecture it is.
  const native = apps.find(({ arch }) => arch === process.arch);
  if (native) run("node", ["scripts/smoke.mjs", path.join(native.app, "Contents/MacOS", pkg.productName)]);

  const files = releaseAssetNames(fs.readdirSync(releaseDir));
  const entries = files
    .filter((name) => name !== "SHA256SUMS.txt")
    .map((name) => ({ name, sha256: createHash("sha256").update(fs.readFileSync(path.join(releaseDir, name))).digest("hex") }));
  fs.writeFileSync(path.join(releaseDir, "SHA256SUMS.txt"), checksumFile(entries));

  console.log(`\nBuilt ${pkg.productName} ${pkg.version}${options.unsigned ? " (UNSIGNED, do not publish)" : ""}:`);
  for (const name of releaseAssetNames(fs.readdirSync(releaseDir))) console.log(`  release/${name}`);
}

try {
  main();
} catch (error) {
  console.error(`\n${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
