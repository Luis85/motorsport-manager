/// <reference path="../process-contracts.d.ts" />
/**
 * Hostile process definitions for the process-hostile-browser suite (ENG-16): pure data builders with no page access.
 *
 * Every free-text field the process schema allows (process name and description, `$schema`, step names, descriptions, phases,
 * pain and opportunity notes, technology labels, flow labels, need and output labels, track labels, SIPOC names, supplies and
 * receives, pool names, string case values in set, arrival data, draws and conditions) holds markup and text built to break a
 * view that treats it as HTML, an attribute, a URL, CSS or a fixed-width string. Identifiers (ids, scene ids, case-field names)
 * follow fixed patterns in the schema and cannot hold free text, so they stay plain.
 *
 * Every payload that would run calls `__hit(n)` with its own number; the suite's probe defines `__hit` and records each call, so
 * a payload that executes is named by its number. Payloads are at most 40 characters so the shortest free-text field (phase and
 * track labels) can hold any one of them.
 */

/** Script-shaped payloads, each at most 40 characters. The number in `__hit(n)` names the payload in a failure. */
export const PAYLOADS = [
 '<img src=x onerror=__hit(1)>',
 '"><svg onload=__hit(2)>',
 '</textarea><script>__hit(3)</script>',
 '\' onfocus=__hit(4) autofocus x=\'',
 '" onmouseover=__hit(5) x="',
 '</style><img src=x onerror=__hit(6)>',
 '<a href="javascript:__hit(7)">link</a>',
 '&lt;img src=x onerror=__hit(8)&gt;',
 '<iframe src=javascript:__hit(9)>',
 '<svg><style><img src onerror=__hit(10)>',
 '--><img src=x onerror=__hit(11)><!--',
 ']]><img src=x onerror=__hit(12)>',
 '${__hit(13)}{{__hit(14)}}',
 'javascript:__hit(15)//',
 '};*{display:none}/*</title>',
] as const;
/** Text that is not markup but breaks careless layout or encoding: right-to-left, combining marks, controls and one long word. */
export const TEXTS = {
 rtl: '‮exe.txt‬ مرحبا שלום',
 combining: 'Z̷̢͉a̸l̶g̵o̴ ńäme',
 /** C0 and C1 controls without NUL; XML 1.0 cannot carry most of them, so the BPMN round trip uses `xmlSafe`. */
 control: 'ctl\u0001\u0007\u0008\u000b\u000c\r\u001b\u001f\u007f\u0085end',
 word: 'Antidisestablishmentarianismfloccinaucinihilipilification',
} as const;

/** The first free-text value of field number `k` of length `max`: a tag, then payloads from `k` on that fit, then plain texts. */
export function hostile(k: number, max: number, tag: string): string {
 const extras = [TEXTS.rtl, TEXTS.combining, TEXTS.control, TEXTS.word];
 let out = tag;
 for (let i = 0; i < PAYLOADS.length + extras.length; i++) {
  const pick = i < PAYLOADS.length ? PAYLOADS[(k + i) % PAYLOADS.length]! : extras[(k + i) % extras.length]!;
  if ((out + ' ' + pick).length <= max) out += ' ' + pick;
 }
 return out;
}
/** Every payload and text, joined: the description fields hold them all. */
export const EVERYTHING = [...PAYLOADS, ...Object.values(TEXTS)].join(' \n ');
/** A copy of `d` with every character XML 1.0 cannot carry (C0 controls other than tab, newline and return) removed from its strings. */
export function xmlSafe<T>(d: T): T {
 const strip = (text: string) => text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
 return JSON.parse(JSON.stringify(d), (_key, value: unknown) => typeof value === 'string' ? strip(value) : value) as T;
}

const scene = (id: string, x: number, y = 0) => ({id: 'scene-' + id, position: [x, y] as [number, number], color: '#91b9d5'});

/**
 * One admitted definition that uses every free-text field, with forks, a decision with string conditions, a deadline, multiple
 * instances, a timer, a touchpoint, machine and system steps with technology, needs, outputs, draws, tracked fields and SIPOC
 * parties. `genre` picks the lens (SIPOC for a process, Journey for a journey); `nameTag` starts the process name.
 */
export function hostileDefinition(genre: LWProcess.Genre = 'process', id = 'hostile-desk', nameTag = 'NAME'): LWProcess.Definition {
 let k = 0;
 const t = (max: number, tag: string) => hostile(k++, max, tag);
 const value = (tag: string) => t(256, tag);
 const verdict = value('V1'), other = value('V2');
 const steps: LWProcess.Step[] = [
  {id: 'start', name: t(120, 'S0'), kind: 'start', description: EVERYTHING, phase: t(40, 'P0'), scene: scene('start', 0)},
  {id: 'intake', name: t(120, 'S1'), kind: 'task', duration: 6, cost: 2, resources: {crew: 1}, description: t(2000, 'D1'),
   set: {verdict, note: value('N1')}, add: {score: 2}, phase: t(40, 'P1'), pain: t(240, 'PAIN1'), opportunity: t(240, 'OPP1'),
   outputs: [{field: 'verdict', label: t(120, 'O1')}, {field: 'score', label: t(120, 'O2')}],
   draws: [{field: 'tier', kind: 'choice', values: [{value: verdict, weight: 1}, {value: other, weight: 1}]},
    {field: 'flag', kind: 'chance', percent: 50, whenTrue: value('W1'), whenFalse: value('W2')}],
   timing: {dist: 'uniform', min: 3, max: 9}, scene: scene('intake', 14)},
  {id: 'route', name: t(120, 'S2'), kind: 'decision', phase: t(40, 'P2'), scene: scene('route', 28)},
  {id: 'pack', name: t(120, 'S3'), kind: 'machine', duration: 5, resources: {arm: 1}, technology: t(80, 'TECH1'),
   needs: [{field: 'verdict', label: t(120, 'NEED1')}, {field: 'note', op: 'ne', value: other, label: t(120, 'NEED2')}],
   deadline: {after: 4, mode: 'interrupt', flow: 'pack-late'}, set: {packed: other}, outputs: [{field: 'packed', label: t(120, 'O3')}],
   scene: scene('pack', 42, -8)},
  {id: 'fan', name: t(120, 'S4'), kind: 'fork', join: 'merge', scene: scene('fan', 42, 8)},
  {id: 'build', name: t(120, 'S5'), kind: 'system', duration: 3, resources: {ci: 1}, technology: t(80, 'TECH2'),
   instances: {count: 3, mode: 'parallel'}, add: {score: 1}, scene: scene('build', 56, 4)},
  {id: 'cool', name: t(120, 'S6'), kind: 'timer', duration: 5, description: t(2000, 'D6'), scene: scene('cool', 56, 14)},
  {id: 'merge', name: t(120, 'S7'), kind: 'join', scene: scene('merge', 70, 8)},
  {id: 'visit', name: t(120, 'S8'), kind: 'touchpoint', channel: 'web', duration: 2, phase: t(40, 'P8'), emotion: -2,
   pain: t(240, 'PAIN8'), opportunity: t(240, 'OPP8'), add: {score: -1}, scene: scene('visit', 84)},
  {id: 'review', name: t(120, '=1+2 S9'), kind: 'task', duration: 4, resources: {crew: 1}, backlog: {capacity: 4}, scene: scene('review', 98)},
  {id: 'done', name: t(120, 'S10'), kind: 'end', outcome: 'goal', phase: t(40, 'P10'), scene: scene('done', 112)},
  {id: 'lost', name: t(120, '@SUM(1) S11'), kind: 'end', outcome: 'lost', scene: scene('lost', 70, -14)},
 ];
 const flows: LWProcess.Flow[] = [
  {id: 'f1', from: 'start', to: 'intake', label: t(120, 'F1')},
  {id: 'f2', from: 'intake', to: 'route', label: t(120, 'F2')},
  {id: 'f3', from: 'route', to: 'pack', label: t(120, 'F3'), when: {field: 'tier', op: 'eq', value: verdict}},
  {id: 'f4', from: 'route', to: 'lost', label: t(120, 'F4'), when: {all: [{field: 'flag', op: 'eq', value: other}, {chance: 10}]}},
  {id: 'f5', from: 'route', to: 'fan', label: t(120, 'F5')},
  {id: 'f6', from: 'pack', to: 'visit', label: t(120, 'F6')},
  {id: 'pack-late', from: 'pack', to: 'lost', on: 'deadline', label: t(120, 'F7')},
  {id: 'f8', from: 'fan', to: 'build', label: t(120, 'F8')},
  {id: 'f9', from: 'fan', to: 'cool', label: t(120, 'F9')},
  {id: 'f10', from: 'build', to: 'merge'},
  {id: 'f11', from: 'cool', to: 'merge'},
  {id: 'f12', from: 'merge', to: 'visit', label: t(120, 'F12')},
  {id: 'f13', from: 'visit', to: 'review'},
  {id: 'f14', from: 'review', to: 'done', label: t(120, '-F14')},
 ];
 return {
  $schema: t(256, 'SCHEMA'), format: 'wildlands-process', schemaVersion: 1, revision: 1, id, name: t(120, nameTag), description: EVERYTHING,
  start: 'start', seed: 7, genre, calendar: {minutesPerDay: 480, daysPerWeek: 5},
  track: [{field: 'score', label: t(40, 'TR1')}],
  sipoc: {suppliers: [{name: t(60, 'SUP1'), supplies: t(160, 'SUPPLIES1')}, {name: t(60, 'SUP2')}],
   customers: [{name: t(60, 'CUS1'), receives: t(160, 'RECEIVES1')}]},
  resources: [{id: 'crew', name: t(120, 'POOL1'), capacity: 2, costPerMinute: 1},
   {id: 'arm', name: t(120, 'POOL2'), capacity: 1, costPerMinute: 2, kind: 'machine'},
   {id: 'ci', name: t(120, '+POOL3'), capacity: 2, costPerMinute: 1, kind: 'system'}],
  steps, flows,
  arrivals: [{at: 0, count: 8, interval: 3, data: {note: value('=A1'), memo: value('A2'), score: 0},
   draws: [{field: 'channel', kind: 'choice', values: [{value: value('C1'), weight: 2}, {value: value('C2'), weight: 1}]}]}],
 };
}

/**
 * A foreign BPMN 2.0 file (not written by the studio) whose process, lane, task, gateway and flow names are payloads: an unsupported
 * complex gateway makes the importer reject it, and a flow to a missing element is a standards problem. Names hold payloads only
 * (no whitespace controls, which XML attribute normalisation would turn into spaces), so `names` is exactly what a view shows.
 */
export function foreignBpmn(): {text: string; names: {process: string; lane: string}} {
 const xml = (text: string) => text.replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;'})[c]!);
 const name = (k: number) => [0, 1, 2].map(i => PAYLOADS[(k + i) % PAYLOADS.length]).join(' ');
 const names = {process: name(0), lane: name(3)};
 const text = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" id="Defs" targetNamespace="urn:hostile">
 <bpmn:process id="Hostile_process" name="${xml(names.process)}" isExecutable="true">
  <bpmn:laneSet id="Lanes"><bpmn:lane id="Lane_1" name="${xml(names.lane)}">
   <bpmn:flowNodeRef>Start</bpmn:flowNodeRef><bpmn:flowNodeRef>Task_1</bpmn:flowNodeRef></bpmn:lane></bpmn:laneSet>
  <bpmn:startEvent id="Start" name="${xml(name(6))}"/>
  <bpmn:task id="Task_1" name="${xml(name(9))}"><bpmn:documentation>${xml(EVERYTHING)}</bpmn:documentation></bpmn:task>
  <bpmn:complexGateway id="Gateway_1" name="${xml(name(12))}"/>
  <bpmn:endEvent id="End" name="${xml(name(1))}"/>
  <bpmn:sequenceFlow id="Flow_1" name="${xml(name(4))}" sourceRef="Start" targetRef="Task_1"/>
  <bpmn:sequenceFlow id="Flow_2" name="${xml(name(7))}" sourceRef="Task_1" targetRef="Gateway_1"/>
  <bpmn:sequenceFlow id="Flow_3" sourceRef="Gateway_1" targetRef="End"/>
  <bpmn:sequenceFlow id="Flow_4" sourceRef="Task_1" targetRef="Missing_element"/>
 </bpmn:process>
</bpmn:definitions>
`;
 return {text: xmlSafe(text), names};
}
