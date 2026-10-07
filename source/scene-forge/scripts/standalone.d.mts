/** Types for the standalone build script, used by tests. */
export const root: string;
export const checkedIn: string;
export function buildViewer(): Promise<string>;
export function buildStandalone(viewer?: string): Promise<Buffer>;
export function writeStandalone(file?: string, viewer?: string): Promise<Buffer>;
