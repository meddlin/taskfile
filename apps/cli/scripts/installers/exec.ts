import { spawnSync } from "node:child_process";

/** Runs a command to completion, streaming its output, and throws if it fails. */
export function run(
  command: string,
  args: string[],
  options: { cwd?: string; env?: NodeJS.ProcessEnv } = {},
): void {
  // Only npm on Windows, and the arguments are fixed build steps, never user input.
  // nosemgrep: opengrep-rules.javascript.lang.security.audit.spawn-shell-true
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    env: { ...process.env, ...options.env },
    stdio: "inherit",
    // npm is npm.cmd on Windows, which can only be launched through a shell.
    shell: process.platform === "win32" && command === "npm",
  });
  if (result.error) {
    throw new Error(`Failed to run ${command}: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} exited with status ${result.status}`);
  }
}

/** True when `command` can be launched (used to give a helpful error before a long build). */
export function commandExists(command: string): boolean {
  const probe = process.platform === "win32" ? "where" : "which";
  return spawnSync(probe, [command], { stdio: "ignore" }).status === 0;
}
