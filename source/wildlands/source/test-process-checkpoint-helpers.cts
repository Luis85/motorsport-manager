/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-checkpoint.ts" />
/** Shared fixtures of the business-process-checkpoint suite (entry: test-process-checkpoint.cts): the demos and checkpoint helpers. */
import fs from 'node:fs';
import path from 'node:path';
import {runtime} from './process-sdk.cjs';
export const checkpoints = (globalThis as unknown as {LWProcessCheckpoint: LWProcessCheckpoint.Api}).LWProcessCheckpoint;
export const DEMOS = path.resolve(__dirname, '../../../docs/concepts/agency-delivery/content');
/** Every process demo of the agency game, by file name. */
export const demoFiles = () => fs.readdirSync(DEMOS).filter(f => f.endsWith('.process.json')).sort();
export const demo = (file: string) => JSON.parse(fs.readFileSync(path.join(DEMOS, file), 'utf8')) as LWProcess.Definition;
/** A checkpoint of `d` run with `options` to `minute` (advanced in one command), as the JSON text a file would hold. */
export function checkpointText(d: LWProcess.Definition, minute: number, options: LWProcess.RunOptions = {}): string {
 const session = runtime.create(d, options);
 try {
  if (minute > 0) session.advance(minute);
  return JSON.stringify(checkpoints.create(d, session.horizon(), session.state()));
 } finally { session.dispose(); }
}
/** The detached reads a restored run must reproduce exactly. */
export function reads(session: LWProcess.Session): string {
 return JSON.stringify({snapshot: session.query(), series: session.series(), distributions: session.distributions(), recent: session.recent(),
  state: session.state()});
}
