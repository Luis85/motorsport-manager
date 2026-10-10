/** A command-specific remedy that replaces the generic hint for this one failure. */
export declare function withHint(error: unknown, hints: Record<string, string>): unknown;
export declare function formatCliError(error: unknown): string;
