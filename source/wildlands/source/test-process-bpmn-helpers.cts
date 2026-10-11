/// <reference path="./process-contracts.d.ts" />
/**
 * Shared harness and fixtures for the business-process-bpmn suite (entry: test-process-bpmn.cts): the result list and `test`
 * runner, Wildlands definition builders, and the foreign BPMN/BPSim document builders used by the import, export and CLI checks.
 */
export const results: {name: string; passed: boolean; error?: string}[] = [];
export function test(name: string, work: () => void): void {
 try {
  work();
  results.push({name, passed: true});
 } catch (e) {
  results.push({name, passed: false, error: String(e)});
 }
}
export const stepOf = (id: string, kind: LWProcess.Kind, at: number, extra: Partial<LWProcess.Step> = {}): LWProcess.Step =>
 ({id, name: id, kind, scene: {id: 'scene-' + id, position: [at * 12, 0], color: '#ffbb73'}, ...extra});
export const flowOf = (from: string, to: string, when?: LWProcess.Condition): LWProcess.Flow =>
 ({id: from + '-' + to, from, to, ...when ? {when} : {}});
export const cond = (c: object) => c as LWProcess.Condition;
/** Joins flag-free regular-expression literals into one pattern whose source is the parts' sources in order, so a long expected
 * pattern can be written across lines without changing what it matches. */
export const joinRegExp = (...parts: RegExp[]) => new RegExp(parts.map(p => p.source).join(''));
export const define = (steps: LWProcess.Step[], flows: LWProcess.Flow[], data: LWProcess.Fields = {}) =>
 ({
  format: 'wildlands-process', schemaVersion: 1, revision: 0, id: 'timed', name: 'Timed', start: 'start', resources: [], steps, flows,
  arrivals: [{at: 0, count: 1, interval: 0, data}],
 }) as LWProcess.Definition;
export const M = 'xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"';
export const foreign = (body: string) =>
 `<?xml version="1.0"?><bpmn:definitions ${M} id="D"><bpmn:process id="P" name="Timer">${body}</bpmn:process></bpmn:definitions>`;
export const flow = (id: string, from: string, to: string, inner = '') =>
 `<bpmn:sequenceFlow id="${id}" sourceRef="${from}" targetRef="${to}">${inner}</bpmn:sequenceFlow>`;

// ---------------------------------------------------------------- foreign BPMN with simulation semantics
export const BP = M + ' xmlns:bpsim="http://www.bpsim.org/schemas/1.0"';
export const S = '<bpmn:startEvent id="S"/>';
export const E = '<bpmn:endEvent id="E"/>';
/** One process "P" named "Edge" with the given body; `after` follows the process (callees, collaborations, BPSim). */
export const fdoc = (body: string, after = '') =>
 `<?xml version="1.0"?><bpmn:definitions ${BP} id="D"><bpmn:process id="P" name="Edge">${body}</bpmn:process>${after}</bpmn:definitions>`;
export const chain = (...ids: string[]) => ids.slice(1).map((id, i) => flow(ids[i]! + '-' + id, ids[i]!, id)).join('');
export const cx = (t: string) => `<bpmn:conditionExpression xsi:type="bpmn:tFormalExpression">${t}</bpmn:conditionExpression>`;
export const lane = (id: string, name: string, refs: string[]) =>
 `<bpmn:lane id="${id}" name="${name}">${refs.map(r => `<bpmn:flowNodeRef>${r}</bpmn:flowNodeRef>`).join('')}</bpmn:lane>`;
export const sim = (inner: string, id = 'base') =>
 '<bpmn:relationship type="BPSimData"><bpmn:extensionElements><bpsim:BPSimData>'
 + `<bpsim:Scenario id="${id}">${inner}</bpsim:Scenario>`
 + '</bpsim:BPSimData></bpmn:extensionElements><bpmn:source>P</bpmn:source><bpmn:target>P</bpmn:target></bpmn:relationship>';
export const ep = (ref: string, inner: string) => `<bpsim:ElementParameters elementRef="${ref}">${inner}</bpsim:ElementParameters>`;
export const param = (group: string, name: string, inner: string) =>
 `<bpsim:${group}><bpsim:${name}>${inner}</bpsim:${name}></bpsim:${group}>`;
export const time = (inner: string, name = 'ProcessingTime') => param('TimeParameters', name, inner);
export const prob = (p: number) => param('ControlParameters', 'Probability', `<bpsim:FloatingParameter value="${p}"/>`);
export const num = (v: number, unit = '') => `<bpsim:NumericParameter value="${v}"${unit ? ` timeUnit="${unit}"` : ''}/>`;
export const stepIn = (d: LWProcess.Definition, id: string) => d.steps.find(s => s.id === id)!;
export const whenIn = (d: LWProcess.Definition, id: string) => d.flows.find(f => f.id === id)?.when;
export const timerDef = (text: string) =>
 `<bpmn:timerEventDefinition><bpmn:timeDuration>${text}</bpmn:timeDuration></bpmn:timerEventDefinition>`;
