import type { CommandContext } from './context.js';
import { listExamples, exampleBundle, createExample } from '../infra/examples.js';
export function registerExampleCommands(c: CommandContext) {
  const command = c.program
    .command('example')
    .description('Discover and copy bundled procedural examples into editable projects');
  command
    .command('list')
    .description('List examples, reusable models, features and compiled statistics')
    .action(async () => c.output(await listExamples()));
  command
    .command('show <id>')
    .description('Inspect the complete portable scene recipe')
    .option('--raw', 'Print bare JSON for piping into scene unpack or saving as a bundle')
    .action(async (id: string, options: { raw?: boolean }) => {
      const bundle = await exampleBundle(id);
      if (options.raw) c.writeOut(JSON.stringify(bundle, null, 2) + '\n');
      else c.output(bundle);
    });
  command
    .command('create <id> <directory>')
    .description('Create a new project from an example without overwriting existing files')
    .action(async (id: string, directory: string) => {
      const created = await createExample(id, c.resolvePath(directory));
      // Suggested commands name the executable that is actually running.
      const nextCommands = created.nextCommands.map(([, ...args]) => [c.program.name(), ...args]);
      c.output({ ...created, nextCommands });
    });
}
