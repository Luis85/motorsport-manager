import { createRequire } from 'node:module';
import { realpathSync } from 'node:fs';
import path from 'node:path';
import { fail, errorCode, errorMessage } from '../domain/errors.js';

/**
 * Playwright is an optional runtime dependency. The package build lists it, but the
 * standalone executable never bundles it, so browser commands resolve it lazily.
 */
export type PlaywrightModule = typeof import('playwright');
export interface PlaywrightLocation {
  /** `default`: the running module's own resolution; otherwise the resolved entry file. */
  resolvedFrom: string;
  module: PlaywrightModule;
}
export interface PlaywrightEnvironment {
  cwd: string;
  entry?: string;
  execPath: string;
  platform: NodeJS.Platform;
  /**
   * Repository-relative package directory searched beside a repository-level executable.
   * Defaults to `source/scene-forge`, whose lockfile installs Playwright.
   */
  packageDirectory?: string;
}
const defaultPackageDirectory = 'source/scene-forge';

const notFound = (error: unknown) =>
  ['MODULE_NOT_FOUND', 'ERR_MODULE_NOT_FOUND'].includes(errorCode(error) ?? '');

function realDirectory(file: string | undefined) {
  if (!file) return undefined;
  try {
    return path.dirname(realpathSync(file));
  } catch {
    return path.dirname(path.resolve(file));
  }
}

/**
 * Fallback directories, in order: the working directory, the tool package beside a
 * repository-level executable (default: Scene Forge beside `bin/scene-forge`), and the
 * global npm module root of this Node.
 * NODE_PATH is honored by every lookup.
 */
export function playwrightSearchRoots(environment: PlaywrightEnvironment): string[] {
  const entry = realDirectory(environment.entry);
  const prefix = path.dirname(environment.execPath);
  const roots = [
    environment.cwd,
    ...(entry
      ? [path.join(entry, '..', environment.packageDirectory ?? defaultPackageDirectory)]
      : []),
    environment.platform === 'win32' ? prefix : path.join(prefix, '..', 'lib'),
  ];
  return [...new Set(roots.map((root) => path.resolve(root)))];
}

export const playwrightRemedies = [
  'From a repository checkout: cd source/scene-forge && npm ci (bin/scene-forge then finds source/scene-forge/node_modules/playwright).',
  'Anywhere: npm install --global playwright, or set NODE_PATH to a node_modules directory that contains playwright.',
  'Then provide Chromium: npx playwright install chromium (Linux: --with-deps), or set FORGE_CHROMIUM_PATH.',
];

/** The running process's environment, optionally naming the tool's package directory. */
export const playwrightEnvironment = (packageDirectory?: string): PlaywrightEnvironment => ({
  cwd: process.cwd(),
  entry: process.argv[1],
  execPath: process.execPath,
  platform: process.platform,
  ...(packageDirectory ? { packageDirectory } : {}),
});

/** Resolve Playwright or fail with PLAYWRIGHT_UNAVAILABLE and the searched locations. */
export async function loadPlaywright(
  environment: PlaywrightEnvironment = playwrightEnvironment(),
  importDefault: () => Promise<PlaywrightModule> = () => import('playwright'),
): Promise<PlaywrightLocation> {
  const reasons: string[] = [];
  try {
    return { resolvedFrom: 'default', module: await importDefault() };
  } catch (error) {
    if (!notFound(error)) throw error;
    reasons.push(errorMessage(error).split('\n')[0]);
  }
  const roots = playwrightSearchRoots(environment);
  for (const root of roots) {
    try {
      const load = createRequire(path.join(root, 'noop.js'));
      const resolved = load.resolve('playwright');
      return { resolvedFrom: resolved, module: load(resolved) as PlaywrightModule };
    } catch (error) {
      if (!notFound(error)) throw error;
    }
  }
  return fail(
    'PLAYWRIGHT_UNAVAILABLE',
    'This command renders in headless Chromium through Playwright, which is not bundled with this executable and could not be resolved.',
    {
      searched: ['module resolution of the running CLI and NODE_PATH', ...roots],
      reasons,
      remedies: playwrightRemedies,
    },
  );
}
