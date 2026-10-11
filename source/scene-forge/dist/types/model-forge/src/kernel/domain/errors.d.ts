export declare class ForgeError extends Error {
    code: string;
    details?: unknown | undefined;
    constructor(code: string, message: string, details?: unknown | undefined);
}
export declare function fail(code: string, message: string, details?: unknown): never;
/** Normalize foreign exceptions at system boundaries without widening them to any. */
export declare function errorMessage(error: unknown): string;
export declare function errorCode(error: unknown): string | undefined;
