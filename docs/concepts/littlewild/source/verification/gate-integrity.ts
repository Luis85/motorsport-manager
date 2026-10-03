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

export function parseGateArgs(args: readonly string[]): { noBrowser: boolean; help: boolean } {
  if (args.length === 0) return { noBrowser: false, help: false };
  if (args.length === 1 && args[0] === "--no-browser") return { noBrowser: true, help: false };
  if (args.length === 1 && ["--help", "-h"].includes(args[0]!)) return { noBrowser: false, help: true };
  throw new Error("Usage: npm run verify -- [--no-browser | --help]");
}
