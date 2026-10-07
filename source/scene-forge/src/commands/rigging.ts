import { RigSchema, parse, fail, type Operation } from '../domain/schema.js';
import { commitOperations } from '../infra/project.js';
import { compileScene } from '../application/compiler.js';
import { Mesh } from 'three';
import type { CommandContext } from './context.js';
export function registerRigCommands(c: CommandContext) {
  const { program, snapshot, global, output, input, sourceOptions, editOptions, at } = c;
  const rig = program.command('rig').description('Inspect, bind and pose model-instance skeletons');
  rig
    .command('inspect <node>')
    .description('Read joints, clips and bindable mesh paths')
    .action(async (id) => {
      const s = await snapshot();
      const node = s.scene.nodes.find((n) => n.id === id);
      if (node?.type !== 'model')
        fail(
          'INVALID_NODE_TYPE',
          'Rigging requires a model instance. Capture meshes as a model first.',
        );
      const built = compileScene(s.scene, s.models, { bindRigs: false });
      try {
        const object = built.content.getObjectByName(`${s.scene.id}/${id}`)!;
        const meshes: string[] = [];
        object.traverse((child) => {
          if (child instanceof Mesh) meshes.push(child.name.slice(object.name.length + 1));
        });
        output({
          node: id,
          rig: node.rig ?? null,
          meshes,
          revision: s.scene.revision,
          stateHash: s.stateHash,
        });
      } finally {
        built.dispose();
      }
    });
  editOptions(
    sourceOptions(
      rig
        .command('bind <node>')
        .description('Replace a model instance rig with a validated rig JSON document'),
    ),
  ).action(async (id, opts) => {
    const definition = parse(RigSchema, await input(opts));
    output(
      await commitOperations(
        global().project,
        global().scene,
        [{ op: 'patchNode', id, patch: { rig: definition } }],
        opts,
      ),
    );
  });
  editOptions(
    rig
      .command('pose <node>')
      .description('Set an absolute local joint rotation in degrees')
      .requiredOption('--joint <id>', 'Joint ID')
      .requiredOption('--rotation <x,y,z>', 'XYZ Euler degrees'),
  ).action(async (id, opts) => {
    const s = await snapshot();
    const node = s.scene.nodes.find((n) => n.id === id);
    if (node?.type !== 'model' || !node.rig)
      fail('RIG_MISSING', 'Bind a rig to this model instance first.');
    const definition = structuredClone(node.rig);
    definition.pose[opts.joint] = at(opts.rotation);
    const operations: Operation[] = [
      { op: 'patchNode', id, patch: { rig: parse(RigSchema, definition) } },
    ];
    output(
      await commitOperations(global().project, s.scene.id, operations, {
        ...opts,
        expectedState: opts.expectedState ?? s.stateHash,
        expectedRevision: opts.expectedRevision ?? s.scene.revision,
      }),
    );
  });
  editOptions(
    rig
      .command('remove <node>')
      .description('Remove the rig and return its model to its authored rest form'),
  ).action(async (id, opts) =>
    output(
      await commitOperations(
        global().project,
        global().scene,
        [{ op: 'patchNode', id, patch: { rig: null } }],
        opts,
      ),
    ),
  );
}
