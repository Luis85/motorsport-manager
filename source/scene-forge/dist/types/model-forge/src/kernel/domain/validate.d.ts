export { scalar } from './scalar.js';
import { type SceneDocument, type ModelLibrary, type ModelDocument, type ScalarValue } from './schema.js';
/** Resolved recipes contain numeric scalars, while retaining their discriminated unions and tuples. */
export type Resolved<T> = T extends number ? T : T extends ScalarValue ? number : T extends object ? {
    [K in keyof T]: Resolved<T[K]>;
} : T;
export declare function resolveData<T>(value: T, params: Record<string, number>): Resolved<T>;
export declare function modelParameters(model: ModelDocument, overrides?: Record<string, number>): {
    [k: string]: number;
};
export declare function validateDocument(document: SceneDocument | ModelDocument, models?: ModelLibrary, stack?: string[]): void;
