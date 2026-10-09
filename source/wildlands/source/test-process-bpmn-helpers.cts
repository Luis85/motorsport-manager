/// <reference path="./process-contracts.d.ts" />
/** Shared harness and fixtures for the business-process-bpmn suite (entry: test-process-bpmn.cts). */
export const results: {name: string; passed: boolean; error?: string}[] = [];
export function test(name: string, work: () => void): void {try {work(); results.push({name, passed: true});} catch (e) {results.push({name, passed: false, error: String(e)});}}
export const stepOf = (id: string, kind: LWProcess.Kind, at: number, extra: Partial<LWProcess.Step> = {}): LWProcess.Step => ({id, name: id, kind, scene: {id: 'scene-' + id, position: [at * 12, 0], color: '#ffbb73'}, ...extra});
export const flowOf = (from: string, to: string, when?: LWProcess.Condition): LWProcess.Flow => ({id: from + '-' + to, from, to, ...when ? {when} : {}});
export const cond = (c: object) => c as LWProcess.Condition;
export const define = (steps: LWProcess.Step[], flows: LWProcess.Flow[], data: LWProcess.Fields = {}) =>
 ({format: 'wildlands-process', schemaVersion: 1, revision: 0, id: 'timed', name: 'Timed', start: 'start', resources: [], steps, flows, arrivals: [{at: 0, count: 1, interval: 0, data}]}) as LWProcess.Definition;
export const M = 'xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"';
export const foreign = (body: string) => `<?xml version="1.0"?><bpmn:definitions ${M} id="D"><bpmn:process id="P" name="Timer">${body}</bpmn:process></bpmn:definitions>`;
export const flow = (id: string, from: string, to: string, inner = '') => `<bpmn:sequenceFlow id="${id}" sourceRef="${from}" targetRef="${to}">${inner}</bpmn:sequenceFlow>`;
