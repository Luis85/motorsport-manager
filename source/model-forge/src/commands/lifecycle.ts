import { emptyDocument } from '../application/import.js';
import { createFromExample } from '../infra/examples.js';
import { importDocument } from '../infra/importers.js';
import { createDocument, documentKindForPath } from '../infra/store.js';
import type { CommandContext } from './context.js';

const next = (name: string, file: string) => [
  [name, '-d', file, 'inspect', '--source'],
  [name, 'schema', '--kind', 'batch', '--raw'],
  [name, '-d', file, 'apply', '--file', '<batch.json>', '--dry-run'],
];

export function registerLifecycleCommands(c: CommandContext) {
  const { program, output, resolvePath } = c;
  program
    .command('create <path>')
    .description('Create a new model document (<id>.model.json or <id>.model-bundle.json)')
    .requiredOption('--id <id>', 'Model ID')
    .requiredOption('--name <name>', 'Display name')
    .option('--category <text>', 'Library category')
    .option('--description <text>', 'Short description')
    .option('--example <id>', 'Start from a bundled example; its dependencies stay frozen')
    .action(async (file: string, opts) => {
      const target = resolvePath(file);
      const metadata = {
        id: opts.id,
        name: opts.name,
        category: opts.category,
        description: opts.description,
      };
      const created = opts.example
        ? await createFromExample(opts.example, target, metadata)
        : await createDocument(target, emptyDocument(documentKindForPath(target), metadata));
      output({ ...created, nextCommands: next(program.name(), created.path) });
    });
  program
    .command('import')
    .description(
      'Create a new document from a model, model-bundle, Scene Forge project model or Littlewild visual',
    )
    .option('--from <file>', 'Source JSON file')
    .option('--project <directory>', 'Scene Forge project to read (read-only)')
    .option('--id <model>', 'Model ID inside --project')
    .requiredOption('--out <path>', 'New document path; never overwritten')
    .option('--entry <id>', 'Model inside a model-bundle source; defaults to its entry')
    .option('--variant <name>', 'Littlewild source variant; defaults to the first')
    .option('--prefix <id>', 'Model ID prefix for Littlewild sources')
    .option('--dry-run', 'Plan and validate without writing')
    .action(async (opts) => {
      const result = await importDocument({
        from: opts.from ? resolvePath(opts.from) : undefined,
        project: opts.project ? resolvePath(opts.project) : undefined,
        id: opts.id,
        out: resolvePath(opts.out),
        entry: opts.entry,
        variant: opts.variant,
        prefix: opts.prefix,
        dryRun: opts.dryRun,
      });
      output(
        result.dryRun ? result : { ...result, nextCommands: next(program.name(), result.path) },
      );
    });
}
