import type { Command } from 'commander';
import { fail } from '../kernel/index.js';
import { scatterDocument } from '../infra/scatter.js';
import { seedOption } from './generate.js';
import { editOptions, finite, integer } from './options.js';
import type { CommandContext } from './context.js';

const collect = (value: string, previous: string[] = []) => [...previous, value];
const flagNames = [
  'group',
  'model',
  'node',
  'area',
  'exclude',
  'spacing',
  'grid',
  'jitter',
  'count',
  'on',
  'sink',
  'maxSlope',
  'scale',
  'yaw',
  'tilt',
  'max',
  'seed',
  'parent',
  'avoid',
  'margin',
] as const;

/** `-d <doc> scatter`: place instances with the kernel planner as one guarded edit. */
export function registerScatterCommands(c: CommandContext) {
  const { program, output, input, resolvePath } = c;
  editOptions(
    program
      .command('scatter')
      .description(
        'Scatter copies of template nodes (or instances of dependency models) over an area as one guarded edit (schema --kind scatter)',
      )
      .option('--file <path>', 'Scatter recipe JSON; - for stdin. Replaces the flags below')
      .option('--data <json>', 'Inline scatter recipe JSON')
      .option('--group <id>', 'Group node that owns the placements (<group>-<n>)', 'scatter')
      .option('--node <ids>', 'Template mesh/model nodes to copy: a,b or a:3,b:1 (weights)')
      .option('--model <ids>', 'Dependency models to instance (bundles): a,b or a:3,b:1')
      .option(
        '--area <spec>',
        'rect:x0,z0,x1,z1 | circle:x,z,r | polygon:x,z;x,z;x,z (default: the model footprint)',
      )
      .option('--exclude <spec>', 'Area to keep clear, same forms as --area; repeatable', collect)
      .option('--spacing <m>', 'Poisson spacing: no two placements closer than this', finite)
      .option('--grid <m>', 'Grid step', finite)
      .option('--jitter <0..1>', 'Grid jitter as a fraction of half the step', finite)
      .option('--count <n>', 'Uniformly random placements', integer)
      .option('--on <node>', 'Ground every placement on this heightfield mesh node')
      .option('--sink <m>', 'Sink below the terrain surface', finite)
      .option('--max-slope <degrees>', 'Reject terrain steeper than this', finite)
      .option('--scale <min..max>', 'Uniform scale range')
      .option('--yaw <min..max>', 'Yaw range in degrees (default 0..360)')
      .option('--tilt <min..max>', 'Tilt range about X and Z in degrees')
      .option('--max <n>', 'Keep at most this many placements (keyed subset)', integer)
      .option('--seed <n>', 'Seed (default 1)', seedOption)
      .option('--parent <id>', 'Existing node whose frame the area is in')
      .option('--avoid <ids>', 'Keep clear of these nodes’ footprints')
      .option('--margin <m>', 'Extra clearance around --avoid footprints', finite)
      .option(
        '--dependency <file>',
        'Model or model-bundle file whose models become frozen dependencies first; repeatable',
        collect,
      )
      .option('--replace', 'Replace an existing group of the same ID (and its placements)')
      .option('--allow-empty', 'Accept a scatter that places nothing'),
  ).action(async (opts, command: Command) => {
    const recipe = opts.file || opts.data ? await input(opts) : undefined;
    const flags = Object.fromEntries(
      flagNames.filter((name) => opts[name] !== undefined).map((name) => [name, opts[name]]),
    );
    const typed = flagNames.filter((name) => command.getOptionValueSource(name) === 'cli');
    if (recipe !== undefined && typed.length)
      fail(
        'INVALID_OPTION',
        `A scatter recipe replaces the placement flags; move ${typed.map((name) => `--${name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`).join(', ')} into the recipe.`,
        { hint: 'Run schema --kind scatter --raw for the recipe fields.' },
      );
    output(
      await scatterDocument(c.documentPath(), {
        recipe,
        flags,
        replace: opts.replace,
        allowEmpty: opts.allowEmpty,
        dependencies: (opts.dependency ?? []).map((file: string) => resolvePath(file)),
        dryRun: opts.dryRun,
        expectedRevision: opts.expectedRevision,
        expectedState: opts.expectedState,
        tool: program.name(),
      }),
    );
  });
}
