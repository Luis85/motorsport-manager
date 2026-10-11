import { Command } from 'commander';
import type { CommandContext } from './context.js';
export declare function commandDescription(command: Command, prefix?: string): unknown;
export declare function registerAgentCommands(c: CommandContext): void;
