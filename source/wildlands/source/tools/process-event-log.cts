/// <reference path="../process-contracts.d.ts" />
/// <reference path="../process-xml.ts" />
/**
 * Streaming event-log files for `wildlands process run --event-log` (Node only; owned by the process CLI). A log receives every
 * engine event from the runtime's `onEvent` sink in engine order and is written incrementally to an exclusively created temporary
 * file next to the target (buffered in chunks of about 64 KiB, never the whole log in memory), then published by rename when the
 * run ends; a failed run removes the temporary file. The target is refused when it is, or aliases, the input or the report.
 *
 * Timestamps use the synthetic epoch of the BPMN mapping: business minute m is `1970-01-01T00:00Z` plus m minutes
 * (`1970-01-01T00:05:00Z` for minute 5); it is not a calendar date.
 *
 * CSV: a header row `case_id,step_id,step_name,event,minute,timestamp,detail`, then one row per event. Cells holding a comma,
 * quote or line break are quoted (quotes doubled); text cells starting with `=`, `+`, `-`, `@`, a tab or a carriage return get a
 * leading apostrophe so spreadsheets do not run them as formulas, as in the studio's Activity CSV.
 *
 * XES (IEEE 1849-2016): one `log` with the Concept, Lifecycle and Time standard extensions and a Wildlands extension (prefix `wl`,
 * `urn:wildlands:process:1`); one `trace` per case (`concept:name` = case id, `wl:status` completed, failed, dropped or active).
 * Each event carries `concept:name` (the step name; the event kind for a case failure, which names no step), `lifecycle:transition`,
 * `time:timestamp`, `wl:kind`, `wl:minute`, and `wl:step` (step id) and `wl:detail` when present. Lifecycle mapping: started and
 * timer-started are `start`; finished-task, timer-fired, routed, forked, joined and completed are `complete`; arrived, entered
 * and backlogged are `schedule`; held is `suspend` and pulled `resume`; deadline-interrupt is `ate_abort`, failed `pi_abort`,
 * arrival-dropped `withdraw`; any other kind (deadline-escalate) is `unknown`.
 * XES needs a case's events together, so the writer keeps the events of each unfinished case in memory and writes the whole trace
 * when the case completes, fails or is dropped (terminal events end a case's events). Memory is therefore bounded by the cases in
 * progress (at most `limits.active`, 500) and their transition budget. Cases still in progress when the run ends are written
 * last, in arrival order, with `wl:status` active. Text XML 1.0 cannot represent is refused with the in-repository XML rules.
 */
import fs from 'node:fs';
import {randomUUID} from 'node:crypto';
import {guardOutput} from './cli-io.cjs';
export type LogFormat = 'csv' | 'xes';
export interface EventLog { write(event: LWProcess.Event): void; close(): {file: string; format: LogFormat; events: number}; abort(): void; }
const CHUNK = 64 * 1024, TERMINAL: Record<string, string> = {completed: 'completed', failed: 'failed', 'arrival-dropped': 'dropped'};
const LIFECYCLE: Record<string, string> = {started: 'start', 'timer-started': 'start', 'finished-task': 'complete', 'timer-fired': 'complete',
 routed: 'complete', forked: 'complete', joined: 'complete', completed: 'complete', arrived: 'schedule', entered: 'schedule', backlogged: 'schedule',
 held: 'suspend', pulled: 'resume', 'deadline-interrupt': 'ate_abort', failed: 'pi_abort', 'arrival-dropped': 'withdraw'};
const xml = () => (globalThis as unknown as {LWProcessXml: LWProcessXml.Api}).LWProcessXml;
/** Business minute on the synthetic 1970-01-01T00:00Z epoch, whole minutes: `1970-01-01T00:05:00Z`. */
export const timestamp = (minute: number) => new Date(minute * 60000).toISOString().replace('.000Z', 'Z');
export function csvCell(value: string | number): string {
 const text = String(value), safe = typeof value === 'string' && /^[=+\-@\t\r]/.test(text) ? "'" + text : text;
 return /[",\r\n]/.test(safe) ? '"' + safe.replaceAll('"', '""') + '"' : safe;
}
export const CSV_HEADER = 'case_id,step_id,step_name,event,minute,timestamp,detail\n';
export function csvRow(e: LWProcess.Event, names: ReadonlyMap<string, string>): string {
 return [e.caseId, e.stepId, names.get(e.stepId) ?? '', e.kind, e.minute, timestamp(e.minute), e.detail].map(csvCell).join(',') + '\n';
}
const attribute = (type: string, key: string, value: unknown) => `<${type} key="${key}" value="${xml().escape(value)}"/>`;
export function xesHeader(d: LWProcess.Definition, seed: number): string {
 return '<?xml version="1.0" encoding="UTF-8"?>\n'
  + '<log xes.version="1849-2016" xes.features="" xmlns="http://www.xes-standard.org/">\n'
  + ' <extension name="Concept" prefix="concept" uri="http://www.xes-standard.org/concept.xesext"/>\n'
  + ' <extension name="Lifecycle" prefix="lifecycle" uri="http://www.xes-standard.org/lifecycle.xesext"/>\n'
  + ' <extension name="Time" prefix="time" uri="http://www.xes-standard.org/time.xesext"/>\n'
  + ' <extension name="Wildlands" prefix="wl" uri="urn:wildlands:process:1"/>\n'
  + ' <global scope="trace">' + attribute('string', 'concept:name', '__INVALID__') + '</global>\n'
  + ' <global scope="event">' + attribute('string', 'concept:name', '__INVALID__') + attribute('string', 'lifecycle:transition', 'complete')
  + attribute('date', 'time:timestamp', timestamp(0)) + '</global>\n'
  + ' <classifier name="Activity" keys="concept:name"/>\n'
  + ' <classifier name="Activity and transition" keys="concept:name lifecycle:transition"/>\n'
  + ' ' + attribute('string', 'concept:name', d.name) + attribute('string', 'wl:process', d.id) + attribute('int', 'wl:seed', seed) + '\n';
}
export function xesEvent(e: LWProcess.Event, names: ReadonlyMap<string, string>): string {
 return '  <event>' + attribute('string', 'concept:name', names.get(e.stepId) ?? e.kind)
  + attribute('string', 'lifecycle:transition', LIFECYCLE[e.kind] ?? 'unknown') + attribute('date', 'time:timestamp', timestamp(e.minute))
  + attribute('string', 'wl:kind', e.kind) + attribute('int', 'wl:minute', e.minute)
  + (e.stepId ? attribute('string', 'wl:step', e.stepId) : '') + (e.detail ? attribute('string', 'wl:detail', e.detail) : '') + '</event>\n';
}
export const xesTrace = (caseId: string, status: string, events: readonly string[]) =>
 ' <trace>' + attribute('string', 'concept:name', caseId) + attribute('string', 'wl:status', status) + '\n' + events.join('') + ' </trace>\n';
/** Opens a streamed log at `file` (guarded against `inputs`); events are formatted as they arrive and written in chunks. */
export function openEventLog(file: string, format: LogFormat, d: LWProcess.Definition, seed: number, inputs: readonly string[]): EventLog {
 const destination = guardOutput(file, inputs), temporary = destination + '.' + randomUUID() + '.tmp';
 const names = new Map(d.steps.map(s => [s.id, s.name])), open = new Map<string, string[]>();
 const descriptor = fs.openSync(temporary, 'wx');
 let buffer = '', events = 0, closed = false;
 const put = (text: string) => {
  buffer += text;
  if (buffer.length >= CHUNK) {
   fs.writeSync(descriptor, buffer, null, 'utf8');
   buffer = '';
  }
 };
 const finish = () => {
  closed = true;
  if (buffer) fs.writeSync(descriptor, buffer, null, 'utf8');
  buffer = '';
  fs.closeSync(descriptor);
 };
 put(format === 'csv' ? CSV_HEADER : xesHeader(d, seed));
 return {
  write(e) {
   events++;
   if (format === 'csv') {
    put(csvRow(e, names));
    return;
   }
   const trace = open.get(e.caseId) ?? [];
   trace.push(xesEvent(e, names));
   const status = TERMINAL[e.kind];
   if (status === undefined) open.set(e.caseId, trace);
   else {
    open.delete(e.caseId);
    put(xesTrace(e.caseId, status, trace));
   }
  },
  close() {
   if (format === 'xes') {
    for (const [caseId, trace] of open) put(xesTrace(caseId, 'active', trace));
    put('</log>\n');
   }
   finish();
   fs.renameSync(temporary, destination);
   return {file: destination, format, events};
  },
  abort() {
   if (!closed) {
    try { finish(); } catch { /* the temporary file is removed below either way */ }
   }
   fs.rmSync(temporary, {force: true});
  }
 };
}
