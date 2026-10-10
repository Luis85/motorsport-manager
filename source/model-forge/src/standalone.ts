/**
 * Repository-level executable `bin/model-forge`: scripts/standalone.mjs bundles this entry,
 * every JavaScript dependency except Playwright and the packaged assets into one CommonJS
 * file, so it has no top-level await and runs without node_modules.
 */
import { createCli } from './commands/create-cli.js';

const helpFooter = `
Handbook: source/model-forge/README.md (repository root). One document = one model.
Discover: model-forge discover | model-forge describe <command...> | model-forge schema --kind batch --raw
Output: stdout {"ok":true,"data":...} with exit 0; stderr {"ok":false,"error":{code,message,...}} with exit 1.
review and preview capture render through Playwright and Chromium (not bundled); run model-forge doctor.
`;

// A closed downstream pipe (e.g. `model-forge --help | head`) ends output, not the process.
for (const stream of [process.stdout, process.stderr])
  stream.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EPIPE') process.exit(process.exitCode ?? 0);
    throw error;
  });

void createCli({}, { name: 'model-forge', helpFooter })
  .run(process.argv.slice(2))
  .then((status) => {
    process.exitCode = status;
  });
