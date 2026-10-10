export { readJson, atomicWrite, writeJson } from '../kernel.js';
export declare function inside(root: string, relative: string): Promise<string>;
export declare function findProject(start: string): Promise<string>;
export declare function withLock<T>(root: string, action: () => Promise<T>): Promise<T>;
