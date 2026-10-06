export declare function readJson(file: string): Promise<unknown>;
export declare function atomicWrite(file: string, data: string | Uint8Array): Promise<void>;
export declare const writeJson: (file: string, value: unknown) => Promise<void>;
export declare function inside(root: string, relative: string): Promise<string>;
export declare function findProject(start: string): Promise<string>;
export declare function withLock<T>(root: string, action: () => Promise<T>): Promise<T>;
