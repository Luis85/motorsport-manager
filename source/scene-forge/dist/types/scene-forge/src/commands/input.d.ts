import type { CliRuntime } from './context.js';
/**
 * Read a JSON input file named by a command-line flag. A missing file keeps the NOT_FOUND
 * code and message, with a remedy about that flag's path.
 */
export declare function readInputFile(file: string, flag: string): Promise<unknown>;
export declare const missingInputHint: (flag: string) => string;
export declare const parseJson: (value: string) => unknown;
export declare function readInput(runtime: CliRuntime, options: {
    data?: string;
    file?: string;
}): Promise<unknown>;
export declare const parseParameters: (value: string) => Record<string, number>;
