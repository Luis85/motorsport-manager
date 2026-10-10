import type { Command } from 'commander';
import { fail } from '../kernel/index.js';

export const integer = (value: string) => {
  if (!/^\d+$/.test(value))
    return fail('INVALID_OPTION', `Expected a nonnegative integer, got ${value}.`);
  const n = Number(value);
  if (!Number.isSafeInteger(n)) fail('INVALID_OPTION', 'Integer is outside the safe range.');
  return n;
};
export const finite = (value: string) => {
  const n = Number(value);
  if (!value.trim() || !Number.isFinite(n))
    fail('INVALID_OPTION', `Expected a finite number, got ${value}.`);
  return n;
};
export const vector = (text: string): [number, number, number] => {
  const parts = text.split(',');
  const values = parts.map(Number);
  if (
    parts.some((v) => !v.trim()) ||
    values.length !== 3 ||
    values.some((n) => !Number.isFinite(n))
  )
    fail('INVALID_OPTION', 'Expected a comma-separated x,y,z vector.');
  return values as [number, number, number];
};
export const sourceOptions = (cmd: Command) =>
  cmd
    .option('--file <path>', 'Read JSON from a file, or - for stdin')
    .option('--data <json>', 'Inline JSON');
export const editOptions = (cmd: Command) =>
  cmd
    .option('--expected-revision <n>', 'Reject if the document revision differs', integer)
    .option('--expected-state <hash>', 'Reject if the model or its dependencies changed')
    .option('--dry-run', 'Validate and compile without writing');
