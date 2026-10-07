import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

/** Count only explicit, independently named successful checks. Summary claims are insufficient. */
export function acceptedCounts(data: unknown): { passed: number; total: number } {
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Result must be an object");
  const report = data as Record<string, unknown>;
  if (!Array.isArray(report.results) || report.results.length === 0) throw new Error("Result must contain nonempty check evidence");
  const names = new Set<string>();
  for (const row of report.results) {
    if (!row || typeof row !== "object" || Array.isArray(row)) throw new Error("Malformed check evidence");
    const check = row as Record<string, unknown>;
    if (typeof check.name !== "string" || !check.name.trim() || names.has(check.name)) throw new Error("Missing or duplicate check identity");
    if (check.passed !== true) throw new Error(`Check did not explicitly pass: ${check.name}`);
    if (Object.hasOwn(check, "error")) throw new Error(`Successful check contains an error: ${check.name}`);
    names.add(check.name);
  }
  const total = report.results.length;
  if (report.passed !== total || report.total !== total) throw new Error("Summary counts do not match check evidence");
  if (Object.hasOwn(report, "failed") && report.failed !== 0) throw new Error("Invalid failed count");
  return { passed: total, total };
}

/** Include paths as well as bytes so renames, deletion, and data edits invalidate evidence. */
export function sourceIdentity(root: string): string {
  const hash = crypto.createHash("sha256");
  function visit(relative: string): void {
    const canonical = relative.replaceAll(path.sep, "/");
    if (/^source\/[^/]+-results\.json$/.test(canonical)) return;
    const full = path.join(root, relative);
    const stat = fs.lstatSync(full);
    if (stat.isSymbolicLink()) throw new Error(`Verification input must not be a symlink: ${relative}`);
    if (stat.isDirectory()) {
      for (const name of fs.readdirSync(full).sort()) visit(path.join(relative, name));
    } else if (stat.isFile()) {
      const bytes = fs.readFileSync(full);
      hash.update(canonical + "\0" + bytes.length + "\0");
      hash.update(new Uint8Array(bytes));
    }
  }
  const compilerConfigs=fs.readdirSync(root).filter(name=>/^tsconfig.*\.json$/.test(name)).sort();
  for(const required of ["tsconfig.json","tsconfig.strict.json"])
    if(!compilerConfigs.includes(required))throw new Error(`Required compiler configuration is missing: ${required}`);
  for (const input of ["source", "vendor", "examples", "package.json", "package-lock.json", ...compilerConfigs]) visit(input);
  return hash.digest("hex");
}

export type GateTier = "fast" | "full";
export interface VerifyOptions {
  noBrowser: boolean;
  help: boolean;
  /** Total concurrent suites; undefined selects the host default. */
  jobs?: number;
  /** Maximum concurrent browser suites; undefined selects the host default. */
  browserJobs?: number;
  tier: GateTier;
  /** One-based shard index and shard count. */
  shard?: { index: number; count: number };
  only?: string[];
  keepGoing: boolean;
}

export const VERIFY_USAGE = [
  "Usage: npm run verify -- [options | --help]",
  "  --no-browser        omit browser suites (partial evidence only)",
  "  --jobs N            total concurrent suites (default min(4, cores-1); 1 = sequential registry order)",
  "  --browser-jobs N    concurrent browser suites (default min(2, jobs))",
  "  --tier fast|full    registry tier to run (default full; fast is partial evidence)",
  "  --shard I/N         run the I-th of N deterministic duration-balanced shards (partial evidence)",
  "  --only a,b          run only the named registered suites (partial evidence)",
  "  --keep-going        keep running remaining suites after a failure"
].join("\n");

const positive = (flag: string, text: string | undefined, maximum: number): number => {
  if (text === undefined || !/^[1-9][0-9]*$/.test(text) || Number(text) > maximum) throw new Error(`${flag} requires an integer from 1 to ${maximum}\n${VERIFY_USAGE}`);
  return Number(text);
};

/** Strict gate option parser: unknown, repeated or malformed flags are rejected before any evidence changes. */
export function parseVerifyArgs(args: readonly string[]): VerifyOptions {
  const options: VerifyOptions = { noBrowser: false, help: false, tier: "full", keepGoing: false };
  if (args.length === 1 && ["--help", "-h"].includes(args[0]!)) return { ...options, help: true };
  const seen = new Set<string>();
  for (let index = 0; index < args.length; index++) {
    const raw = args[index]!;
    const equals = raw.startsWith("--") ? raw.indexOf("=") : -1;
    const flag = equals > 0 ? raw.slice(0, equals) : raw;
    const takesValue = ["--jobs", "--browser-jobs", "--tier", "--shard", "--only"].includes(flag);
    if (seen.has(flag)) throw new Error(`Repeated option ${flag}\n${VERIFY_USAGE}`);
    seen.add(flag);
    let value: string | undefined;
    if (takesValue) value = equals > 0 ? raw.slice(equals + 1) : args[++index];
    else if (equals > 0) throw new Error(`Option ${flag} takes no value\n${VERIFY_USAGE}`);
    switch (flag) {
      case "--no-browser": options.noBrowser = true; break;
      case "--keep-going": options.keepGoing = true; break;
      case "--jobs": options.jobs = positive(flag, value, 64); break;
      case "--browser-jobs": options.browserJobs = positive(flag, value, 64); break;
      case "--tier":
        if (value !== "fast" && value !== "full") throw new Error(`--tier requires fast or full\n${VERIFY_USAGE}`);
        options.tier = value; break;
      case "--shard": {
        const match = /^([1-9][0-9]*)\/([1-9][0-9]*)$/.exec(value ?? "");
        if (!match || Number(match[1]) > Number(match[2]) || Number(match[2]) > 64) throw new Error(`--shard requires I/N with 1 <= I <= N <= 64\n${VERIFY_USAGE}`);
        options.shard = { index: Number(match[1]), count: Number(match[2]) }; break;
      }
      case "--only": {
        const names = (value ?? "").split(",");
        if (!value || value.startsWith("--") || names.some(name => !/^[a-z0-9][a-z0-9-]*$/.test(name)) || new Set(names).size !== names.length)
          throw new Error(`--only requires a comma-separated list of distinct suite names\n${VERIFY_USAGE}`);
        options.only = names; break;
      }
      default: throw new Error(`Unknown option ${raw}\n${VERIFY_USAGE}`);
    }
  }
  return options;
}

/** The original two-flag contract, retained as a projection of the complete option parser. */
export function parseGateArgs(args: readonly string[]): { noBrowser: boolean; help: boolean } {
  const { noBrowser, help } = parseVerifyArgs(args);
  return { noBrowser, help };
}
