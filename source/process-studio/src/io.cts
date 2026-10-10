/**
 * The agent protocol of one invocation: exactly one JSON object on stdout (pretty, or one line with `--compact`),
 * except `slides --format md` without `--output`, which prints the Markdown deck itself. Files are read with the
 * shared bounded reader and written with the shared atomic, alias-guarded writers (src/kernel.cts), so an output
 * never replaces an input, not even through a hard or symbolic link, and a failed write leaves no partial file.
 */
import {readJsonFile, writeJsonFile} from './kernel.cjs';

/** Largest input file any process command reads (8 MiB), as `wildlands process`. */
export const MAX_INPUT_BYTES = 8 * 1024 * 1024;
export const PROTOCOL_VERSION = 1;

/** What a command handler may do: read its options and inputs, write outputs and print its one result. */
export interface Context {
 readonly command: string;
 readonly values: ReadonlyMap<string, string>;
 has(key: string): boolean;
 get(key: string): string | undefined;
 /** A required option's value (the dispatcher has already checked presence). */
 required(key: string): string;
 /** A JSON input file: bounded, UTF-8, one leading BOM removed. */
 read(file: string): unknown;
 /** Write `value` as JSON to `--output`, refusing any of `inputs`; returns the absolute output path. */
 output(value: unknown, inputs: readonly string[]): string;
 /** Print any one JSON object. */
 emit(value: unknown): void;
 /** Print `{ok: true, protocolVersion: 1, ...value}`. */
 success(value: Record<string, unknown>): void;
 /** Print plain text (the Markdown deck). */
 text(value: string): void;
 /** Exit code for a completed but negative result (validation rejected, nonconforming BPMN). */
 exit(code: number): void;
}

export function emitJson(value: unknown, compact: boolean): void {
 process.stdout.write((compact ? JSON.stringify(value) : JSON.stringify(value, null, 2)) + '\n');
}

export function readJson(file: string): unknown {
 return JSON.parse(readJsonFile(file, MAX_INPUT_BYTES).replace(/^﻿/, '')) as unknown;
}

export function context(command: string, values: ReadonlyMap<string, string>, compact: boolean): Context {
 const required = (key: string): string => {
  const value = values.get(key);
  if (!value) throw Error('Missing ' + key);
  return value;
 };
 const emit = (value: unknown): void => emitJson(value, compact);
 return {command, values, required, emit,
  has: key => values.has(key),
  get: key => values.get(key),
  read: readJson,
  output: (value, inputs) => writeJsonFile(required('--output'), value, inputs),
  success: value => emit({ok: true, protocolVersion: PROTOCOL_VERSION, ...value}),
  text: value => { process.stdout.write(value); },
  exit: code => { process.exitCode = code; }};
}

/** The failure envelope of every process command: exit 2, `process-operation-failed`, one message. */
export function failure(error: unknown, compact: boolean): void {
 const message = error instanceof Error ? error.message : String(error);
 emitJson({ok: false, protocolVersion: PROTOCOL_VERSION, code: 'process-operation-failed', errors: [message]}, compact);
 process.exitCode = 2;
}
