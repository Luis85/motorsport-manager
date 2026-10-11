/// <reference path="./process-contracts.d.ts" />
/**
 * Value rules of the BPMN 2.0 / BPSim 1.0 conformance check: the lexical forms of the simple types the rule tables use
 * (`process-bpmn-conformance-model.ts`), with the whitespace handling XML Schema prescribes for each (strings and string
 * enumerations keep their spaces; every other type is collapsed first). Pure functions of their arguments.
 */
declare namespace LWProcessBpmnValues {
 /** `value` is the value after whitespace processing; `problem` is set when it is not a valid value and says what is expected. */
 interface Checked {value: string; problem?: string; enumeration?: boolean;}
 interface Api {
  /** Checks `raw` against a built-in type name or a table enumeration (`a|b|c`, or `uri+a|b` for a URI or one of the tokens). */
  check(type: string, raw: string, simple?: Record<string, string>): Checked;
  /** Splits a qualified name; `undefined` when it is not one lexically. */
  qname(value: string): {prefix: string; local: string} | undefined;
  /** True for the built-in simple type names of the rule notation. */
  builtin(type: string): boolean;
 }
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessBpmnValues?: LWProcessBpmnValues.Api};
 const collapse = (v: string) => v.replace(/[\t\n\r ]+/g, ' ').replace(/^ | $/g, '');
 // XML 1.0 (fifth edition) name characters without the colon.
 const START = [
  'A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C\\u200D\\u2070-\\u218F',
  '\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD\\u{10000}-\\u{EFFFF}',
 ].join('');
 const NCNAME = `[${START}][${START}\\-.0-9\\u00B7\\u0300-\\u036F\\u203F\\u2040]*`;
 const NAME = new RegExp(`^${NCNAME}$`, 'u'), QNAME = new RegExp(`^(?:(${NCNAME}):)?(${NCNAME})$`, 'u');
 const NUMBER = /^(?:[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?|-?INF|NaN)$/;
 const DURATION = /^-?P(?:\d+Y)?(?:\d+M)?(?:\d+D)?(?:T(?:\d+H)?(?:\d+M)?(?:(?:\d+(?:\.\d*)?|\.\d+)S)?)?$/;
 const DATE_TIME = /^-?(\d{4,})-(\d\d)-(\d\d)T(\d\d):(\d\d):(\d\d)(\.\d+)?(?:Z|[+-](\d\d):(\d\d))?$/;
 // URI references (RFC 3986). Characters a URI must escape (spaces, quotes, braces, non-ASCII, ...) are tolerated as if escaped, as XML Schema allows.
 const PCT = '%[0-9A-Fa-f]{2}', UNRESERVED = 'A-Za-z0-9\\-._~', SUB = "!$&'()*+,;=", PCHAR = `(?:[${UNRESERVED}${SUB}:@]|${PCT})`;
 const SEGMENT = `${PCHAR}*`, NZ = `${PCHAR}+`, NZ_NC = `(?:[${UNRESERVED}${SUB}@]|${PCT})+`, TAIL = `(?:\\?(?:${PCHAR}|[/?])*)?(?:#(?:${PCHAR}|[/?])*)?`;
 const AUTHORITY = `(?:(?:[${UNRESERVED}${SUB}:]|${PCT})*@)?(?:\\[[^\\]/?#@]*\\]|(?:[${UNRESERVED}${SUB}]|${PCT})*)(?::\\d*)?`;
 const ABEMPTY = `(?:/${SEGMENT})*`, ABSOLUTE = `/(?:${NZ}(?:/${SEGMENT})*)?`;
 // An absolute URI (scheme, then hierarchical part) or a relative reference, each followed by the optional query and fragment.
 const ABSOLUTE_URI = `[A-Za-z][A-Za-z0-9+\\-.]*:(?://${AUTHORITY}${ABEMPTY}|${ABSOLUTE}|${NZ}(?:/${SEGMENT})*|)`;
 const RELATIVE_REF = `//${AUTHORITY}${ABEMPTY}|${ABSOLUTE}|${NZ_NC}(?:/${SEGMENT})*|`;
 const URI = new RegExp(`^(?:${ABSOLUTE_URI}|${RELATIVE_REF})${TAIL}$`);
 const uri = (v: string) => URI.test(v.replace(/[\x00-\x20\x7F-￿<>"{}|\\^`]/g, '_'));
 const LIMITS: Record<string, [bigint, bigint]> = {int: [-(2n ** 31n), 2n ** 31n - 1n], long: [-(2n ** 63n), 2n ** 63n - 1n]};
 function dateTime(v: string): boolean {
  const m = DATE_TIME.exec(v); if (!m) return false;
  const [year, month, day, hour, minute, second] = [m[1]!, m[2]!, m[3]!, m[4]!, m[5]!, m[6]!].map(Number) as [number, number, number, number, number, number];
  if (year === 0 || m[1]!.length > 4 && m[1]![0] === '0' || month < 1 || month > 12 || minute > 59 || second > 59) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0), days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]!;
  if (day < 1 || day > days || hour > 24 || hour === 24 && (minute > 0 || second > 0 || m[7] !== undefined && Number(m[7]) > 0)) return false;
  return m[8] === undefined || Number(m[8]) < 14 && Number(m[9]) < 60 || m[8] === '14' && m[9] === '00';
 }
 /** Built-in types: their whitespace rule (true = collapse), the test and what is expected, in plain words. */
 const BUILTIN: Record<string, [boolean, (v: string) => boolean, string]> = {
  string: [false, () => true, 'text'],
  boolean: [true, v => /^(?:true|false|1|0)$/.test(v), 'true or false (or 1 or 0)'],
  integer: [true, v => /^[+-]?\d+$/.test(v), 'a whole number'],
  int: [true, v => /^[+-]?\d+$/.test(v) && BigInt(v) >= LIMITS.int![0] && BigInt(v) <= LIMITS.int![1], 'a whole number from -2147483648 to 2147483647'],
  long: [
   true,
   v => /^[+-]?\d+$/.test(v) && BigInt(v) >= LIMITS.long![0] && BigInt(v) <= LIMITS.long![1],
   'a whole number from -9223372036854775808 to 9223372036854775807',
  ],
  double: [true, v => NUMBER.test(v), 'a number such as 12, 0.5 or 1.5E3 (or INF, -INF, NaN)'],
  float: [true, v => NUMBER.test(v), 'a number such as 12, 0.5 or 1.5E3 (or INF, -INF, NaN)'],
  id: [true, v => NAME.test(v), 'a name that starts with a letter or underscore and has no spaces or colons'],
  idref: [true, v => NAME.test(v), 'the id of an element in this file (a name without spaces or colons)'],
  qname: [true, v => QNAME.test(v), 'a name, optionally with a declared namespace prefix (prefix:name)'],
  ref: [true, v => QNAME.test(v), 'the id of an element, optionally with a declared namespace prefix (prefix:id)'],
  uri: [true, uri, 'a URI'],
  dateTime: [true, dateTime, 'a date and time such as 2026-10-09T08:30:00Z'],
  duration: [true, v => DURATION.test(v) && !/[PT]$/.test(v), 'an ISO 8601 duration such as PT90M or P1DT2H'],
 };
 function check(type: string, raw: string, simple?: Record<string, string>): LWProcessBpmnValues.Checked {
  const rule = BUILTIN[type];
  if (rule) { const value = rule[0] ? collapse(raw) : raw; return rule[1](value) ? {value} : {value, problem: rule[2]}; }
  const spec = simple?.[type];
  if (spec === undefined) return {value: raw, problem: 'a value of the unknown type ' + type};
  // A URI-or-token union collapses its value; a string enumeration compares the value exactly as written.
  const union = spec.startsWith('uri+'), list = (union ? spec.slice(4) : spec).split('|'), value = union ? collapse(raw) : raw;
  if (list.includes(value) || union && uri(value)) return {value};
  return {value, enumeration: true, problem: (union ? 'a URI or one of ' : 'one of ') + list.join(', ')};
 }
 function qname(value: string): {prefix: string; local: string} | undefined {
  const m = QNAME.exec(value); return m ? {prefix: m[1] ?? '', local: m[2]!} : undefined;
 }
 root.LWProcessBpmnValues = {check, qname, builtin: (type: string) => Object.hasOwn(BUILTIN, type)};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessBpmnValues;
})(globalThis);
