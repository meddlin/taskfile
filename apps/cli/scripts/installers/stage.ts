import { createHash } from "node:crypto";
import {
  chmodSync,
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { run } from "./exec.js";
import { Target, findChecksum, nodeArchive } from "./targets.js";

export interface StageContext {
  repoRoot: string;
  /** Scratch space for staged trees; wiped per build. */
  workDir: string;
  /** Downloaded Node.js archives; kept between builds. */
  cacheDir: string;
}

/**
 * Builds the platform-independent half of an installer once: compiled JS plus production-only
 * node_modules. The app has no native dependencies, so the same tree is used for every target.
 */
export function prepareAppPayload(ctx: StageContext): string {
  const payload = join(ctx.workDir, "app-payload");
  rmSync(payload, { recursive: true, force: true });
  mkdirSync(payload, { recursive: true });

  const dist = join(ctx.repoRoot, "dist");
  if (!existsSync(join(dist, "index.js"))) {
    throw new Error("dist/index.js not found. Run `npm run build` first (or omit --skip-compile).");
  }
  cpSync(dist, join(payload, "dist"), { recursive: true });
  // index.ts reads ../package.json at runtime for --version.
  copyFileSync(join(ctx.repoRoot, "package.json"), join(payload, "package.json"));

  // The lockfile lives at the workspace root and covers every workspace, so it can't be used with
  // this package.json alone; resolve production dependencies fresh (ranges come from package.json).
  run("npm", ["install", "--omit=dev", "--ignore-scripts", "--no-audit", "--no-fund", "--package-lock=false"], {
    cwd: payload,
  });

  // .bin holds symlinks the app never uses.
  rmSync(join(payload, "node_modules", ".bin"), { recursive: true, force: true });
  return payload;
}

/**
 * Lays out `<stage>/{app,runtime,LICENSE}` for one target: the shared payload plus that target's
 * Node.js binary. Packagers add the launcher and wrap the tree in the native format.
 */
export async function stageTarget(
  ctx: StageContext,
  payload: string,
  target: Target,
): Promise<string> {
  const stage = join(ctx.workDir, `${target.platform}-${target.arch}`);
  rmSync(stage, { recursive: true, force: true });
  mkdirSync(join(stage, "runtime"), { recursive: true });

  cpSync(payload, join(stage, "app"), { recursive: true });
  copyFileSync(join(ctx.repoRoot, "..", "..", "LICENSE"), join(stage, "LICENSE"));

  const archive = await downloadNode(ctx.cacheDir, target);
  extractNode(ctx, archive, target, join(stage, "runtime"));

  if (target.platform !== "windows") {
    normalizeModes(stage);
  }
  return stage;
}

async function downloadNode(cacheDir: string, target: Target): Promise<string> {
  const node = nodeArchive(target);
  mkdirSync(cacheDir, { recursive: true });
  const archivePath = join(cacheDir, node.fileName);

  const shasums = await (await fetchOk(node.checksumsUrl)).text();
  const expected = findChecksum(shasums, node.fileName);

  if (!existsSync(archivePath) || sha256(archivePath) !== expected) {
    console.log(`Downloading ${node.url}`);
    const body = Buffer.from(await (await fetchOk(node.url)).arrayBuffer());
    writeFileSync(archivePath, body);
  }
  const actual = sha256(archivePath);
  if (actual !== expected) {
    rmSync(archivePath, { force: true });
    throw new Error(`Checksum mismatch for ${node.fileName}: expected ${expected}, got ${actual}`);
  }
  return archivePath;
}

async function fetchOk(url: string): Promise<Response> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`GET ${url} failed: ${response.status} ${response.statusText}`);
  }
  return response;
}

function sha256(file: string): string {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

function extractNode(ctx: StageContext, archive: string, target: Target, runtimeDir: string): void {
  const node = nodeArchive(target);
  const extractDir = join(ctx.workDir, `node-extract-${target.platform}-${target.arch}`);
  rmSync(extractDir, { recursive: true, force: true });
  mkdirSync(extractDir, { recursive: true });

  if (archive.endsWith(".zip")) {
    if (process.platform === "win32") {
      run(
        "powershell.exe",
        ["-NoProfile", "-Command", "Expand-Archive -LiteralPath $env:ARCHIVE -DestinationPath $env:DEST -Force"],
        { env: { ARCHIVE: archive, DEST: extractDir } },
      );
    } else {
      run("unzip", ["-q", archive, "-d", extractDir]);
    }
  } else {
    run("tar", ["-xzf", archive, "-C", extractDir]);
  }

  const binaryName = target.platform === "windows" ? "node.exe" : "node";
  copyFileSync(join(extractDir, node.binaryPath), join(runtimeDir, binaryName));
  // Node's license (with its bundled third-party notices) must travel with redistributed binaries.
  const licenseSource = join(extractDir, node.binaryPath.split("/")[0], "LICENSE");
  copyFileSync(licenseSource, join(runtimeDir, "LICENSE"));
  rmSync(extractDir, { recursive: true, force: true });
}

/** Directories 0755, files 0644, the Node binary 0755 — independent of the build machine's umask. */
function normalizeModes(root: string): void {
  const walk = (dir: string): void => {
    chmodSync(dir, 0o755);
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) {
        walk(path);
      } else {
        chmodSync(path, 0o644);
      }
    }
  };
  walk(root);
  chmodSync(join(root, "runtime", "node"), 0o755);
}
