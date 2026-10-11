import { inspectDocument, documentHeader } from '../application/inspect.js';
import { validateEditorDocument } from '../application/document.js';
import { listHistory } from '../infra/store.js';
import { parseParameters } from './input.js';
import type { CommandContext } from './context.js';

export function registerReadCommands(c: CommandContext) {
  const { program, output, load } = c;
  program
    .command('inspect')
    .description('Identity, revision, stateHash, parameters, dependencies and compiled statistics')
    .option('--source', 'Include the complete document JSON')
    .option('--parameters <json>', 'Compile statistics at parameter overrides')
    .option('--node <id>', 'Include one node with world placement, bounds and statistics')
    .action(async (opts) => {
      const loaded = await load();
      output({
        path: loaded.path,
        ...inspectDocument(loaded.document, {
          source: opts.source,
          node: opts.node,
          parameters: parseParameters(opts.parameters),
        }),
      });
    });
  program
    .command('validate')
    .description('Validate schema, references, dependencies, parameters and generated geometry')
    .action(async () => {
      const loaded = await load();
      const validation = validateEditorDocument(loaded.document);
      output({ valid: true, path: loaded.path, ...documentHeader(loaded.document), ...validation });
    });
  program
    .command('history')
    .description('List stored revisions (restorable with restore <revision>) and the current one')
    .action(async () => output(await listHistory(c.documentPath())));
}
