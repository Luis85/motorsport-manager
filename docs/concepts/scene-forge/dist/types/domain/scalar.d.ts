import type { ScalarValue } from './schema.js';
/** Evaluate a bounded data AST. Trigonometric operands use degrees. */
export declare function scalar(value: ScalarValue, params: Record<string, number>, depth?: number): number;
