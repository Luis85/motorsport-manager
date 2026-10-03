import { spawnSync } from "node:child_process";

/** Bound execution and output, retain diagnostics, and terminate Unix child groups on failure. */
export function runCommand(command: readonly string[], root: string, timeoutSeconds: number, capture = true) {
  if (!command.length || !Number.isFinite(timeoutSeconds) || timeoutSeconds <= 0) throw new Error("Command and a positive finite timeout are required");
  const result = spawnSync(command[0] === "node" ? process.execPath : command[0]!, command.slice(1), {
    cwd: root, encoding: "utf8", timeout: timeoutSeconds * 1000,
    stdio: capture ? "pipe" : "inherit", env: process.env,
    maxBuffer: 16 * 1024 * 1024, killSignal: "SIGKILL",
    // Node uses shared spawn normalization for sync calls; older Node type declarations omit detached here.
    ...{ detached: process.platform !== "win32" }
  });
  if (result.error && result.pid && process.platform !== "win32") {
    try { process.kill(-result.pid, "SIGKILL"); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error; }
  }
  return result;
}
