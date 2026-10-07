import { promises as fs } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { fail, errorCode } from '../domain/errors.js';
import { embeddedAssets } from './embedded-assets.js';

/** Packaged runtime assets: the offline viewer and the bundled example catalog. */
export type AssetName = 'viewer.js' | 'viewer.css' | `examples/${string}`;

/**
 * Candidate files relative to this module: `dist/` beside the package build, then the
 * source tree (`src/infra` under `npm run cli`). Example files come from the catalog.
 */
function candidates(name: AssetName): string[] {
  const base = import.meta.url;
  if (!base) return [];
  const relative = name.startsWith('examples/')
    ? [`./${name}`, `../../examples/catalog/${name.slice('examples/'.length)}`]
    : [`./${name}`, `../../dist/${name}`];
  return relative.map((file) => fileURLToPath(new URL(file, base)));
}

/** Read a packaged asset from the executable itself, or from the package build directory. */
export async function readAsset(name: AssetName): Promise<string> {
  if (embeddedAssets) {
    const embedded = embeddedAssets[name];
    if (embedded !== undefined) return embedded;
    return fail(
      'BUILD_REQUIRED',
      `Packaged asset ${name} is missing from this executable. Rebuild it with npm run build:cli.`,
    );
  }
  for (const file of candidates(name)) {
    try {
      return await fs.readFile(file, 'utf8');
    } catch (error) {
      if (!['ENOENT', 'ENOTDIR'].includes(errorCode(error) ?? '')) throw error;
    }
  }
  return fail('BUILD_REQUIRED', `Packaged asset ${name} is missing. Run npm run build.`);
}
