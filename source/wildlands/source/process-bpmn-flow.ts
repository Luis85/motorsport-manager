/// <reference path="./process-bpmn-graph.ts" />
/** Gateway roles, fork and join regions, and flow conditions of foreign BPMN: expressions become `when`, BPSim probabilities and event races become chained chance routes. */
declare namespace LWProcessBpmnFlow {
 type Net = LWProcessBpmnGraph.Net; type Ctx = LWProcessBpmnGraph.Ctx;
 interface Api {
  /** Gives gateways, timers, tasks and events their Wildlands role and reports impossible shapes. */
  roles(ctx: Ctx, net: Net): void;
  /** Fork item key -> its converging join item key. */
  pair(ctx: Ctx, net: Net): Map<string, string>;
  /** Sets `when` on the flows leaving decisions and inclusive forks. */
  conditions(ctx: Ctx, net: Net): void;
  /** Chained chance percents for flows in evaluation order (the last flow is the unconditional fallback). */
  chances(p: number[]): {percents: number[]; exact: boolean};
 }
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessBpmnExt: LWProcessBpmnExt.Api; LWProcessBpmnExpr: LWProcessBpmnExpr.Api; LWProcessBpmnFlow?: LWProcessBpmnFlow.Api};
 type Net = LWProcessBpmnGraph.Net; type Ctx = LWProcessBpmnGraph.Ctx; type Edge = LWProcessBpmnGraph.Edge; type Item = LWProcessBpmnGraph.Item;
 const ext = () => root.LWProcessBpmnExt;
 const outOf = (net: Net, k: string) => net.edges.filter(e => e.from === k && !e.deadline), into = (net: Net, k: string) => net.edges.filter(e => e.to === k);
 function roles(ctx: Ctx, net: Net): void {
  for (const i of net.items) {
   const n = outOf(net, i.key).length, m = into(net, i.key).length;
   if (i.gateway === 'parallel' || i.gateway === 'inclusive') {
    if (m === 1 && n >= 2) i.kind = 'fork'; else if (m >= 2 && n === 1) i.kind = 'join';
    else ctx.reject(i.xml, i.local, i.gateway === 'parallel' ? 'Parallel gateway ' + i.xml + ' must split (1 in, 2+ out) or join (2+ in, 1 out).' : 'inclusiveGateway ' + i.xml + ' must split (1 in, 2+ out) or join (2+ in, 1 out) to be simulated.');
   } else if (i.gateway) { if (n < 2) ctx.reject(i.xml, i.local, 'Exclusive gateway ' + i.xml + ' needs two or more outgoing flows.'); }
   else if (i.kind === 'pass') ctx.reject(i.xml, i.local, i.local + ' ' + i.xml + ' has ' + n + ' outgoing flows; only events with exactly one are folded into the flow.');
   else if (i.kind === 'timer' && n > 1) ctx.reject(i.xml, i.local, 'Timer ' + i.xml + ' has ' + n + ' outgoing flows; use a parallel gateway to split work.');
   else if (i.kind === 'task' && n > 1) ctx.reject(i.xml, i.local, 'Task ' + i.xml + ' has ' + n + ' outgoing flows; use a parallel gateway to split work.');
   else if (i.kind === 'start' && n !== 1) ctx.reject(i.xml, i.local, 'The start event must have exactly one outgoing flow.');
  }
  if (net.items.filter(i => i.kind === 'start').length !== 1) ctx.reject('', 'startEvent', 'Exactly one start event is required.');
 }
 function pair(ctx: Ctx, net: Net): Map<string, string> {
  const joins = new Map<string, string>(), byKey = new Map(net.items.map(i => [i.key, i] as const));
  for (const fork of net.items.filter(i => i.kind === 'fork')) {
   const declared = ext().first(fork.node, 'step')?.attrs.join, label = fork.gateway === 'inclusive' ? 'Inclusive gateway ' + fork.xml : 'Parallel branches of ' + fork.xml;
   if (declared) {
    const target = net.items.find(j => j.kind === 'join' && j.id === declared);
    if (!target) { ctx.reject(fork.xml, fork.local, 'Fork ' + fork.xml + ' names unknown join ' + declared + '.'); continue; }
    joins.set(fork.key, target.key); continue;
   }
   const ends = new Set<string>(); let nested = '';
   for (const flow of outOf(net, fork.key)) {
    let at = byKey.get(flow.to)!; const seen = new Set<string>();
    while ((at.kind === 'task' || at.kind === 'timer') && !seen.has(at.key)) { seen.add(at.key); const next = outOf(net, at.key)[0]; if (!next) break; at = byKey.get(next.to) ?? at; }
    if (at.kind !== 'join') nested = nested || at.local + ' ' + at.xml;
    ends.add(at.kind === 'join' ? at.key : '?');
   }
   const join = ends.size === 1 && !ends.has('?') ? byKey.get([...ends][0]!)! : undefined;
   if (join && join.gateway !== fork.gateway) { ctx.reject(fork.xml, fork.local, label + (fork.gateway === 'inclusive' ? ' meets parallel gateway ' : ' meets inclusive gateway ') + join.xml + '; a split and its join must be the same gateway type.'); continue; }
   if (!join) {
    ctx.reject(fork.xml, fork.local, fork.gateway === 'inclusive' ? 'Inclusive gateway ' + fork.xml + ' is not a clean single-entry, single-exit region: its branches must be chains of tasks and timers that meet at one converging inclusive gateway'
     + (nested ? ' (found ' + nested + ' inside a branch; nested gateways, loops and other splits are not supported)' : ' (the branches end at different places)') + '.' : label + ' must be task chains meeting at one parallel join.');
    continue;
   }
   joins.set(fork.key, join.key);
  }
  return joins;
 }
 /** Integer chance percents for chained routes: route i is taken with p_i / (1 - earlier shares); the last share needs no route. */
 function chances(p: number[]): {percents: number[]; exact: boolean} {
  const percents: number[] = []; let rest = 1, exact = true;
  for (const share of p.slice(0, -1)) {
   const raw = rest > 1e-9 ? share / rest * 100 : 99, rounded = Math.min(99, Math.max(1, Math.round(raw)));
   if (Math.abs(raw - rounded) > 0.05) exact = false;
   percents.push(rounded); rest = rest * (1 - rounded / 100);
  }
  return {percents, exact};
 }
 /** Nested same-kind lists flattened and one-item lists unwrapped, so `a && (b && c)` and `{all: [a, {all: [b, c]}]}` compare equal. */
 function flat(w: LWProcess.When): LWProcess.When {
  if (w.not) return {not: flat(w.not)};
  const kind = w.all ? 'all' : w.any ? 'any' : undefined; if (!kind) return w;
  const list = (w.all ?? w.any)!.map(flat).flatMap(c => c[kind] ?? [c]);
  return list.length === 1 ? list[0]! : kind === 'all' ? {all: list} : {any: list};
 }
 const canonical = (w: LWProcess.When) => JSON.stringify(flat(w), ['all', 'any', 'not', 'field', 'op', 'value', 'valueField', 'chance']);
 const FIELD_HINT = 'Use comparisons of case fields with values or other fields, joined by and, or, not.';
 function conditions(ctx: Ctx, net: Net): void {
  const E = ext(), byKey = new Map(net.items.map(i => [i.key, i] as const)), pct = (n: number) => Math.round(n * 1000) / 10;
  const branches = (i: Item) => i.kind === 'decision' || i.kind === 'fork' && i.gateway === 'inclusive';
  /** The condition one flow carries: extension first, then the expression text; `undefined` means none. */
  const failed = new Set<Edge>();
  function own(e: Edge, from: Item): LWProcess.When | undefined {
   const where = 'Flow ' + e.xml, node = e.node, wl = node && E.first(node, 'when'), text = e.expression?.trim() ?? '';
   const chance = node ? E.chanceOf(wl && wl.attrs.combine === undefined ? wl : undefined, e.exprNode, where) : undefined;
   if (chance) {
    if (!branches(from)) ctx.reject(e.xml, 'sequenceFlow', 'Flow ' + e.xml + ' is a chance route but leaves ' + from.xml + ', which is not an exclusive gateway.');
    return chance;
   }
   if (!branches(from)) { if (text) ctx.warn('Condition on flow ' + e.xml + ' is ignored; only exclusive and inclusive gateways branch.'); return undefined; }
   if (e.when) return e.when;
   const exact = wl ? E.whenOf(wl, where) : undefined;
   let parsed: LWProcess.When | undefined;
   if (text) {
    try { parsed = root.LWProcessBpmnExpr.parse(text); }
    catch (error) {
     const message = where + ': unsupported condition "' + text + '" (' + (error as Error).message + '). ' + FIELD_HINT;
     if (!exact) { if (ctx.o.unsupported === 'drop') { ctx.warn(message + ' The flow becomes a 50% chance.'); return {chance: 50}; } ctx.reject(e.xml, 'sequenceFlow', message); failed.add(e); return undefined; }
    }
   }
   if (exact && parsed && canonical(exact) !== canonical(parsed)) ctx.warn('Flow ' + e.xml + ': the condition expression disagrees with the Wildlands extension; the extension wins.');
   return exact ?? parsed;
  }
  for (const e of net.edges) { const from = byKey.get(e.from); if (from && !e.deadline && !branches(from)) own(e, from); }
  for (const g of net.items.filter(branches)) {
   const out = outOf(net, g.key), inclusive = g.kind === 'fork', prefix = g.key.slice(0, g.key.length - g.xml.length), declared = g.node.attrs.default, race = g.gateway === 'event';
   const mine = new Map<Edge, LWProcess.When | undefined>(out.map(e => [e, own(e, g)] as const));
   if (out.some(e => failed.has(e))) continue;
   let probs = out.map(e => ctx.bps?.elements.get(e.xml)?.probability);
   if (probs.filter(v => v === undefined).length === 1 && probs.some(v => v !== undefined)) { const sum = probs.reduce<number>((a, v) => a + (v ?? 0), 0); if (sum < 1) probs = probs.map(v => v ?? 1 - sum); }
   const havePb = probs.every(v => v !== undefined), prob = (e: Edge) => probs[out.indexOf(e)];
   const uncond = out.filter(e => !mine.get(e));
   let fallback = declared ? out.find(e => e.key === prefix + declared) : undefined;
   if (!fallback && uncond.length === 1) fallback = uncond[0];
   if (inclusive) {
    if (!fallback && uncond.length === 0) ctx.warn('Inclusive gateway ' + g.xml + ' has no default flow: a case matching no condition fails.');
    else if (fallback && !declared) ctx.warn('Inclusive gateway ' + g.xml + ': the unconditional flow ' + fallback.xml + ' is the default flow (taken only when no condition matches; BPMN would always take it).');
    for (const e of uncond.filter(x => x !== fallback)) {
     const p = prob(e);
     if (p !== undefined) { mine.set(e, {chance: Math.min(99, Math.max(1, Math.round(p * 100)))}); if (p >= 1 || p < 0.005) ctx.warn('Probability ' + p + ' of flow ' + e.xml + ' is limited to a 1..99 percent chance.'); }
     else if (ctx.o.unsupported === 'drop') { mine.set(e, {chance: 50}); ctx.warn('Flow ' + e.xml + ' of inclusive gateway ' + g.xml + ' has no condition; it becomes a 50% chance in drop mode.'); }
     else ctx.reject(e.xml, 'sequenceFlow', 'Flow ' + e.xml + ' leaving inclusive gateway ' + g.xml + ' has no condition and is not the default flow (BPMN would always take it; the engine has no always-true branch).');
    }
   } else {
    if (!fallback) { fallback = uncond.length ? uncond.at(-1)! : out.at(-1)!; if (!uncond.length) ctx.warn('Gateway ' + g.xml + ' had no default flow; its last flow is the fallback.'); }
    const extra = out.filter(e => e !== fallback && !mine.get(e)), group = [...extra, fallback], byProb = havePb && extra.length > 0 || havePb && race;
    if (extra.length || race && !havePb) {
     if (!race && !havePb && ctx.o.unsupported !== 'drop') { ctx.reject(g.xml, g.local, 'Exclusive gateway ' + g.xml + ' has several flows without a condition; mark one as the default flow.'); continue; }
     const raw = byProb ? group.map(e => prob(e)!) : group.map(() => 1), total = raw.reduce((a, b) => a + b, 0), result = chances(raw.map(v => v / total));
     if (byProb && Math.abs(total - 1) > 0.01 && group.length === out.length) ctx.warn('BPSim probabilities of gateway ' + g.xml + ' sum to ' + Math.round(total * 1000) / 1000 + '; they were normalised to 1.');
     if (race) ctx.warn('Event-based gateway ' + g.xml + ': race between events simulated by chance (' + (byProb ? 'BPSim probabilities' : 'equal shares') + '), not by which event happens first.');
     else if (!byProb) ctx.warn('Gateway ' + g.xml + ' has unconditioned flows; they share equal chances in drop mode.');
     if (byProb && !result.exact) ctx.warn('Probabilities of gateway ' + g.xml + ' were rounded to whole percents (' + result.percents.map(v => v + '%').join(', ') + ' chained, last flow the default).');
     extra.forEach((e, n) => mine.set(e, {chance: result.percents[n]!}));
    } else if (havePb && out.every(e => e === fallback || mine.get(e)?.chance !== undefined)) {
     const list = [...out.filter(e => e !== fallback), fallback], total = list.reduce((a, e) => a + prob(e)!, 0), result = chances(list.map(e => prob(e)! / total));
     list.slice(0, -1).forEach((e, n) => { const given = mine.get(e)!.chance!; if (given !== result.percents[n]) ctx.warn('BPSim probability of flow ' + e.xml + ' (' + pct(prob(e)!) + '%) disagrees with the Wildlands extension (' + given + '% chained); the extension wins.'); });
    }
   }
   for (const e of out) { const w = mine.get(e); if (e === fallback || !w) delete e.when; else e.when = w; }
   for (const e of out) if (prob(e) !== undefined && ctx.bps?.elements.get(e.xml)?.probability !== undefined) ctx.note(e.xml, 'bpsim:Probability', 'flow:' + e.id, 'share ' + pct(prob(e)!) + '%' + (e.when?.chance !== undefined ? ' -> chance ' + e.when.chance + '%' + (inclusive ? '' : ' (chained)') : fallback === e ? ' -> default flow' : ' (the Wildlands condition wins)'));
  }
 }
 root.LWProcessBpmnFlow = {roles, pair, conditions, chances};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessBpmnFlow;
})(globalThis);
