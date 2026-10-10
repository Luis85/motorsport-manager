/** Deterministic presentation stage for authored JSON and generated recipe evidence. */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { format, version } from 'prettier';

export async function formatAuthoredJson(directory) {
  if (version !== '3.6.2')
    throw new Error(`Authored JSON requires pinned Prettier 3.6.2; found ${version}.`);
  const files = readdirSync(directory, { withFileTypes: true }).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  for (const entry of files) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await formatAuthoredJson(path);
    else if (entry.isFile() && entry.name.endsWith('.json')) {
      const before = readFileSync(path, 'utf8');
      const after = await format(before, {
        parser: 'json',
        printWidth: 100,
        trailingComma: 'all',
        singleQuote: true,
      });
      // Formatting is not permission to migrate, round, reorder arrays or repair data.
      if (JSON.stringify(JSON.parse(before)) !== JSON.stringify(JSON.parse(after)))
        throw new Error(`Formatting changed JSON values: ${path}`);
      if (before !== after) writeFileSync(path, after);
    }
  }
}
