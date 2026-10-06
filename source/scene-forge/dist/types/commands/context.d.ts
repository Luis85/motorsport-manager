import type { Command } from 'commander';
import type { Snapshot } from '../infra/project.js';
export interface CliRuntime {
    cwd: string;
    stdin: AsyncIterable<string | Uint8Array> & {
        isTTY?: boolean;
    };
    writeOut: (text: string) => void;
    writeErr: (text: string) => void;
}
export interface CommandContext {
    program: Command;
    scene: Command;
    model: Command;
    global: () => {
        project: string;
        scene?: string;
    };
    snapshot: () => Promise<Snapshot>;
    output: (value: unknown) => void;
    input: (options: {
        data?: string;
        file?: string;
    }) => Promise<unknown>;
    sourceOptions: (c: Command) => Command;
    editOptions: (c: Command) => Command;
    at: (value: string) => [number, number, number];
    resolvePath: (value: string) => string;
    writeOut: (text: string) => void;
}
