import { promises as fs } from 'node:fs';
import { Command, Option } from 'commander';
import {
  fail,
  ForgeError,
  loadPlaywright,
  playwrightEnvironment,
  type PlaywrightLocation,
} from '../kernel/index.js';
import { discoverCatalog } from '../domain/catalog.js';
import { jsonSchema, schemaKinds } from '../domain/schemas.js';
import { VERSION } from '../version.js';
import { createFromExample, exampleDocument, listExamples } from '../infra/examples.js';
import { serializeDocument } from '../application/document.js';
import { playwrightSetup } from '../infra/preview.js';
import type { CommandContext } from './context.js';

/** Machine-readable arguments, flags, defaults, choices and subcommands of a command. */
export function commandDescription(command: Command, prefix = ''): unknown {
  const path = [prefix, command.name()].filter(Boolean).join(' ');
  return {
    command: path,
    description: command.description(),
    aliases: command.aliases(),
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

const commandPaths = (command: Command, prefix = ''): string[] =>
  command.commands.flatMap((child) => {
    const path = [prefix, child.name()].filter(Boolean).join(' ');
    return child.commands.length ? commandPaths(child, path) : [path];
  });

async function probePlaywright(): Promise<PlaywrightLocation | ForgeError> {
  try {
    return await loadPlaywright(playwrightEnvironment('source/model-forge'));
  } catch (error) {
    if (error instanceof ForgeError) return error;
    throw error;
  }
}
async function exists(file: string) {
  return fs.access(file).then(
    () => true,
    () => false,
  );
}

export function registerDiscoveryCommands(c: CommandContext) {
  const { program, output, writeOut } = c;
  const compact = () => !!program.opts<{ compact?: boolean }>().compact;
  program
    .command('discover')
    .alias('catalog')
    .description('Agent protocol: workflow, document kinds, operations, limits, exports, errors')
    .action(() => output(discoverCatalog(program.name(), VERSION, commandPaths(program))));
  program
    .command('describe [path...]')
    .description('Machine-readable command arguments, flags, defaults and choices')
    .action((parts: string[]) => {
      let command = program,
        prefix = '';
      for (const part of parts) {
        const child = command.commands.find((c) => c.name() === part || c.aliases().includes(part));
        if (!child)
          fail('NOT_FOUND', `Unknown command ${part}.`, {
            available: command.commands.map((c) => c.name()),
            hint: 'Run discover for every command path, or describe with a path from details.available.',
          });
        prefix = [prefix, command.name()].filter(Boolean).join(' ');
        command = child;
      }
      output(commandDescription(command, prefix));
    });
  program
    .command('schema')
    .description('Print the JSON Schema of a contract')
    .addOption(new Option('--kind <name>', 'Contract').choices(schemaKinds).default('batch'))
    .option('--raw', 'Print the bare JSON Schema for validators')
    .action((opts: { kind: string; raw?: boolean }) => {
      const schema = jsonSchema(opts.kind);
      if (opts.raw) writeOut(JSON.stringify(schema, null, compact() ? undefined : 2) + '\n');
      else output(schema);
    });
  program
    .command('doctor')
    .description('Check Node, Playwright and Chromium for review (preview needs neither)')
    .action(async () => {
      const playwright = await probePlaywright();
      const configured = process.env.FORGE_CHROMIUM_PATH;
      if (playwright instanceof ForgeError)
        return output({
          node: process.version,
          nodeSupported: Number(process.versions.node.split('.')[0]) >= 22,
          playwright: {
            installed: false,
            details: { ...(playwright.details as object), remedies: playwrightSetup },
          },
          chromium: {
            path: configured ?? null,
            installed: configured ? await exists(configured) : false,
          },
          reviewReady: false,
          setup: playwrightSetup.join(' '),
        });
      const browser = configured ?? playwright.module.chromium.executablePath();
      const installed = await exists(browser);
      output({
        node: process.version,
        nodeSupported: Number(process.versions.node.split('.')[0]) >= 22,
        playwright: { installed: true, resolvedFrom: playwright.resolvedFrom },
        chromium: { path: browser, installed },
        reviewReady: installed,
        setup: installed
          ? 'Run review --out <new directory> to verify OS libraries and WebGL.'
          : 'Run npx playwright install chromium, or set FORGE_CHROMIUM_PATH.',
      });
    });
  const example = program
    .command('example')
    .description('Bundled example models to inspect or copy into new documents');
  example
    .command('list')
    .description('List examples with kind, file name and dependencies')
    .action(async () => output(await listExamples()));
  example
    .command('show <id>')
    .description('Print an example document')
    .option('--raw', 'Print bare document JSON for saving or piping')
    .action(async (id: string, opts: { raw?: boolean }) => {
      const document = serializeDocument(await exampleDocument(id));
      if (opts.raw) writeOut(JSON.stringify(document, null, compact() ? undefined : 2) + '\n');
      else output(document);
    });
  example
    .command('create <id> <path>')
    .description('Create a new document from an example; never overwrites')
    .action(async (id: string, file: string) => {
      const created = await createFromExample(id, c.resolvePath(file));
      output({
        ...created,
        nextCommands: [
          [program.name(), '-d', created.path, 'inspect', '--source'],
          [program.name(), 'schema', '--kind', 'batch', '--raw'],
          [program.name(), '-d', created.path, 'apply', '--file', '<batch.json>', '--dry-run'],
        ],
      });
    });
}
