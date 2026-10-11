import { Command, Option } from 'commander';
import { fail, parse, NodePatchSchema, type TransformSpec } from '../kernel/index.js';
import { parseOperations, type EditOptions } from '../application/edit.js';
import { listNodes, nodeSelector, type NodeQuery } from '../application/inspect.js';
import { editOptions, finite, integer, sourceOptions, vector } from './options.js';
import { parseParameters } from './input.js';
import type { CommandContext } from './context.js';

const filterOptions = (cmd: Command) =>
  cmd
    .option('--ids <ids>', 'Comma-separated node IDs')
    .option('--tag <tag>', 'Nodes carrying this tag')
    .addOption(new Option('--type <type>').choices(['group', 'mesh', 'model', 'light']))
    .option('--model <id>', 'Nested instances of this dependency model')
    .option('--parent <id>', 'Direct children of this node')
    .option('--root', 'Only nodes at the model root');
const hasFilter = (query: NodeQuery) =>
  !!(query.ids || query.tag || query.type || query.model || query.parent || query.root);

export function registerNodeCommands(c: CommandContext) {
  const { program, output, input, load } = c;
  const node = program
    .command('node')
    .description('Query and arrange the nodes of the editable model');
  const commit = async (operation: unknown, opts: EditOptions) =>
    output(await c.commit(parseOperations([operation]), opts));
  filterOptions(node.command('list').description('Query nodes; filters intersect'))
    .option('--details', 'Include source, world matrix, bounds and subtree statistics')
    .option('--parameters <json>', 'Evaluate details at parameter overrides')
    .option('--limit <n>', 'Maximum rows (1–1000)', integer, 100)
    .option('--offset <n>', 'Start row', integer, 0)
    .action(async (opts) => {
      const loaded = await load();
      output({
        path: loaded.path,
        ...listNodes(loaded.document, nodeSelector(opts), {
          details: opts.details,
          limit: opts.limit,
          offset: opts.offset,
          parameters: parseParameters(opts.parameters),
        }),
      });
    });
  editOptions(
    sourceOptions(
      filterOptions(node.command('edit').description('Patch every matching node in one batch')),
    ),
  ).action(async (opts) => {
    if (!hasFilter(opts))
      fail('INPUT_REQUIRED', 'Use a selector such as --ids, --tag or --type for bulk edits.');
    await commit(
      {
        op: 'patchNodes',
        selector: nodeSelector(opts),
        patch: parse(NodePatchSchema, await input(opts)),
      },
      opts,
    );
  });
  editOptions(
    node
      .command('transform <id>')
      .description('Set selected local transform components')
      .option('--at <x,y,z>', 'Position in meters')
      .option('--rotate <x,y,z>', 'XYZ Euler degrees')
      .option('--scale <x,y,z>', 'Local scale'),
  ).action(async (id: string, opts) => {
    const transform: TransformSpec = {};
    if (opts.at) transform.position = vector(opts.at);
    if (opts.rotate) transform.rotation = vector(opts.rotate);
    if (opts.scale) transform.scale = vector(opts.scale);
    if (!Object.keys(transform).length)
      fail('INPUT_REQUIRED', 'Provide --at, --rotate or --scale.');
    await commit({ op: 'patchNode', id, patch: { transform } }, opts);
  });
  editOptions(
    sourceOptions(
      node
        .command('patch <id>')
        .description('Merge name, visibility, tags, transform, pattern or instance overrides'),
    ),
  ).action(async (id: string, opts) =>
    commit({ op: 'patchNode', id, patch: parse(NodePatchSchema, await input(opts)) }, opts),
  );
  editOptions(
    node
      .command('duplicate <id> <newId>')
      .description('Duplicate a node subtree')
      .option('--offset <x,y,z>', 'Local offset', '0,0,0'),
  ).action(async (id: string, newId: string, opts) =>
    commit({ op: 'duplicateNode', id, newId, offset: vector(opts.offset) }, opts),
  );
  editOptions(
    node
      .command('group <id>')
      .description('Group sibling nodes without moving them')
      .requiredOption('--nodes <ids>', 'Comma-separated sibling IDs')
      .option('--name <name>', 'Group display name'),
  ).action(async (id: string, opts) =>
    commit(
      {
        op: 'groupNodes',
        id,
        nodes: opts.nodes.split(',').map((v: string) => v.trim()),
        name: opts.name,
      },
      opts,
    ),
  );
  editOptions(
    node
      .command('reparent <id>')
      .description('Move under a parent or to the model root, preserving world placement')
      .option('--parent <id>', 'New parent; omit for the model root')
      .option('--local', 'Keep the local transform instead of the world placement'),
  ).action(async (id: string, opts) =>
    commit({ op: 'reparentNode', id, parent: opts.parent ?? null, keepWorld: !opts.local }, opts),
  );
  editOptions(
    node
      .command('ground <id>')
      .description('Rest the bottom of a subtree on a world Y plane')
      .option('--y <number>', 'World Y', finite, 0),
  ).action(async (id: string, opts) => commit({ op: 'groundNode', id, y: opts.y }, opts));
  editOptions(
    node
      .command('place <id>')
      .description('Place a node beside another by world-space bounds')
      .requiredOption('--to <id>', 'Target node')
      .addOption(
        new Option('--side <side>')
          .choices(['right', 'left', 'front', 'back', 'above', 'below'])
          .default('right'),
      )
      .option('--gap <meters>', 'Gap between bounds', finite, 0)
      .option('--keep-other-axes', 'Do not center along the other axes'),
  ).action(async (id: string, opts) =>
    commit(
      {
        op: 'placeNode',
        id,
        target: opts.to,
        side: opts.side,
        gap: opts.gap,
        center: !opts.keepOtherAxes,
      },
      opts,
    ),
  );
}
