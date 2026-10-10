import { Command, CommanderError } from 'commander';
import path from 'node:path';
import { fail } from '../kernel/index.js';
import { VERSION } from '../version.js';
import { commitEdit, readDocument } from '../infra/store.js';
import { formatCliError } from './errors.js';
import { readInput } from './input.js';
import type { CliRuntime, CommandContext } from './context.js';
import { registerDiscoveryCommands } from './discovery.js';
import { registerLifecycleCommands } from './lifecycle.js';
import { registerReadCommands } from './read.js';
import { registerWriteCommands } from './write.js';
import { registerNodeCommands } from './nodes.js';
import { registerModelCommands } from './model.js';
import { registerRigCommands } from './rigging.js';
import { registerOutputCommands } from './outputs.js';

export interface CliIdentity {
  name: string;
  /** Extra text printed after the root help. */
  helpFooter?: string;
}

/** One stateless program: every invocation names its document with -d, --document. */
export function createCli(
  overrides: Partial<CliRuntime> = {},
  identity: CliIdentity = { name: 'model-forge' },
) {
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
    .name(identity.name)
    .description(
      'Agent-first editor for exactly one 3D model recipe per document. JSON in, JSON out.',
    )
    .version(VERSION)
    .option('-d, --document <path>', 'Model document: <id>.model.json or <id>.model-bundle.json')
    .option('--compact', 'Write compact single-line JSON')
    .showHelpAfterError(false)
    .exitOverride()
    .configureOutput({ writeOut: runtime.writeOut, writeErr: () => {} });
  if (identity.helpFooter) program.addHelpText('after', identity.helpFooter);
  const resolvePath = (value: string) => path.resolve(runtime.cwd, value);
  const documentPath = () => {
    const document = program.opts<{ document?: string }>().document;
    if (!document)
      fail(
        'DOCUMENT_REQUIRED',
        'This command edits or reads a document. Pass -d, --document <path>.',
      );
    return resolvePath(document);
  };
  const context: CommandContext = {
    program,
    output: (data) =>
      runtime.writeOut(
        JSON.stringify({ ok: true, data }, null, program.opts().compact ? undefined : 2) + '\n',
      ),
    writeOut: runtime.writeOut,
    input: (options) => readInput(runtime, options),
    resolvePath,
    documentPath,
    load: () => readDocument(documentPath()),
    commit: (operations, options) => commitEdit(documentPath(), operations, options),
  };
  registerDiscoveryCommands(context);
  registerLifecycleCommands(context);
  registerReadCommands(context);
  registerWriteCommands(context);
  registerNodeCommands(context);
  registerModelCommands(context);
  registerRigCommands(context);
  registerOutputCommands(context);

  return {
    program,
    /** One invocation per factory instance, with a returned status rather than process.exit. */
    async run(args: string[]): Promise<number> {
      try {
        await program.parseAsync(args, { from: 'user' });
        return 0;
      } catch (error) {
        if (error instanceof CommanderError && error.exitCode === 0) return 0;
        runtime.writeErr(formatCliError(error, !!program.opts().compact));
        return 1;
      }
    },
  };
}
