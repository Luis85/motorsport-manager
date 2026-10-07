import fs from "node:fs";
import path from "node:path";

/**
 * Fixed sleeps make browser evidence slow and timing dependent. The reviewed allow-list records the
 * existing `waitForTimeout` count per file; a file may never exceed it, a new file may not add any,
 * and a lowered count must be recorded so the budget can only go down.
 */
export interface SleepAllowList { schemaVersion: 1; pattern: string; files: Record<string, number>; }

const SLEEP = /\bwaitForTimeout\s*\(/g;

/** Authored verification sources: browser/verification modules and Node test entry points. */
export function sleepScanFiles(sourceRoot: string): string[] {
  const files: string[] = [];
  const verification = path.join(sourceRoot, "verification");
  for (const name of fs.readdirSync(verification).sort())
    if (/\.(?:ts|cts)$/.test(name) && !name.endsWith(".d.ts")) files.push("verification/" + name);
  for (const name of fs.readdirSync(sourceRoot).sort())
    if (/^test-.*\.cts$/.test(name)) files.push(name);
  return files;
}

export function countSleeps(text: string): number {
  return text.match(SLEEP)?.length ?? 0;
}

/** Returns every policy problem; an empty list accepts the tree. */
export function assessSleeps(sourceRoot: string, allowList: SleepAllowList, files = sleepScanFiles(sourceRoot)): string[] {
  const problems: string[] = [];
  if (allowList.schemaVersion !== 1 || allowList.pattern !== "waitForTimeout") problems.push("Unsupported sleep allow-list");
  const scanned = new Set(files);
  for (const file of files) {
    const count = countSleeps(fs.readFileSync(path.join(sourceRoot, file), "utf8"));
    const allowed = allowList.files[file] ?? 0;
    if (count > allowed) problems.push(`${file}: ${count} waitForTimeout call(s); reviewed budget is ${allowed}. Wait for an explicit condition or use the Playwright clock helpers instead.`);
    else if (count < allowed) problems.push(`${file}: ${count} waitForTimeout call(s) but the allow-list still permits ${allowed}; lower it in sleep-allowlist.json so the budget only goes down.`);
  }
  for (const [file, allowed] of Object.entries(allowList.files)) {
    if (!Number.isSafeInteger(allowed) || allowed < 1) problems.push(`${file}: allow-list entries must be positive integers`);
    if (!scanned.has(file)) problems.push(`${file}: allow-list entry has no scanned source; remove it`);
  }
  return problems;
}
