import type { z } from 'zod';
/** Validate untrusted JSON: reject cycles and excessive depth, then narrow through a schema. */
export declare function parse<T>(schema: z.ZodType<T>, input: unknown): T;
