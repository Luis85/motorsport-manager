import type { CliRuntime } from './context.js';
export declare const parseJson: (value: string) => unknown;
export declare function readInput(runtime: CliRuntime, options: {
    data?: string;
    file?: string;
}): Promise<unknown>;
export declare const parseParameters: (value: string) => Record<string, number>;
