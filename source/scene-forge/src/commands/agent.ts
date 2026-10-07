import { parseParameters } from './input.js';
import { Command, Option } from 'commander';
import {
  parse,
  fail,
  SelectorSchema,
  NodePatchSchema,
  ReviewPlanSchema,
  QualityPolicySchema,
  type ReviewPlan,
} from '../domain/schema.js';
import { inspectNodes } from '../application/inspection.js';
import { auditScene } from '../application/quality.js';
import { authoringTarget } from '../application/target.js';
import { packScene, unpackScene } from '../infra/bundle.js';
import { reviewScene } from '../infra/review.js';
import { commitOperations, writeJson } from '../infra/project.js';
import type { CommandContext } from './context.js';

const filterOptions = (cmd: Command) =>
  cmd
    .option('--ids <ids>', 'Comma-separated authored node IDs')
    .option('--tag <tag>')
    .addOption(new Option('--type <type>').choices(['group', 'mesh', 'model', 'light']))
    .option('--model <id>')
    .option('--parent <id>', 'Direct parent ID')
    .option('--root', 'Only nodes at the scene root');
const selector = (o: {
  ids?: string;
  tag?: string;
  type?: string;
  model?: string;
  parent?: string;
  root?: boolean;
}) => {
  if (o.parent && o.root) fail('INVALID_OPTION', '--root conflicts with --parent.');
  return parse(SelectorSchema, {
    ids: o.ids?.split(',').map((s: string) => s.trim()),
    tag: o.tag,
    type: o.type,
    model: o.model,
    parent: o.root ? null : o.parent,
  });
};
export function commandDescription(command: Command, prefix = ''): unknown {
  const path = [prefix, command.name()].filter(Boolean).join(' ');
  return {
    command: path,
    description: command.description(),
    arguments: command.registeredArguments.map((a) => ({
      name: a.name(),
      description: a.description,
      required: a.required,
      variadic: a.variadic,
      default: a.defaultValue,
      choices: a.argChoices,
    })),
    options: command.options.map((o) => ({
      flags: o.flags,
      description: o.description,
      required: o.mandatory,
      valueRequired: o.required,
      default: o.defaultValue,
      choices: o.argChoices,
    })),
    subcommands: command.commands.map((c) => commandDescription(c, path)),
  };
}
export function registerAgentCommands(c: CommandContext) {
  const { program, scene, snapshot, global, output, input, sourceOptions, editOptions } = c;
  program
    .command('describe [path...]')
    .description('Machine-readable command arguments, flags, defaults and choices')
    .action((parts: string[]) => {
      let command = program,
        prefix = '';
      for (const part of parts) {
        const child = command.commands.find((c) => c.name() === part);
        if (!child)
          fail('NOT_FOUND', `Unknown command ${part}.`, {
            available: command.commands.map((c) => c.name()),
          });
        prefix = [prefix, command.name()].filter(Boolean).join(' ');
        command = child;
      }
      output(commandDescription(command, prefix));
    });
  const node = program.commands.find((c) => c.name() === 'node')!;
  filterOptions(
    node
      .command('list')
      .description('Query authored nodes with optional world bounds and pagination'),
  )
    .option('--details', 'Include source, world matrix, bounds and subtree statistics')
    .option('--limit <n>', 'Maximum rows (1–1000)', Number, 100)
    .option('--offset <n>', 'Start row', Number, 0)
    .action(async (opts) => {
      if (
        !Number.isInteger(opts.limit) ||
        opts.limit < 1 ||
        opts.limit > 1000 ||
        !Number.isInteger(opts.offset) ||
        opts.offset < 0
      )
        fail('INVALID_OPTION', 'Use limit 1–1000 and a nonnegative integer offset.');
      const s = await snapshot(),
        nodes = inspectNodes(s.scene, s.models, selector(opts), !!opts.details);
      output({
        scene: s.scene.id,
        revision: s.scene.revision,
        stateHash: s.stateHash,
        total: nodes.length,
        offset: opts.offset,
        nodes: nodes.slice(opts.offset, opts.offset + opts.limit),
        nextOffset: opts.offset + opts.limit < nodes.length ? opts.offset + opts.limit : null,
      });
    });
  editOptions(
    sourceOptions(
      filterOptions(
        node.command('edit').description('Patch every matching authored node in one transaction'),
      ),
    ),
  ).action(async (opts) => {
    if (!opts.ids && !opts.tag && !opts.type && !opts.model && !opts.parent && !opts.root)
      fail('INPUT_REQUIRED', 'Use a selector such as --ids, --tag or --type for bulk edits.');
    output(
      await commitOperations(
        global().project,
        global().scene,
        [
          {
            op: 'patchNodes',
            selector: selector(opts),
            patch: parse(NodePatchSchema, await input(opts)),
          },
        ],
        opts,
      ),
    );
  });
  scene
    .command('pack')
    .description('Export editable scene source with all nested model dependencies')
    .requiredOption('-o, --out <file>')
    .action(async (opts) => {
      const s = await snapshot(),
        bundle = packScene(s.scene, s.models);
      await writeJson(c.resolvePath(opts.out), bundle);
      output({
        path: opts.out,
        scene: bundle.scene.id,
        models: Object.keys(bundle.models),
        sourceStateHash: s.stateHash,
      });
    });
  sourceOptions(
    scene
      .command('unpack <directory>')
      .description('Restore a scene bundle into a new self-contained project'),
  ).action(async (directory, opts) =>
    output(await unpackScene(c.resolvePath(directory), await input(opts))),
  );
  sourceOptions(
    program
      .command('audit')
      .description('Check visible geometry and project-specific quality budgets'),
  )
    .option('--model <id>', 'Audit a standalone model')
    .option('--node <id>', 'Audit one subtree at its world transform')
    .option('--parameters <json>', 'Model parameter overrides')
    .option('--strict', 'Treat quality warnings as failures')
    .action(async (opts) => {
      const s = await snapshot();
      const parameters = opts.parameters ? parseParameters(opts.parameters) : undefined;
      const target = authoringTarget(s.scene, s.models, {
        model: opts.model,
        node: opts.node,
        parameters,
      });
      const policy = opts.file || opts.data ? parse(QualityPolicySchema, await input(opts)) : {};
      const report = { ...auditScene(target, s.models, policy), sourceStateHash: s.stateHash };
      if (opts.strict && report.summary.warnings) report.passed = false;
      if (!report.passed)
        fail(
          'QUALITY_GATE_FAILED',
          'The visible deliverable did not pass the quality gate.',
          report,
        );
      output(report);
    });
  program
    .command('review')
    .description(
      'Capture multiple perspectives in one browser session, with a PNG contact sheet and camera manifest',
    )
    .requiredOption('-o, --out <directory>')
    .option('--file <path>', 'Data-driven review plan; use - for stdin')
    .option('--views <names>', 'Comma-separated views; default iso,front,right,back,left,top')
    .option('--turntable <count>', 'Evenly spaced orbit views (2–36)', Number)
    .option('--elevation <degrees>', 'Turntable elevation', Number, 25)
    .option('--width <px>', 'Frame width (64–2048)', Number, 800)
    .option('--height <px>', 'Frame height (64–2048)', Number, 600)
    .addOption(
      new Option('--projection <type>')
        .choices(['auto', 'perspective', 'orthographic'])
        .default('auto'),
    )
    .option('--padding <factor>', 'Framing margin (1.02–3)', Number, 1.12)
    .option('--grid')
    .option('--wireframe')
    .option('--no-contact-sheet')
    .option('--overwrite', 'Replace named outputs in an existing directory')
    .option('--model <id>')
    .option('--node <id>')
    .option('--parameters <json>', 'Model parameter overrides')
    .option('--background <hex>', 'Background color, #rrggbb')
    .action(async (opts, command: Command) => {
      let plan: ReviewPlan;
      if (opts.file) {
        for (const name of [
          'views',
          'turntable',
          'elevation',
          'width',
          'height',
          'projection',
          'padding',
          'grid',
          'wireframe',
          'contactSheet',
        ])
          if (command.getOptionValueSource(name) === 'cli')
            fail(
              'INVALID_OPTION',
              `--file cannot be combined with review setting ${name}; set it in the plan.`,
            );
        plan = parse(ReviewPlanSchema, await input(opts));
      } else {
        if (opts.views && opts.turntable !== undefined)
          fail('INVALID_OPTION', 'Choose --views or --turntable.');
        if (
          opts.turntable !== undefined &&
          (!Number.isInteger(opts.turntable) || opts.turntable < 2 || opts.turntable > 36)
        )
          fail('INVALID_OPTION', 'Turntable count must be an integer from 2 to 36.');
        const frames =
          opts.turntable !== undefined
            ? Array.from({ length: opts.turntable }, (_, i) => ({
                id: `orbit-${String(i).padStart(2, '0')}`,
                camera: {
                  view: 'orbit',
                  azimuth: (i * 360) / opts.turntable,
                  elevation: opts.elevation,
                  projection: opts.projection,
                  padding: opts.padding,
                },
              }))
            : (opts.views ?? 'iso,front,right,back,left,top').split(',').map((view: string) => ({
                id: view.trim(),
                camera: { view: view.trim(), projection: opts.projection, padding: opts.padding },
              }));
        plan = parse(ReviewPlanSchema, {
          schemaVersion: 1,
          kind: 'review',
          width: opts.width,
          height: opts.height,
          grid: !!opts.grid,
          wireframe: !!opts.wireframe,
          contactSheet: opts.contactSheet,
          frames,
        });
      }
      const s = await snapshot();
      const parameters = opts.parameters ? parseParameters(opts.parameters) : undefined;
      const target = authoringTarget(s.scene, s.models, {
        model: opts.model,
        node: opts.node,
        parameters,
      });
      if (opts.background)
        target.environment = { ...target.environment, background: opts.background };
      // The target has a separate render hash; sourceStateHash guards the editable project.
      output(
        await reviewScene(target, s.models, c.resolvePath(opts.out), plan, {
          overwrite: opts.overwrite,
          sourceStateHash: s.stateHash,
          target: opts.model
            ? { model: opts.model, parameters: parameters ?? {} }
            : opts.node
              ? { scene: s.scene.id, node: opts.node }
              : { scene: s.scene.id },
        }),
      );
    });
}
