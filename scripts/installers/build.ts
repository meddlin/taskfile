import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { run } from "./exec.js";
import { packageDeb } from "./package-deb.js";
import { packageMacos } from "./package-macos.js";
import { packageWindows } from "./package-windows.js";
import { prepareAppPayload, stageTarget, StageContext } from "./stage.js";
import { Target, artifactName, parseArgs } from "./targets.js";

/**
 * Builds native installers for the current checkout.
 *
 *   npm run installers -- [--platform macos|linux|windows] [--arch x64|arm64|all] [--skip-compile]
 *
 * Output lands in release/. Each platform's installer can only be assembled on a matching host
 * (macOS: pkgbuild, Linux: dpkg-deb, Windows: Inno Setup); architectures can be cross-built since
 * only the bundled Node.js binary differs.
 */
async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const repoRoot = resolve(fileURLToPath(import.meta.url), "../../..");
  const { version } = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8")) as {
    version: string;
  };

  const releaseDir = join(repoRoot, "release");
  const ctx: StageContext = {
    repoRoot,
    workDir: join(releaseDir, ".work"),
    cacheDir: join(releaseDir, ".cache"),
  };
  mkdirSync(releaseDir, { recursive: true });
  rmSync(ctx.workDir, { recursive: true, force: true });

  if (!options.skipCompile) {
    run("npm", ["run", "build"], { cwd: repoRoot });
  }
  const payload = prepareAppPayload(ctx);

  for (const arch of options.arches) {
    const target: Target = { platform: options.platform, arch };
    const outFile = join(releaseDir, artifactName(target, version));
    console.log(`\n==> ${outFile}`);

    const stage = await stageTarget(ctx, payload, target);
    switch (target.platform) {
      case "macos":
        packageMacos(stage, ctx.workDir, outFile, version);
        break;
      case "linux":
        packageDeb(stage, ctx.workDir, outFile, version, arch);
        break;
      case "windows":
        packageWindows(stage, outFile, version);
        break;
    }
  }

  rmSync(ctx.workDir, { recursive: true, force: true });
  console.log(`\nDone. Installers are in ${releaseDir}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
