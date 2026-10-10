/**
 * `doctor`: whether this installation can run every command. Checks Node.js, the process engine (a starter definition
 * is created, validated and run for one minute), the embedded engine kit and an in-memory `build` of that starter.
 * `build` is embedded, so no Wildlands CLI is needed or looked for. Exit 1 with `process-studio-doctor-failed` when a check fails.
 */
import {authoring, catalog, runtime} from './kernel.cjs';
import {buildHtml} from './assemble.cjs';
import {distribution} from './kit.cjs';
import {TOOL} from './version.cjs';
import type {Context} from './io.cjs';

interface Check {readonly id: string; readonly ok: boolean; readonly detail: Record<string, unknown>;}
const message = (error: unknown): string => error instanceof Error ? error.message : String(error);
function check(id: string, probe: () => Record<string, unknown>): Check {
 try { return {id, ok: true, detail: probe()}; } catch (error) { return {id, ok: false, detail: {error: message(error)}}; }
}

export function doctor(ctx: Context): void {
 const current = distribution(), starter = (): LWProcess.Definition => authoring.create('doctor', 'Doctor');
 const checks = [
  check('node', () => {
   const major = Number(process.versions.node.split('.')[0]);
   if (major < 22) throw Error(`Node.js ${process.versions.node} is too old; Process Studio needs Node.js 22 or newer.`);
   return {version: process.versions.node, required: '>=22'};
  }),
  check('kernel', () => {
   const definition = starter(), checked = catalog.validate(definition, false);
   if (!checked.ok) throw Error('The starter definition does not validate.');
   const session = runtime.create(definition);
   try { return {format: 'wildlands-process', schemaVersion: 1, limits: runtime.limits, starterMinute: session.advance(1).minute}; }
   finally { session.dispose(); }
  }),
  check('engine-kit', () => {
   const kit = current.kit();
   return {distribution: current.kind, engine: kit.engine, profile: kit.profile, template: kit.template, inserts: Object.keys(kit.inserts).length};
  }),
  check('build', () => ({embedded: true, wildlandsRequired: false, starterBytes: buildHtml(starter(), current.kit()).bytes}))
 ];
 const ok = checks.every(entry => entry.ok);
 ctx.emit({ok, protocolVersion: 1, ...ok ? {} : {code: 'process-studio-doctor-failed'}, tool: TOOL, checks});
 if (!ok) ctx.exit(1);
}
