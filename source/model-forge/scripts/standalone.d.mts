/** Types for the standalone build script, used by tests. */
export const root: string;
export const checkedIn: string;
export function buildPreview(): Promise<string>;
export function buildStandalone(preview?: string): Promise<Buffer>;
export function writeStandalone(file?: string, preview?: string): Promise<Buffer>;
