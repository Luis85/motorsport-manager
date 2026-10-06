import { spawn, spawnSync } from "node:child_process";

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

/** Result of an asynchronous bounded command; mirrors the fields of `spawnSync` that the gate reads. */
export interface AsyncCommandResult {
  status: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  error?: NodeJS.ErrnoException;
  pid?: number;
}

export interface AsyncCommandOptions {
  /** Complete child environment. Defaults to the parent environment. */
  env?: NodeJS.ProcessEnv;
  /** Per-stream retained output limit; overflow terminates the group like spawnSync's maxBuffer. */
  maxBuffer?: number;
  /** Also terminate any descendants left in the group after a successful exit (gate suites own their helpers). */
  reapGroup?: boolean;
}

function killGroup(pid: number | undefined): void {
  if (!pid) return;
  try {
    if (process.platform === "win32") process.kill(pid, "SIGKILL");
    else process.kill(-pid, "SIGKILL");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
  }
}

/**
 * Asynchronous counterpart of runCommand for the parallel gate. It keeps the same contract:
 * bounded wall time and output, retained stdout/stderr, ETIMEDOUT/ENOBUFS errors with SIGKILL,
 * and termination of the whole Unix process group so descendants cannot outlive a failure.
 */
export function runCommandAsync(command: readonly string[], root: string, timeoutSeconds: number, options: AsyncCommandOptions = {}): Promise<AsyncCommandResult> {
  if (!command.length || !Number.isFinite(timeoutSeconds) || timeoutSeconds <= 0) throw new Error("Command and a positive finite timeout are required");
  const maxBuffer = options.maxBuffer ?? 16 * 1024 * 1024;
  return new Promise(resolve => {
    const stdout: Buffer[] = [], stderr: Buffer[] = [];
    const sizes = { stdout: 0, stderr: 0 };
    let error: NodeJS.ErrnoException | undefined;
    let settled = false;
    const child = spawn(command[0] === "node" ? process.execPath : command[0]!, command.slice(1), {
      cwd: root, env: options.env ?? process.env, stdio: ["ignore", "pipe", "pipe"],
      detached: process.platform !== "win32"
    });
    const fail = (code: string, message: string): void => {
      if (error) return;
      error = Object.assign(new Error(message), { code });
      killGroup(child.pid);
    };
    const timer = setTimeout(() => fail("ETIMEDOUT", `spawn ${command[0]} ETIMEDOUT after ${timeoutSeconds}s`), timeoutSeconds * 1000);
    const collect = (name: "stdout" | "stderr", sink: Buffer[]) => (chunk: Buffer): void => {
      const room = maxBuffer - sizes[name];
      if (room > 0) sink.push(chunk.length > room ? chunk.subarray(0, room) : chunk);
      sizes[name] += chunk.length;
      if (sizes[name] > maxBuffer) fail("ENOBUFS", `${name} maxBuffer length exceeded`);
    };
    child.stdout.on("data", collect("stdout", stdout));
    child.stderr.on("data", collect("stderr", stderr));
    const finish = (status: number | null, signal: NodeJS.Signals | null): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      // A failed or timed-out leader may leave descendants in its group; always reap them.
      if (error || status !== 0 || options.reapGroup) killGroup(child.pid);
      const result: AsyncCommandResult = {
        status: error ? null : status, signal: error ? "SIGKILL" : signal,
        stdout: Buffer.concat(stdout).toString("utf8"), stderr: Buffer.concat(stderr).toString("utf8")
      };
      if (error) result.error = error;
      if (child.pid) result.pid = child.pid;
      resolve(result);
    };
    child.on("error", spawnError => { error ??= spawnError as NodeJS.ErrnoException; finish(null, null); });
    child.on("close", (status, signal) => finish(status, signal));
  });
}
