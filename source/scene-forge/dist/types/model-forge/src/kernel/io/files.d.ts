/** Bounded JSON input and atomic file replacement shared by every forge tool. */
export declare function readJson(file: string): Promise<unknown>;
export declare function atomicWrite(file: string, data: string | Uint8Array): Promise<void>;
export declare const writeJson: (file: string, value: unknown) => Promise<void>;
