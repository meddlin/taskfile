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

/**
 * The name of the update feed electron-builder writes for a version: `latest-mac.yml` for a normal
 * release, `<id>-mac.yml` for a pre-release (1.0.0-rc.1 -> rc-mac.yml). Installed apps read it.
 */
export function updateFeedName(version) {
  const prerelease = /^\d+\.\d+\.\d+-([0-9A-Za-z-]+)/.exec(version);
  return `${prerelease ? prerelease[1] : "latest"}-mac.yml`;
}

/**
 * Checks the text of the update feed. It must name this version and a ZIP for every architecture
 * built: an app whose architecture is missing would silently never update. Returns the problems;
 * empty means it's good. Reads lines rather than parsing YAML: electron-builder writes the file in
 * one fixed shape, and this needs no dependency.
 */
export function checkUpdateFeed(text, version, arches, productName) {
  const problems = [];
  const feedVersion = /^version:\s*['"]?([^'"\s]+)['"]?\s*$/m.exec(text)?.[1];
  if (feedVersion !== version) problems.push(`The update feed says version ${feedVersion ?? "(none)"}, expected ${version}.`);
  const urls = [...text.matchAll(/^\s*(?:-\s+)?url:\s*['"]?([^'"\s]+)['"]?\s*$/gm)].map((match) => match[1]);
  for (const arch of arches) {
    const zip = `${productName}-${version}-${arch}.zip`;
    if (!urls.includes(zip)) problems.push(`The update feed doesn't list ${zip}; ${arch} Macs would never update.`);
  }
  if (!/^\s*sha512:\s*\S+/m.test(text)) problems.push("The update feed has no sha512 checksums.");
  return problems;
}

/** Files in release/ that go on the GitHub Release: the downloads, and the update feed with its blockmaps (small, differential updates). */
export function releaseAssetNames(files) {
  return files
    .filter((file) => /\.(dmg|zip|blockmap)$/.test(file) || /^[0-9A-Za-z-]+-mac\.yml$/.test(file) || file === "SHA256SUMS.txt")
    .sort();
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
