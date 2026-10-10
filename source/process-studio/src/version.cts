/** `version` and `--version`: what this executable is, which process format it speaks and which engine it carries. */
import {distribution} from './kit.cjs';
import type {Context} from './io.cjs';

const manifest = require('../package.json') as {name: string; version: string};
export const TOOL = {name: manifest.name, version: manifest.version, handbook: 'docs/reference/process-studio-cli.md'} as const;
/** The definition format and version the kernel reads and writes. */
export const KERNEL_FORMAT = {format: 'wildlands-process', schemaVersion: 1} as const;

export function version(ctx: Context): void {
 const current = distribution();
 ctx.success({name: TOOL.name, version: TOOL.version, kernel: KERNEL_FORMAT, engine: current.kit().engine,
  distribution: current.kind, sourceIdentity: current.sourceIdentity});
}
