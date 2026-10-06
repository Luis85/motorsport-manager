import { registerRigCommands } from './rigging.js';
import { registerExampleCommands } from './examples.js';
import { Command, CommanderError } from 'commander';
import path from 'node:path';
import { loadProject } from '../infra/project.js';
import { VERSION } from '../version.js';
import { formatCliError } from './errors.js';
import { at, sourceOptions, editOptions } from './options.js';
import { readInput } from './input.js';
import type { CliRuntime, CommandContext } from './context.js';
import { registerDiscoveryCommands } from './discovery.js';
import { registerProjectsCommands } from './projects.js';
import { registerEditingCommands } from './editing.js';
import { registerInspectionCommands } from './inspection.js';
import { registerOutputsCommands } from './outputs.js';
import { registerRuntimeCommands } from './runtime.js';
import { registerCompositionCommands } from './composition.js';
import { registerAgentCommands } from './agent.js';

export function createCli(overrides: Partial<CliRuntime> = {}) {
  const runtime: CliRuntime = {
    cwd: process.cwd(),
    stdin: process.stdin,
    writeOut: (text) => {
      process.stdout.write(text);
    },
    writeErr: (text) => {
      process.stderr.write(text);
    },
    ...overrides,
  };
  const program = new Command()
    .name('forge3d')
    .description('Data-driven 3D modeling for agents. JSON in, reproducible geometry out.')
    .version(VERSION)
    .option(
      '-p, --project <directory>',
      'Project directory; otherwise find the nearest project',
      runtime.cwd,
    )
    .option('-s, --scene <id>', 'Scene to use; otherwise use activeScene')
    .option('--compact', 'Write compact JSON for smaller agent responses')
    .showHelpAfterError(false)
    .exitOverride()
    .configureOutput({ writeOut: runtime.writeOut, writeErr: () => {} });
  const resolvePath = (value: string) => path.resolve(runtime.cwd, value);
  const global = () => {
    const options = program.opts<{ project: string; scene?: string }>();
    return { ...options, project: resolvePath(options.project) };
  };
  const context: CommandContext = {
    program,
    scene: program.command('scene').description('Manage scenes in the current project'),
    model: program.command('model').description('Manage reusable model recipes'),
    global,
    snapshot: () => loadProject(global().project, global().scene),
    output: (data) =>
      runtime.writeOut(
        JSON.stringify({ ok: true, data }, null, program.opts().compact ? undefined : 2) + '\n',
      ),
    input: (options) => readInput(runtime, options),
    sourceOptions,
    editOptions,
    at,
    resolvePath,
    writeOut: runtime.writeOut,
  };
  registerProjectsCommands(context);
  registerDiscoveryCommands(context);
  registerEditingCommands(context);
  registerInspectionCommands(context);
  registerOutputsCommands(context);
  registerRuntimeCommands(context);
  registerCompositionCommands(context);
  registerAgentCommands(context);
  registerExampleCommands(context);
  registerRigCommands(context);

  return {
    program,
    /** One invocation per factory instance, with a returned status rather than process.exit. */
    async run(args: string[]): Promise<number> {
      try {
        await program.parseAsync(args, { from: 'user' });
        return 0;
      } catch (error) {
        if (error instanceof CommanderError && error.exitCode === 0) return 0;
        runtime.writeErr(formatCliError(error));
        return 1;
      }
    },
  };
}
