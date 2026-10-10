#!/usr/bin/env node
import { createCli } from './commands/create-cli.js';
process.exitCode = await createCli().run(process.argv.slice(2));
