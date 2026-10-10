import type { z } from 'zod';
import { fail } from './errors.js';

/** Validate untrusted JSON: reject cycles and excessive depth, then narrow through a schema. */
export function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const pending: [unknown, number, boolean][] = [[input, 0, false]];
  const visited = new WeakSet<object>(),
    active = new WeakSet<object>();
  while (pending.length) {
    const [value, depth, leaving] = pending.pop()!;
    if (value && typeof value === 'object') {
      if (leaving) {
        active.delete(value);
        continue;
      }
      if (active.has(value)) fail('CYCLE', 'Input must be acyclic JSON data.');
      if (depth > 128) fail('DEPTH_LIMIT', 'Input nesting exceeds 128 levels.');
      if (visited.has(value)) continue;
      visited.add(value);
      active.add(value);
      pending.push([value, depth, true]);
      for (const child of Object.values(value)) pending.push([child, depth + 1, false]);
    }
  }
  const result = schema.safeParse(input);
  if (!result.success)
    fail(
      'SCHEMA_INVALID',
      'Input does not match the schema. Use the schema command to inspect the contract.',
      result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    );
  return result.data;
}
