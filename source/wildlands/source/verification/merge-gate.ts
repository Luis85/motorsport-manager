/**
 * Merge sharded gate reports (`npm run verify -- --shard I/N` on separate hosts) into one complete
 * report. Every shard must share the same source, artifact, registry and expectations identity;
 * shards must be disjoint and together cover the registry; and every suite's pinned result file is
 * re-read and re-accepted locally, so a merged pass is never a sum of summary claims.
 *
 * Usage: node --import tsx source/verification/merge-gate.ts --output <merged.json> <shard.json>...
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { acceptedCounts } from "./gate-integrity";
import { loadRegistry } from "./suite-registry";
import { assessChecks, loadExpectations } from "./gate-expectations";

interface ShardSuite { name: string; result: string; exitCode: number; error?: string; passed?: number; total?: number }
interface ShardReport {
  status: string; complete?: boolean; selection?: { shard: string | null; tier: string; noBrowser: boolean; only: string[] | null };
  sourceSha256: string; htmlSha256?: string; registrySha256?: string; expectationsSha256?: string; suites: ShardSuite[];
}

const ROOT = path.resolve(__dirname, "../..");
const sha256 = (file: string): string => crypto.createHash("sha256").update(new Uint8Array(fs.readFileSync(file))).digest("hex");

export function mergeShards(root: string, shards: readonly ShardReport[]): Record<string, unknown> {
  const registryFile = path.join(root, "source/verification/suites.json"), expectationsFile = path.join(root, "source/verification/gate-expectations.json");
  const registry = loadRegistry(registryFile), expectations = loadExpectations(expectationsFile);
  if (!shards.length) throw new Error("At least one shard report is required");
  const identity = (shard: ShardReport) => JSON.stringify([shard.sourceSha256, shard.htmlSha256, shard.registrySha256, shard.expectationsSha256]);
  const expected = JSON.stringify([shards[0]!.sourceSha256, shards[0]!.htmlSha256, sha256(registryFile), sha256(expectationsFile)]);
  const counts = new Set<string>();
  for (const shard of shards) {
    if (shard.status !== "partial-passed" && shard.status !== "passed") throw new Error(`Shard did not pass: ${shard.status}`);
    if (identity(shard) !== expected) throw new Error("Shard source, artifact, registry or expectations identity differs");
    const selection = shard.selection;
    if (!selection || selection.tier !== "full" || selection.noBrowser || selection.only) throw new Error("Only full-tier browser-inclusive shards can be merged");
    counts.add(selection.shard?.split("/")[1] ?? "1");
  }
  if (counts.size !== 1 || Number([...counts][0]) !== shards.length || new Set(shards.map(shard => shard.selection!.shard)).size !== shards.length)
    throw new Error("Merge requires exactly one report for each shard of a single shard count");
  const bySuite = new Map<string, ShardSuite>();
  for (const suite of shards.flatMap(shard => shard.suites)) {
    if (bySuite.has(suite.name)) throw new Error(`Suite appears in more than one shard: ${suite.name}`);
    bySuite.set(suite.name, suite);
  }
  const suites = registry.map(entry => {
    const suite = bySuite.get(entry.name);
    if (!suite) throw new Error(`No shard ran ${entry.name}`);
    if (suite.result !== entry.result || suite.exitCode !== 0 || suite.error) throw new Error(`Shard suite did not pass at its registered result path: ${entry.name}`);
    const data = JSON.parse(fs.readFileSync(path.join(root, entry.result), "utf8")) as { results: Array<{ name: string }> };
    const accepted = acceptedCounts(data);
    if (suite.passed !== accepted.passed || suite.total !== accepted.total) throw new Error(`Shard summary differs from accepted evidence: ${entry.name}`);
    return { suite, names: data.results.map(row => row.name) };
  });
  if (bySuite.size !== registry.length) throw new Error("Shards contain unregistered suites");
  const problems = assessChecks(expectations, suites.map(({ suite, names }) => ({ suite: suite.name, names })), true);
  if (problems.length) throw new Error("Merged check inventory differs from gate-expectations.json:\n" + problems.join("\n"));
  const total = suites.reduce((sum, { suite }) => sum + suite.total!, 0);
  return { ...shards[0], status: "passed", complete: true, mergedShards: shards.length, selection: { tier: "full", noBrowser: false, only: null, shard: null, suites: suites.length },
    browserIncluded: true, passed: total, total, suites: suites.map(({ suite }) => suite), mergedAt: new Date().toISOString() };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const outputIndex = args.indexOf("--output");
  if (outputIndex < 0 || !args[outputIndex + 1] || args.length < 3) { console.error("Usage: merge-gate --output <merged.json> <shard.json>..."); process.exit(2); }
  const output = path.resolve(args[outputIndex + 1]!), inputs = args.filter((_, index) => index !== outputIndex && index !== outputIndex + 1);
  try {
    const merged = mergeShards(ROOT, inputs.map(file => JSON.parse(fs.readFileSync(file, "utf8")) as ShardReport));
    fs.writeFileSync(output, JSON.stringify(merged, null, 2) + "\n");
    console.log(`passed ${String(merged.passed)}/${String(merged.total)} merged from ${inputs.length} shards`);
  } catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
}
