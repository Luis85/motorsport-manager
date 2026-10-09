import path from 'node:path';
import { Option } from 'commander';
import { fail, parse, LittlewildExportSchema, LittlewildAssetSchema } from '../domain/schema.js';
import { readJson } from '../infra/files.js';
import { writeLittlewildAsset } from '../infra/littlewild.js';
import { importLittlewildDefinition } from '../infra/littlewild-import.js';
import { parseJson } from './input.js';
import type { CommandContext } from './context.js';

/** Bridge to the Wildlands/Littlewild engine asset folders. */
export function registerLittlewildCommands(c: CommandContext) {
  const { program, snapshot, output, resolvePath, global, editOptions } = c;
  const group = program
    .command('littlewild')
    .description('Exchange models with Littlewild engine definitions');
  group
    .command('sync')
    .description('Export every asset in a littlewild-export manifest into Littlewild definitions')
    .requiredOption('--file <path>', 'littlewild.export.json manifest')
    .option('--asset <id>', 'Export only one asset from the manifest')
    .option('--dry-run', 'Compile and compare without writing')
    .option('--check', 'Fail when any definition is out of date; never writes')
    .action(async (opts) => {
      const file = resolvePath(opts.file),
        manifest = parse(LittlewildExportSchema, await readJson(file)),
        target = path.resolve(path.dirname(file), manifest.target),
        s = await snapshot();
      const assets = manifest.assets.filter((a) => !opts.asset || a.id === opts.asset);
      if (!assets.length) fail('NOT_FOUND', `Asset ${opts.asset} is not in the manifest.`);
      const results = [];
      for (const asset of assets)
        results.push(
          await writeLittlewildAsset(
            asset,
            s.models,
            path.join(target, asset.family, asset.id, 'definition.json'),
            { dryRun: opts.dryRun, check: opts.check },
          ),
        );
      const stale = results.filter((r) => r.changed).map((r) => r.id);
      if (opts.check && stale.length)
        fail(
          'LITTLEWILD_STALE',
          'Littlewild definitions differ from their Scene Forge recipes. Run littlewild sync.',
          { stale },
        );
      output({ target, assets: results, stale });
    });
  group
    .command('export')
    .description('Export one model as a Littlewild definition model variant')
    .requiredOption('--model <id>', 'Scene Forge model to export')
    .requiredOption('--out <path>', 'Littlewild <family>/<id>/definition.json to create or update')
    .addOption(
      new Option('--family <family>')
        .choices(['items', 'buildings', 'creatures', 'pets'])
        .default('items'),
    )
    .option('--variant <name>', 'Littlewild model variant', 'world')
    .option('--name <name>', 'Display name; defaults to the model name')
    .option('--parameters <json>', 'Model parameter overrides')
    .option('--materials <json>', 'Inline material replacements keyed by model material ID')
    .option('--dry-run', 'Compile and compare without writing')
    .action(async (opts) => {
      const s = await snapshot(),
        out = resolvePath(opts.out),
        model = s.models[opts.model];
      if (!model) fail('NOT_FOUND', `Model ${opts.model} does not exist.`);
      const asset = parse(LittlewildAssetSchema, {
        id: path.basename(path.dirname(out)),
        family: opts.family,
        name: opts.name ?? model.name,
        models: {
          [opts.variant]: {
            model: opts.model,
            parameters: opts.parameters ? parseJson(opts.parameters) : {},
            materials: opts.materials ? parseJson(opts.materials) : {},
          },
        },
      });
      output(await writeLittlewildAsset(asset, s.models, out, { dryRun: opts.dryRun }));
    });
  editOptions(group.command('import'))
    .description('Import Littlewild definition or creature package visuals as editable models')
    .requiredOption(
      '--definition <path>',
      'Littlewild definition, creature package or 3D asset JSON',
    )
    .option('--prefix <id>', 'Model ID prefix; defaults to the camel-cased asset ID')
    .option('--replace', 'Replace existing models with the same IDs')
    .action(async (opts) => {
      output(
        await importLittlewildDefinition(global().project, resolvePath(opts.definition), {
          prefix: opts.prefix,
          dryRun: opts.dryRun,
          replace: opts.replace,
          expectedRevision: opts.expectedRevision,
          expectedState: opts.expectedState,
        }),
      );
    });
}
