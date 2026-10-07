import { fail } from '../domain/errors.js';
import { compileScene } from '../application/compiler.js';
import type { CommandContext } from './context.js';
export function registerInspectionCommands(c: CommandContext) {
  const { program, snapshot, output } = c;
  program
    .command('inspect')
    .description('Inspect source data and compiled bounds/statistics')
    .option('--id <id>', 'Inspect one authored node')
    .option('--source', 'Include the complete source document')
    .action(async (opts) => {
      const s = await snapshot();
      const built = compileScene(s.scene, s.models);
      try {
        const node = opts.id ? s.scene.nodes.find((n) => n.id === opts.id) : undefined;
        if (opts.id && !node) fail('NOT_FOUND', `Node ${opts.id} does not exist.`);
        output({
          project: s.manifest.name,
          scene: s.scene.id,
          revision: s.scene.revision,
          stateHash: s.stateHash,
          stats: built.stats,
          ...(node ? { node } : {}),
          ...(opts.source ? { source: s.scene } : {}),
        });
      } finally {
        built.dispose();
      }
    });
  program
    .command('validate')
    .description('Validate schema, references, parameters and generated geometry')
    .action(async () => {
      const s = await snapshot();
      const built = compileScene(s.scene, s.models);
      output({
        valid: true,
        scene: s.scene.id,
        revision: s.scene.revision,
        stateHash: s.stateHash,
        stats: built.stats,
      });
      built.dispose();
    });
}
