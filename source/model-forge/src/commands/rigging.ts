import { parse, fail, RigSchema } from '../kernel/index.js';
import { rigInspect } from '../application/inspect.js';
import { editOptions, sourceOptions, vector } from './options.js';
import type { CommandContext } from './context.js';

/**
 * Rigs bind to nested model-instance nodes inside the document (the kernel's rig scope);
 * each command compiles to a guarded patchNode operation.
 */
export function registerRigCommands(c: CommandContext) {
  const { program, output, input, load } = c;
  const rig = program
    .command('rig')
    .description('Inspect, bind and pose skeletons on nested model-instance nodes');
  rig
    .command('inspect <node>')
    .description('Read joints, clips and bindable mesh paths')
    .action(async (id: string) => {
      const loaded = await load();
      output({ path: loaded.path, ...rigInspect(loaded.document, id) });
    });
  editOptions(
    sourceOptions(
      rig.command('bind <node>').description('Replace the rig with a rig JSON document'),
    ),
  ).action(async (id: string, opts) =>
    output(
      await c.commit(
        [{ op: 'patchNode', id, patch: { rig: parse(RigSchema, await input(opts)) } }],
        opts,
      ),
    ),
  );
  editOptions(
    rig
      .command('pose <node>')
      .description('Set an absolute local joint rotation in degrees')
      .requiredOption('--joint <id>', 'Joint ID')
      .requiredOption('--rotation <x,y,z>', 'XYZ Euler degrees'),
  ).action(async (id: string, opts) => {
    const loaded = await load();
    const node = loaded.document.model.nodes.find((n) => n.id === id);
    if (node?.type !== 'model' || !node.rig)
      fail('RIG_MISSING', `Node ${id} has no rig. Bind one with rig bind first.`);
    const definition = structuredClone(node.rig);
    definition.pose[opts.joint] = vector(opts.rotation);
    output(
      await c.commit([{ op: 'patchNode', id, patch: { rig: parse(RigSchema, definition) } }], {
        ...opts,
        expectedRevision: opts.expectedRevision ?? loaded.revision,
        expectedState: opts.expectedState ?? loaded.stateHash,
      }),
    );
  });
  editOptions(
    rig.command('remove <node>').description('Remove the rig and return to the authored rest form'),
  ).action(async (id: string, opts) =>
    output(await c.commit([{ op: 'patchNode', id, patch: { rig: null } }], opts)),
  );
}
