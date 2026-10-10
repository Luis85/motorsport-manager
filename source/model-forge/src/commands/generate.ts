import { Option, type Command } from 'commander';
import { fail, SEED_MAX } from '../kernel/index.js';
import { MAX_GENERATED_DOCUMENTS } from '../domain/generate.js';
import {
  findGenerator,
  generatorDetails,
  generatorSummary,
  parseSetting,
} from '../application/generate.js';
import { generators } from '../application/generators/index.js';
import { parseMaterialChoices, parseVary } from '../application/variants.js';
import { runGenerate } from '../infra/generate.js';
import { runVariants } from '../infra/variants.js';
import { integer } from './options.js';
import type { CommandContext } from './context.js';

const collect = (value: string, previous: string[] = []) => [...previous, value];
export const seedOption = (value: string) => {
  const seed = integer(value);
  if (seed > SEED_MAX) fail('INVALID_OPTION', `Seed must be from 0 to ${SEED_MAX}.`);
  return seed;
};
const countOption = (value: string) => {
  const count = integer(value);
  if (count < 1 || count > MAX_GENERATED_DOCUMENTS)
    fail('INVALID_OPTION', `--count must be from 1 to ${MAX_GENERATED_DOCUMENTS}.`);
  return count;
};

/**
 * `--preset` keeps its declared choices for `describe` and help, but an unknown name fails as
 * a structured INVALID_OPTION that lists the presets instead of commander's CLI_USAGE text.
 */
const presetOption = (generator: string, presets: Record<string, unknown>, value: string) => {
  const available = Object.keys(presets);
  if (!Object.hasOwn(presets, value))
    fail('INVALID_OPTION', `Generator ${generator} has no preset ${value}.`, {
      available,
      hint: `Use --preset ${available.join('|')}, or run generate show ${generator}.`,
    });
  return value;
};

/** `generate list | show <generator> | <generator> ...` and `-d <doc> variants`. */
export function registerGenerateCommands(c: CommandContext) {
  const { program, output, input, resolvePath } = c;
  const generate = program
    .command('generate')
    .description(
      'Procedural models: generate list, generate show <generator>, generate <generator> --out <new.model.json>',
    )
    .argument('[generator]', 'A generator ID; run generate list')
    .action((name?: string) => {
      if (name === undefined) return output({ generators: generators.map(generatorSummary) });
      if (name.startsWith('-'))
        fail('INVALID_OPTION', `Name the generator before ${name}: generate <generator> [flags].`, {
          available: generators.map((generator) => generator.id),
          hint: 'A generator recipe names its generator in its "generator" field: generate <that generator> --file <recipe> --out <new.model.json>.',
        });
      findGenerator(name);
    });
  generate
    .command('list')
    .description('Every generator with its presets, limits and a one-command example')
    .action(() => output({ generators: generators.map(generatorSummary) }));
  generate
    .command('show <generator>')
    .description('Parameter JSON Schema, defaults, presets, limits and example commands')
    .action((name: string) => output(generatorDetails(findGenerator(name))));
  for (const generator of generators)
    generate
      .command(generator.id)
      .description(
        `${generator.description} Presets: ${Object.keys(generator.presets).join(', ')}.`,
      )
      .requiredOption(
        '-o, --out <path>',
        'New <id>.model.json; with --count, a new directory for <id>-<nn>.model.json documents',
      )
      .addOption(
        new Option('--preset <name>', `Starting point (default ${generator.defaultPreset})`)
          .choices(Object.keys(generator.presets))
          .argParser((value: string) => presetOption(generator.id, generator.presets, value)),
      )
      .option(
        '--seed <n>',
        `Seed 0..${SEED_MAX} (default 1; --count uses seed, seed+1, ...)`,
        seedOption,
      )
      .option('--set <name=value>', 'Parameter value over the preset; repeatable', collect)
      .option(
        '--id <id>',
        'Model ID (default: the --out file or directory name, else the generator ID); --count appends -01, -02, ...',
      )
      .option('--name <name>', 'Display name')
      .option('--file <path>', 'Generator recipe JSON (a <id>.generate.json); - for stdin')
      .option('--data <json>', 'Inline generator recipe JSON')
      .option(
        '--count <n>',
        `Documents with consecutive seeds (1-${MAX_GENERATED_DOCUMENTS})`,
        countOption,
      )
      .option('--review <directory>', 'New directory: one review frame per document, contact sheet')
      .option('--dry-run', 'Build, validate and check every path without writing')
      .action(async (opts) => {
        const recipe = opts.file || opts.data ? await input(opts) : undefined;
        const set = Object.fromEntries((opts.set ?? []).map(parseSetting));
        output(
          await runGenerate({
            generator: generator.id,
            out: resolvePath(opts.out),
            recipe,
            seed: opts.seed,
            preset: opts.preset,
            set,
            id: opts.id,
            name: opts.name,
            count: opts.count,
            review: opts.review ? resolvePath(opts.review) : undefined,
            dryRun: opts.dryRun,
            tool: program.name(),
          }),
        );
      });
  // An unknown generator name reaches the group's action with its flags, so it fails as
  // GENERATOR_NOT_FOUND. Set after the subcommands, which must not inherit the leniency.
  generate.allowUnknownOption().allowExcessArguments();
  program
    .command('variants')
    .description(
      'Write N variants of the document into a new directory: sampled parameter defaults and material colors',
    )
    .requiredOption('--count <n>', `Number of variants (1-${MAX_GENERATED_DOCUMENTS})`, countOption)
    .option('--seed <n>', `Seed 0..${SEED_MAX}`, seedOption, 1)
    .option(
      '--vary <name=min..max>',
      'Sample a model parameter inside its declared range; repeatable',
      collect,
    )
    .option('--materials <material=#a,#b>', 'Pick a color per variant; repeatable', collect)
    .requiredOption('-o, --out <directory>', 'New directory for the variants and variants.json')
    .option(
      '--review <directory>',
      'New directory (not --out): one review frame per variant, contact sheet (at most 36)',
    )
    .option('--dry-run', 'Plan and validate without writing')
    .action(async (opts) => {
      const loaded = await c.load();
      output(
        await runVariants(loaded, {
          count: opts.count,
          seed: opts.seed,
          vary: Object.fromEntries((opts.vary ?? []).map(parseVary)),
          materials: Object.fromEntries((opts.materials ?? []).map(parseMaterialChoices)),
          out: resolvePath(opts.out),
          review: opts.review ? resolvePath(opts.review) : undefined,
          dryRun: opts.dryRun,
          tool: program.name(),
        }),
      );
    });
  return generate as Command;
}
