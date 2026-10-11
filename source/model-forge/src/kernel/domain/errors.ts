export class ForgeError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'ForgeError';
  }
}
export function fail(code: string, message: string, details?: unknown): never {
  throw new ForgeError(code, message, details);
}

/** Normalize foreign exceptions at system boundaries without widening them to any. */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
export function errorCode(error: unknown): string | undefined {
  return error !== null &&
    typeof error === 'object' &&
    'code' in error &&
    typeof error.code === 'string'
    ? error.code
    : undefined;
}
