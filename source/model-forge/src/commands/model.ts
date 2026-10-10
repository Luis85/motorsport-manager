import { fail } from '../kernel/index.js';
import { parseOperations } from '../application/edit.js';
import type { EditOptions } from '../application/edit.js';
import { editOptions, finite, sourceOptions } from './options.js';
import type { CommandContext } from './context.js';

/** Parameters, metadata and frozen dependencies: thin wrappers over model operations. */
export function registerModelCommands(c: CommandContext) {
  const { program, output, input } = c;
  const commit = async (operation: unknown, opts: EditOptions) =>
    output(await c.commit(parseOperations([operation]), opts));
  const parameter = program
    .command('parameter')
    .description('Declare or remove numeric model parameters referenced with $param');
  editOptions(
    parameter
      .command('put <id>')
      .description('Insert or replace a parameter definition')
      .requiredOption('--default <n>', 'Default value', finite)
      .option('--min <n>', 'Minimum', finite)
      .option('--max <n>', 'Maximum', finite)
      .option('--integer', 'Only whole-number values')
      .option('--description <text>', 'What the parameter controls'),
  ).action(async (id: string, opts) =>
    commit(
      {
        op: 'putParameter',
        id,
        default: opts.default,
        ...(opts.min !== undefined ? { min: opts.min } : {}),
        ...(opts.max !== undefined ? { max: opts.max } : {}),
        ...(opts.integer ? { integer: true } : {}),
        ...(opts.description !== undefined ? { description: opts.description } : {}),
      },
      opts,
    ),
  );
  editOptions(
    parameter.command('remove <id>').description('Remove a parameter no expression still uses'),
  ).action(async (id: string, opts) => commit({ op: 'removeParameter', id }, opts));
  const metadata = program.command('metadata').description('Model name, category and description');
  editOptions(
    metadata
      .command('set')
      .description('Set or clear metadata fields')
      .option('--name <name>', 'Display name')
      .option('--category <text>', 'Library category')
      .option('--description <text>', 'Short description')
      .option('--clear-category', 'Remove the category')
      .option('--clear-description', 'Remove the description'),
  ).action(async (opts) => {
    if (opts.category !== undefined && opts.clearCategory)
      fail('INVALID_OPTION', '--category conflicts with --clear-category.');
    if (opts.description !== undefined && opts.clearDescription)
      fail('INVALID_OPTION', '--description conflicts with --clear-description.');
    const operation = {
      op: 'setMetadata',
      ...(opts.name !== undefined ? { name: opts.name } : {}),
      ...(opts.clearCategory
        ? { category: null }
        : opts.category !== undefined
          ? { category: opts.category }
          : {}),
      ...(opts.clearDescription
        ? { description: null }
        : opts.description !== undefined
          ? { description: opts.description }
          : {}),
    };
    if (Object.keys(operation).length === 1)
      fail('INPUT_REQUIRED', 'Provide --name, --category, --description or a --clear-* flag.');
    await commit(operation, opts);
  });
  const dependency = program
    .command('dependency')
    .description('Frozen dependency models of a model-bundle document');
  editOptions(
    sourceOptions(
      dependency
        .command('put')
        .description('Add a dependency model from JSON; replacing a different one needs --replace')
        .option('--replace', 'Deliberately replace an existing, different dependency'),
    ),
  ).action(async (opts) =>
    commit({ op: 'putDependency', model: await input(opts), replace: !!opts.replace }, opts),
  );
  editOptions(
    dependency.command('remove <id>').description('Remove a dependency no node instantiates'),
  ).action(async (id: string, opts) => commit({ op: 'removeDependency', id }, opts));
}
