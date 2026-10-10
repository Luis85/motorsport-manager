/// <reference path="./process-contracts.d.ts" />
/**
 * Safe condition grammar of the BPMN interchange: comparisons of a case field with a literal or another field, joined by
 * and/or/not. No call, member access or arithmetic is ever evaluated.
 */
declare namespace LWProcessBpmnExpr {
 interface Api {
  /** Parses `${a > 1 && !(b == 'x')}` style text into a `When`; throws an Error naming the problem when the text is outside the grammar or the limits. */
  parse(text: string): LWProcess.When;
  /** Standard expression text for a condition, or `undefined` when some leaf (a chance, or a field named like a literal) has none. */
  format(when: LWProcess.When): string | undefined;
  isField(name: string): boolean;
  OPS: Record<string, string>;
 }
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessBpmnExpr?: LWProcessBpmnExpr.Api};
 const OPS: Record<string, LWProcess.Op> = {
  '==': 'eq', '=': 'eq', eq: 'eq',
  '!=': 'ne', ne: 'ne',
  '>': 'gt', gt: 'gt',
  '>=': 'gte', ge: 'gte', gte: 'gte',
  '<': 'lt', lt: 'lt',
  '<=': 'lte', le: 'lte', lte: 'lte',
 };
 const SYMBOLS: Record<string, string> = {eq: '==', ne: '!=', gt: '>', gte: '>=', lt: '<', lte: '<='};
 const FLIP: Record<LWProcess.Op, LWProcess.Op> = {eq: 'eq', ne: 'ne', gt: 'lt', gte: 'lte', lt: 'gt', lte: 'gte'};
 const FIELD = /^[a-z][a-zA-Z0-9_]{0,63}$/, MAX_LEAVES = 8, MAX_LEVELS = 3, MAX_LIST = 8;
 type Tok = {t: 'num' | 'str' | 'id' | 'cmp' | 'and' | 'or' | 'not' | 'open' | 'close' | 'lit'; v: string};
 /** Symbol tokens other than the comparison operators. */
 const SYMBOL_KINDS: Record<string, Tok['t']> = {'&&': 'and', '||': 'or', '!': 'not', '(': 'open', ')': 'close'};
 /** A word token: and/or/not in any case, an operator word written in lower case, a literal, or else a field name. */
 function wordKind(w: string): Tok['t'] {
  const lower = w.toLowerCase();
  if (lower === 'and') return 'and';
  if (lower === 'or') return 'or';
  if (lower === 'not') return 'not';
  if (Object.hasOwn(OPS, lower) && lower.length > 1 && /^[a-z]+$/.test(w) && lower === w) return 'cmp';
  if (['true', 'false', 'null'].includes(w)) return 'lit';
  return 'id';
 }
 function tokens(text: string): Tok[] {
  const out: Tok[] = []; let i = 0;
  while (i < text.length) {
   const rest = text.slice(i), space = /^\s+/.exec(rest);
   if (space) { i += space[0].length; continue; }
   const sym = /^(&&|\|\||==|!=|>=|<=|>|<|=|!|\(|\))/.exec(rest);
   if (sym) {
    const s = sym[1]!; i += s.length;
    out.push({t: SYMBOL_KINDS[s] ?? 'cmp', v: s});
    continue;
   }
   const num = /^-?\d+(?:\.\d+)?/.exec(rest), str = /^'([^']*)'|^"([^"]*)"/.exec(rest), word = /^[A-Za-z_][A-Za-z0-9_]*/.exec(rest);
   if (num) { out.push({t: 'num', v: num[0]}); i += num[0].length; }
   else if (str) { out.push({t: 'str', v: str[1] ?? str[2] ?? ''}); i += str[0].length; }
   else if (word) {
    const w = word[0];
    i += w.length;
    out.push({t: wordKind(w), v: w});
   } else throw Error('unexpected character "' + rest[0] + '"');
  }
  return out;
 }
 type Operand = {field: string} | {value: LWProcess.Scalar};
 function parse(input: string): LWProcess.When {
  let text = input.trim();
  const wrapped = /^[$#]\{([\s\S]*)\}$/.exec(text); if (wrapped) text = wrapped[1]!.trim();
  if (!text) throw Error('the expression is empty');
  const toks = tokens(text); let at = 0;
  const peek = () => toks[at], take = () => toks[at++];
  const operand = (): Operand => {
   const t = take(); if (!t) throw Error('the expression ends early');
   if (t.t === 'num') return {value: Number(t.v)};
   if (t.t === 'str') return {value: t.v};
   if (t.t === 'lit') return {value: t.v === 'true' ? true : t.v === 'false' ? false : null};
   if (t.t === 'id') {
    if (!FIELD.test(t.v)) throw Error('"' + t.v + '" is not a usable case field name (lower-case start, letters, digits and _)');
    return {field: t.v};
   }
   throw Error('expected a field or a value near "' + t.v + '"');
  };
  const comparison = (): LWProcess.When => {
   const left = operand(), next = peek();
   if (!next || next.t !== 'cmp') {
    if ('field' in left) return {field: left.field, op: 'eq', value: true};
    throw Error('a value alone is not a condition');
   }
   take(); const right = operand(); let op = OPS[next.v.toLowerCase()]!;
   if ('field' in left) return 'field' in right ? {field: left.field, op, valueField: right.field} : {field: left.field, op, value: right.value};
   if ('field' in right) { op = FLIP[op]; return {field: right.field, op, value: left.value}; }
   throw Error('a comparison needs at least one case field');
  };
  const unary = (): LWProcess.When => {
   const t = peek(); if (!t) throw Error('the expression ends early');
   if (t.t === 'not') { take(); return {not: unary()}; }
   if (t.t === 'open') { take(); const inner = or(); if (take()?.t !== 'close') throw Error('a closing parenthesis is missing'); return inner; }
   return comparison();
  };
  const join = (kind: 'all' | 'any', next: () => LWProcess.When, stop: Tok['t']): LWProcess.When => {
   const list = [next()];
   while (peek()?.t === stop) { take(); list.push(next()); }
   if (list.length === 1) return list[0]!;
   return kind === 'all' ? {all: list.flatMap(c => c.all ?? [c])} : {any: list.flatMap(c => c.any ?? [c])};
  };
  const and = (): LWProcess.When => join('all', unary, 'and'), or = (): LWProcess.When => join('any', and, 'or');
  const result = or();
  if (at < toks.length) throw Error('unexpected "' + toks[at]!.v + '"');
  check(result);
  return result;
 }
 /** Engine limits of one `when`: 8 leaves, 3 combinator levels, 8 entries per list. */
 function check(when: LWProcess.When): void {
  let leaves = 0;
  const walk = (w: LWProcess.When, level: number): void => {
   const list = w.all ?? w.any, kids = list ?? (w.not ? [w.not] : undefined);
   if (!kids) { if (++leaves > MAX_LEAVES) throw Error('it has more than ' + MAX_LEAVES + ' comparisons'); return; }
   if (level > MAX_LEVELS) throw Error('it nests more than ' + MAX_LEVELS + ' levels of and/or/not');
   if (kids.length > MAX_LIST) throw Error('it joins more than ' + MAX_LIST + ' conditions');
   kids.forEach(k => walk(k, level + 1));
  };
  walk(when, 1);
 }
 /** A field name the grammar would read as something else (a literal, an operator word or and/or/not) has no standard expression. */
 function plain(name: string): boolean {
  if (['true', 'false', 'null'].includes(name)) return false;
  if (Object.hasOwn(OPS, name) && /^[a-z]+$/.test(name)) return false;
  return !['and', 'or', 'not'].includes(name.toLowerCase());
 }
 /** The right-hand side as grammar text: a plain field, a quoted text (single quotes, else double quotes; text holding both has none) or a plain number. */
 function operandText(c: LWProcess.Condition): string | undefined {
  if (c.valueField !== undefined) return plain(c.valueField) ? c.valueField : undefined;
  if (typeof c.value === 'string') return !c.value.includes("'") ? "'" + c.value + "'" : !c.value.includes('"') ? '"' + c.value + '"' : undefined;
  const t = JSON.stringify(c.value); return typeof c.value !== 'number' || /^-?\d+(?:\.\d+)?$/.test(t) ? t : undefined;
 }
 function format(when: LWProcess.When): string | undefined {
  if (when.chance !== undefined) return undefined;
  if (when.not) { const inner = format(when.not); return inner === undefined ? undefined : '!(' + inner + ')'; }
  const list = when.all ?? when.any;
  if (list) {
   const parts = list.map(c => { const t = format(c); return t === undefined ? undefined : c.all || c.any ? '(' + t + ')' : t; });
   return parts.some(p => p === undefined) ? undefined : parts.join(when.all ? ' && ' : ' || ');
  }
  if (when.field === undefined || !plain(when.field)) return undefined;
  const right = operandText(when);
  return right === undefined ? undefined : when.field + ' ' + SYMBOLS[when.op] + ' ' + right;
 }
 root.LWProcessBpmnExpr = {parse, format, OPS, isField: (name: string) => FIELD.test(name)};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessBpmnExpr;
})(globalThis);
