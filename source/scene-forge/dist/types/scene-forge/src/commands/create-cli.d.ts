import { Command } from 'commander';
import type { CliRuntime } from './context.js';
/** How the program presents itself: `forge3d` for the package, `scene-forge` for the repository executable. */
export interface CliIdentity {
    name: string;
    /** Extra text printed after the root help. */
    helpFooter?: string;
}
export declare function createCli(overrides?: Partial<CliRuntime>, identity?: CliIdentity): {
    program: Command;
    /** One invocation per factory instance, with a returned status rather than process.exit. */
    run(args: string[]): Promise<number>;
};
