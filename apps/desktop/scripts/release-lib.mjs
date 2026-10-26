// Pure helpers for scripts/release.mjs. Nothing here touches the disk or the network, so the
// tests can cover it without a Mac, a certificate or Apple.

export const TAG_PREFIX = "desktop-v";

// The CLI's installers use plain v* tags; the desktop app has its own prefix so the two never
// trigger each other's workflows.
/** "desktop-v1.2.3" -> "1.2.3". Null if the tag isn't a desktop release tag. */
export function tagVersion(tag) {
  if (typeof tag !== "string" || !tag.startsWith(TAG_PREFIX)) return null;
  const version = tag.slice(TAG_PREFIX.length);
  return /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version) ? version : null;
}

/** A version with a "-" suffix (1.2.3-beta.1) is published as a GitHub pre-release. */
export function isPrerelease(version) {
  return version.includes("-");
}

/** electron-builder's output folder for each architecture (x64 has no suffix). */
export const APP_DIRS = { arm64: "mac-arm64", x64: "mac" };

/** The notarization variables electron-builder reads; all three must be set to notarize. */
export const NOTARIZATION_VARS = ["APPLE_API_KEY", "APPLE_API_KEY_ID", "APPLE_API_ISSUER"];

/**
 * What a signed release is still missing, given the environment. A runner has CSC_LINK; a Mac with
 * the certificate in its login keychain doesn't need it, so `keychainHasIdentity` says whether it
 * does. Returns problems; empty means good to go.
 */
export function signingProblems(env, { keychainHasIdentity }) {
  const problems = [];
  if (!env.CSC_LINK && !keychainHasIdentity) {
    problems.push("No signing certificate: set CSC_LINK (base64 .p12) or install a Developer ID Application identity in your keychain.");
  }
  for (const name of NOTARIZATION_VARS) {
    if (!env[name]) problems.push(`${name} is not set, so the build would be signed but not notarized.`);
  }
  return problems;
}

/** Whether `security find-identity -v -p codesigning` output lists a Developer ID Application identity. */
export function hasDeveloperId(output) {
  return /^\s*\d+\)\s+[0-9A-F]{40}\s+"Developer ID Application:/m.test(output);
}

/** The SHA256SUMS.txt body, in the format `shasum -a 256` writes and `shasum -c` reads. */
export function checksumFile(entries) {
  return entries.map(({ name, sha256 }) => `${sha256}  ${name}\n`).join("");
}

/** Files in release/ that go on the GitHub Release. (The .blockmap files only matter to an auto-updater, which the app doesn't have.) */
export function releaseAssetNames(files) {
  return files.filter((file) => /\.(dmg|zip)$/.test(file) || file === "SHA256SUMS.txt").sort();
}

/** @returns {{tag: string | null, unsigned: boolean, help: boolean}} */
export function parseArgs(argv) {
  const options = { tag: null, unsigned: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--") continue;
    if (arg === "--help" || arg === "-h") options.help = true;
    else if (arg === "--unsigned") options.unsigned = true;
    else if (arg === "--tag") {
      const value = argv[++i];
      if (value === undefined || value.startsWith("--")) throw new Error("--tag needs a value");
      options.tag = value;
    } else if (arg.startsWith("--tag=")) options.tag = arg.slice("--tag=".length);
    else throw new Error(`Unknown option: ${arg}`);
  }
  if (options.tag !== null && tagVersion(options.tag) === null) {
    throw new Error(`--tag must look like ${TAG_PREFIX}1.2.3, got "${options.tag}"`);
  }
  return options;
}
