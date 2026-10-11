/// <reference path="./process-contracts.d.ts" />
/** Shared harness and fixtures for the business-process suite (entry: test-process.cts). */
import fs from 'node:fs';
import path from 'node:path';
import {catalog, runtime, authoring} from './process-sdk.cjs';
require('./process-application.js');
export const application = (globalThis as unknown as {LWProcessApplication: LWProcessApp.Api}).LWProcessApplication;
export const results: {name: string; passed: boolean; error?: string}[] = [];
export function test(name: string, work: () => void): void {
 try {
  work();
  results.push({name, passed: true});
 } catch (e) {
  results.push({name, passed: false, error: String(e)});
 }
}
export const base = () => authoring.create('sample', 'Sample');
export const copy = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
export const agency = JSON.parse(
 fs.readFileSync(path.resolve(__dirname, '../../../docs/concepts/agency-delivery/content/agency.process.json'), 'utf8'),
) as LWProcess.Definition;
export function guard(d: LWProcess.Definition, operations: LWProcess.Recipe['operations']): LWProcess.Recipe {
 return {expectedRevision: d.revision, expectedFingerprint: catalog.fingerprint(d), operations};
}
export const run = (d: LWProcess.Definition, minutes: number) => {const s = runtime.create(d); try {return s.advance(minutes);} finally {s.dispose();}};
/** Builds a small admitted process from step overrides and flows; every step gets a scene on a line. */
export const stepOf = (id: string, kind: LWProcess.Kind, extra: Partial<LWProcess.Step> = {}, at = 0): LWProcess.Step => ({
 id, name: id, kind, scene: {id: 'scene-' + id, position: [at, 0], color: '#ffbb73'}, ...extra,
});
export const flowOf = (from: string, to: string, when?: LWProcess.Condition): LWProcess.Flow => ({id: from + '-' + to, from, to, ...when ? {when} : {}});
export const build = (
 steps: LWProcess.Step[],
 flows: LWProcess.Flow[],
 arrivals: LWProcess.Arrival[] = [{at: 0, count: 1, interval: 0, data: {}}],
 resources: LWProcess.Resource[] = [],
) => ({
 format: 'wildlands-process', schemaVersion: 1, revision: 0, id: 'timed', name: 'Timed', start: 'start', resources,
 steps: steps.map((s, i) => ({...s, scene: {...s.scene, position: [i * 12, 0] as [number, number]}})),
 flows,
 arrivals,
}) as LWProcess.Definition;
export const startEnd = (...middle: LWProcess.Step[]) => [stepOf('start', 'start'), ...middle, stepOf('end', 'end')];
