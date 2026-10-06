import fs from "node:fs";
import path from "node:path";
import type { GateTier } from "./gate-integrity";

/** One registered verification suite. The registry file is data; this module only validates and selects. */
export interface RegisteredSuite {
  name: string;
  kind: "node" | "browser";
  /** fast suites form `npm test`; full contains every suite. */
  tier: GateTier;
  /** Compiled entry point relative to the Wildlands project root. */
  entry: string;
  /** Pinned evidence file relative to the project root; CI and reviewers read this exact path. */
  result: string;
  /** Hard wall-clock budget in seconds. */
  timeout: number;
  /** Observed sequential seconds on the reference host; a scheduling hint only, never an assertion. */
  cost: number;
  /** Reason the suite must run alone (e.g. it rebuilds shared .generated output in place). */
  exclusive?: string;
}

export interface SuiteSelection {
  tier: GateTier;
  noBrowser: boolean;
  only?: readonly string[] | undefined;
  shard?: { index: number; count: number } | undefined;
}

const NAME = /^[a-z0-9][a-z0-9-]*$/;
const relative = (value: unknown): value is string => typeof value === "string" && value.length > 0
  && !path.isAbsolute(value) && !value.includes("\\") && !value.split("/").some(part => part === ".." || part === "" || part === ".");

/** Validate the complete registry document; every defect is reported, and any defect rejects it. */
export function validateRegistry(data: unknown): RegisteredSuite[] {
  const problems: string[] = [];
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Suite registry must be an object");
  const document = data as Record<string, unknown>;
  if (document.schemaVersion !== 1) problems.push("schemaVersion must be 1");
  if (!Array.isArray(document.suites) || document.suites.length === 0) throw new Error("Suite registry requires a nonempty suites array");
  const names = new Set<string>(), results = new Set<string>(), entries = new Set<string>();
  const suites: RegisteredSuite[] = [];
  document.suites.forEach((row: unknown, index: number) => {
    const where = `suites[${index}]`;
    if (!row || typeof row !== "object" || Array.isArray(row)) { problems.push(`${where} must be an object`); return; }
    const suite = row as Record<string, unknown>;
    const extra = Object.keys(suite).filter(key => !["name", "kind", "tier", "entry", "result", "timeout", "cost", "exclusive"].includes(key));
    if (extra.length) problems.push(`${where} has unknown fields ${extra.join(", ")}`);
    if (typeof suite.name !== "string" || !NAME.test(suite.name)) problems.push(`${where}.name is invalid`);
    else if (names.has(suite.name)) problems.push(`Duplicate suite name ${suite.name}`);
    else names.add(suite.name);
    if (suite.kind !== "node" && suite.kind !== "browser") problems.push(`${where}.kind must be node or browser`);
    if (suite.tier !== "fast" && suite.tier !== "full") problems.push(`${where}.tier must be fast or full`);
    if (suite.tier === "fast" && suite.kind !== "node") problems.push(`${where} browser suites cannot be in the fast tier`);
    if (!relative(suite.entry) || !suite.entry.startsWith(".generated/") || !/\.c?js$/.test(suite.entry)) problems.push(`${where}.entry must be a compiled .generated/ script`);
    else if (entries.has(suite.entry)) problems.push(`Duplicate suite entry ${suite.entry}`);
    else entries.add(suite.entry);
    if (!relative(suite.result) || !suite.result.endsWith(".json")) problems.push(`${where}.result must be a bounded relative JSON path`);
    else if (results.has(suite.result)) problems.push(`Duplicate result path ${suite.result}`);
    else results.add(suite.result);
    if (!Number.isSafeInteger(suite.timeout) || (suite.timeout as number) < 1 || (suite.timeout as number) > 3600) problems.push(`${where}.timeout must be 1..3600 seconds`);
    if (typeof suite.cost !== "number" || !Number.isFinite(suite.cost) || suite.cost <= 0 || suite.cost > (suite.timeout as number)) problems.push(`${where}.cost must be positive and within its timeout`);
    if (suite.exclusive !== undefined && (typeof suite.exclusive !== "string" || !suite.exclusive.trim())) problems.push(`${where}.exclusive must state why the suite cannot share the host`);
    suites.push(suite as unknown as RegisteredSuite);
  });
  if (problems.length) throw new Error("Invalid suite registry:\n" + problems.join("\n"));
  return suites;
}

export function loadRegistry(file: string): RegisteredSuite[] {
  return validateRegistry(JSON.parse(fs.readFileSync(file, "utf8")));
}

/** True only when the selection is the whole registered gate. */
export function isCompleteSelection(selection: SuiteSelection): boolean {
  return selection.tier === "full" && !selection.noBrowser && !selection.only && !selection.shard;
}

/**
 * Partition suites into duration-balanced shards. Longest-processing-time assignment with registry
 * order as the tie-breaker is deterministic, covers every suite exactly once and needs no clock.
 */
export function shardSuites<T extends { cost: number }>(suites: readonly T[], count: number): T[][] {
  const shards: T[][] = Array.from({ length: count }, () => []);
  const load = new Array<number>(count).fill(0);
  const order = suites.map((suite, index) => ({ suite, index })).sort((a, b) => b.suite.cost - a.suite.cost || a.index - b.index);
  const assigned = new Map<T, number>();
  for (const { suite } of order) {
    let target = 0;
    for (let shard = 1; shard < count; shard++) if (load[shard]! < load[target]!) target = shard;
    load[target]! += suite.cost;
    assigned.set(suite, target);
  }
  for (const suite of suites) shards[assigned.get(suite)!]!.push(suite);
  return shards;
}

/** Select suites in registry order. Unknown or excluded --only names are rejected rather than ignored. */
export function selectSuites(registry: readonly RegisteredSuite[], selection: SuiteSelection): RegisteredSuite[] {
  const byName = new Map(registry.map(suite => [suite.name, suite]));
  for (const name of selection.only ?? []) {
    const suite = byName.get(name);
    if (!suite) throw new Error(`Unknown suite in --only: ${name}`);
    if (selection.noBrowser && suite.kind === "browser") throw new Error(`--only names browser suite ${name} but --no-browser excludes it`);
    if (selection.tier === "fast" && suite.tier !== "fast") throw new Error(`--only names ${name}, which is not in the fast tier`);
  }
  let selected = registry.filter(suite => (selection.tier === "full" || suite.tier === "fast") && !(selection.noBrowser && suite.kind === "browser"));
  if (selection.only) selected = selected.filter(suite => selection.only!.includes(suite.name));
  if (selection.shard) selected = shardSuites(selected, selection.shard.count)[selection.shard.index - 1]!;
  return selected;
}
