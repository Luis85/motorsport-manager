import fs from "node:fs";

/** Reviewed identity of a check that was not part of the historical baseline. */
export interface CheckIdentity { suite: string; name: string; }
export interface CheckRename { suite: string; from: string; to: string; reason: string; }
export interface CheckRetirement { suite: string; name: string; reason: string; }

/**
 * Reviewed expectations for the complete gate. The inventory is the exact accepted check-name set
 * per suite; additions, renames and retirements explain every difference from the historical
 * baseline so a missing, unexpected or renamed check can never pass silently.
 */
export interface GateExpectations {
  schemaVersion: 1;
  historicalBaseline: { suites: number; checks: number };
  suites: string[];
  totalChecks: number;
  reviewedAdditions: CheckIdentity[];
  renames: CheckRename[];
  retirements: CheckRetirement[];
  inventory: Record<string, string[]>;
}

const text = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
const key = (suite: string, name: string): string => JSON.stringify([suite, name]);

/** Validate internal consistency; any problem rejects the whole document. */
export function validateExpectations(data: unknown): GateExpectations {
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Gate expectations must be an object");
  const document = data as Record<string, unknown>;
  const problems: string[] = [];
  if (document.schemaVersion !== 1) problems.push("schemaVersion must be 1");
  const baseline = document.historicalBaseline as Record<string, unknown> | undefined;
  if (!baseline || !Number.isSafeInteger(baseline.suites) || !Number.isSafeInteger(baseline.checks)) problems.push("historicalBaseline requires integer suites and checks");
  const suites = Array.isArray(document.suites) ? document.suites : [];
  if (!suites.length || !suites.every(text) || new Set(suites).size !== suites.length) problems.push("suites must be a nonempty list of distinct names");
  const inventory = document.inventory && typeof document.inventory === "object" && !Array.isArray(document.inventory) ? document.inventory as Record<string, unknown> : {};
  if (JSON.stringify(Object.keys(inventory)) !== JSON.stringify(suites)) problems.push("inventory must list exactly the expected suites in the same order");
  let inventoried = 0;
  const present = new Set<string>();
  for (const [suite, names] of Object.entries(inventory)) {
    if (!Array.isArray(names) || !names.length || !names.every(text)) { problems.push(`inventory.${suite} must be a nonempty list of check names`); continue; }
    if (new Set(names).size !== names.length) problems.push(`inventory.${suite} contains duplicate check names`);
    inventoried += names.length;
    for (const name of names) present.add(key(suite, name));
  }
  if (!Number.isSafeInteger(document.totalChecks) || document.totalChecks !== inventoried) problems.push(`totalChecks ${String(document.totalChecks)} differs from the inventory (${inventoried})`);
  const list = (field: string): Record<string, unknown>[] => {
    const value = document[field];
    if (!Array.isArray(value) || value.some(row => !row || typeof row !== "object" || Array.isArray(row))) { problems.push(`${field} must be a list of objects`); return []; }
    return value as Record<string, unknown>[];
  };
  const additions = list("reviewedAdditions"), renames = list("renames"), retirements = list("retirements");
  const seen = new Set<string>();
  for (const row of additions) {
    if (!text(row.suite) || !text(row.name) || seen.has(key(row.suite, row.name))) { problems.push("Invalid or duplicate reviewed addition " + JSON.stringify(row)); continue; }
    seen.add(key(row.suite, row.name));
    if (!present.has(key(row.suite, row.name))) problems.push(`Reviewed addition is not in the inventory: ${row.suite} / ${row.name}`);
  }
  const renamed = new Set<string>();
  for (const row of renames) {
    if (!text(row.suite) || !text(row.from) || !text(row.to) || !text(row.reason) || row.from === row.to || renamed.has(key(row.suite, row.from))) { problems.push("Invalid or duplicate rename " + JSON.stringify(row)); continue; }
    renamed.add(key(row.suite, row.from));
    if (!present.has(key(row.suite, row.to))) problems.push(`Rename target is not in the inventory: ${row.suite} / ${row.to}`);
    if (present.has(key(row.suite, row.from))) problems.push(`Renamed check is still inventoried: ${row.suite} / ${row.from}`);
  }
  const retired = new Set<string>();
  for (const row of retirements) {
    if (!text(row.suite) || !text(row.name) || !text(row.reason) || retired.has(key(row.suite, row.name))) { problems.push("Invalid or duplicate retirement " + JSON.stringify(row)); continue; }
    retired.add(key(row.suite, row.name));
    if (present.has(key(row.suite, row.name))) problems.push(`Retired check is still inventoried: ${row.suite} / ${row.name}`);
  }
  if (baseline && Number.isSafeInteger(baseline.checks) && document.totalChecks !== (baseline.checks as number) + additions.length - retirements.length)
    problems.push(`totalChecks must equal historical ${String(baseline.checks)} + ${additions.length} reviewed additions - ${retirements.length} retirements`);
  if (problems.length) throw new Error("Invalid gate expectations:\n" + problems.join("\n"));
  return document as unknown as GateExpectations;
}

export function loadExpectations(file: string): GateExpectations {
  return validateExpectations(JSON.parse(fs.readFileSync(file, "utf8")));
}

const sample = (names: readonly string[]): string => names.slice(0, 5).map(name => JSON.stringify(name)).join(", ") + (names.length > 5 ? `, … (${names.length} total)` : "");

/**
 * Compare observed check names (suite order as run) with the reviewed expectations. For a complete
 * gate the suite list, order and total must match exactly; partial runs still match each suite's
 * inventory. Returns every problem; an empty list is the only accepting outcome.
 */
export function assessChecks(expectations: GateExpectations, observed: ReadonlyArray<{ suite: string; names: readonly string[] }>, complete: boolean): string[] {
  const problems: string[] = [];
  const renames = new Map(expectations.renames.map(row => [key(row.suite, row.from), row.to]));
  const retired = new Set(expectations.retirements.map(row => key(row.suite, row.name)));
  const suites = new Set<string>();
  let total = 0;
  for (const { suite, names } of observed) {
    if (suites.has(suite)) { problems.push(`Suite reported twice: ${suite}`); continue; }
    suites.add(suite);
    const expected = expectations.inventory[suite];
    if (!expected) { problems.push(`Unexpected suite: ${suite}`); continue; }
    total += names.length;
    const actual = new Set(names);
    if (actual.size !== names.length) problems.push(`${suite}: duplicate check names`);
    const wanted = new Set(expected);
    const missing = expected.filter(name => !actual.has(name));
    const unexpected = [...actual].filter(name => !wanted.has(name));
    for (const name of unexpected) {
      const target = renames.get(key(suite, name));
      if (target !== undefined) problems.push(`${suite}: check still uses the name retired by a reviewed rename: ${JSON.stringify(name)} -> ${JSON.stringify(target)}`);
      else if (retired.has(key(suite, name))) problems.push(`${suite}: retired check reappeared: ${JSON.stringify(name)}`);
    }
    if (missing.length) problems.push(`${suite}: ${missing.length} expected check(s) missing: ${sample(missing)}`);
    if (unexpected.length) problems.push(`${suite}: ${unexpected.length} unreviewed check(s): ${sample(unexpected)}`);
    if (missing.length && unexpected.length) problems.push(`${suite}: missing and unreviewed names together indicate an undeclared rename; record it in gate-expectations.json renames`);
    if (names.length !== expected.length) problems.push(`${suite}: ${names.length} checks observed, ${expected.length} expected`);
  }
  if (complete) {
    const order = observed.map(row => row.suite);
    if (JSON.stringify(order) !== JSON.stringify(expectations.suites)) {
      const absent = expectations.suites.filter(name => !suites.has(name));
      problems.push(`Complete gate suite list differs from expectations${absent.length ? "; missing " + sample(absent) : ""}`);
    }
    if (total !== expectations.totalChecks) problems.push(`Complete gate observed ${total} checks; ${expectations.totalChecks} expected`);
  }
  return problems;
}
