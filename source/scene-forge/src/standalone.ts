/**
 * Repository-level executable `bin/scene-forge`: scripts/standalone.mjs bundles this
 * entry, every JavaScript dependency except Playwright and the packaged assets into one
 * CommonJS file, so it has no top-level await and runs without node_modules.
 */
import { createCli } from './commands/create-cli.js';

const helpFooter = `
Handbook: docs/reference/scene-forge-cli.md (repository root).
Discover: scene-forge catalog | scene-forge describe <command...> | scene-forge schema --kind <kind> --raw
Output: stdout {"ok":true,"data":...} with exit 0; stderr {"ok":false,"error":{code,message,...}} with exit 1.
screenshot and review render through Playwright and Chromium (not bundled); run scene-forge doctor.
`;

// A closed downstream pipe (e.g. `scene-forge --help | head`) ends output, not the process with a crash.
for (const stream of [process.stdout, process.stderr])
  stream.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EPIPE') process.exit(process.exitCode ?? 0);
    throw error;
  });

void createCli({}, { name: 'scene-forge', helpFooter })
  .run(process.argv.slice(2))
  .then((status) => {
    process.exitCode = status;
  });
