import os from "node:os";

export interface PoolTask { kind: string; cost: number; exclusive?: string | undefined; }
export interface PoolOptions {
  /** Total concurrent tasks. 1 runs strictly in input order, reproducing the sequential gate. */
  jobs: number;
  /** Optional per-kind concurrency caps, e.g. { browser: 2 }. */
  limits?: Readonly<Record<string, number>>;
  /** Consulted before each dispatch; returning true stops new work while running tasks finish. */
  stop?: () => boolean;
}

/** Default total concurrency: leave one core to the orchestrator and Chromium helpers, never more than four. */
export function defaultJobs(cores = os.availableParallelism?.() ?? os.cpus().length): number {
  return Math.max(1, Math.min(4, cores - 1));
}

/**
 * Run tasks with bounded concurrency. With more than one job, exclusive tasks run first and alone
 * (nothing else starts until they finish), then the longest expected tasks start first (registry
 * order breaks ties) to shorten the critical path. Results are always returned
 * aligned with the input order, so reports never depend on completion order. Tasks that were never
 * started (after stop()) are undefined.
 */
export async function runPool<T extends PoolTask, R>(tasks: readonly T[], options: PoolOptions, run: (task: T, index: number) => Promise<R>): Promise<Array<R | undefined>> {
  if (!Number.isSafeInteger(options.jobs) || options.jobs < 1) throw new Error("Pool requires at least one job");
  const results = new Array<R | undefined>(tasks.length).fill(undefined);
  const pending = tasks.map((task, index) => ({ task, index }));
  if (options.jobs > 1) pending.sort((a, b) => Number(!!b.task.exclusive) - Number(!!a.task.exclusive) || b.task.cost - a.task.cost || a.index - b.index);
  const running = new Map<string, number>();
  let active = 0, exclusiveActive = false;
  return new Promise((resolve, reject) => {
    let failed = false;
    const dispatch = (): void => {
      if (failed) return;
      while (active < options.jobs && !exclusiveActive && !(options.stop?.() ?? false)) {
        // An exclusive task waits for an idle pool; while one waits at the head, nothing else starts.
        if (pending[0]?.task.exclusive && active > 0) break;
        const position = pending.findIndex(({ task }) => (running.get(task.kind) ?? 0) < (options.limits?.[task.kind] ?? Infinity));
        if (position < 0) break;
        const [{ task, index }] = pending.splice(position, 1) as [{ task: T; index: number }];
        if (task.exclusive) exclusiveActive = true;
        active++;
        running.set(task.kind, (running.get(task.kind) ?? 0) + 1);
        run(task, index).then(result => {
          results[index] = result;
          active--;
          if (task.exclusive) exclusiveActive = false;
          running.set(task.kind, running.get(task.kind)! - 1);
          dispatch();
        }, error => { failed = true; reject(error); });
      }
      if (active === 0) resolve(results);
    };
    dispatch();
  });
}
