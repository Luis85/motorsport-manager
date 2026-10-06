import { Command } from 'commander';
import type { CliRuntime } from './context.js';
export declare function createCli(overrides?: Partial<CliRuntime>): {
    program: Command;
    /** One invocation per factory instance, with a returned status rather than process.exit. */
    run(args: string[]): Promise<number>;
};
