import { CommanderError } from 'commander';
import { ForgeError, errorMessage } from '../kernel/index.js';
import { errorRemedies } from '../domain/errors.js';

/** The single stderr error envelope: `{"ok":false,"error":{code,message,hint?,details?}}`. */
export function formatCliError(error: unknown, compact = false): string {
  const forge =
    error instanceof ForgeError
      ? error
      : new ForgeError(
          error instanceof CommanderError ? 'CLI_USAGE' : 'INTERNAL_ERROR',
          errorMessage(error),
        );
  const hint = errorRemedies[forge.code];
  return (
    JSON.stringify(
      {
        ok: false,
        error: {
          code: forge.code,
          message: forge.message,
          ...(hint ? { hint } : {}),
          ...(forge.details !== undefined ? { details: forge.details } : {}),
        },
      },
      null,
      compact ? undefined : 2,
    ) + '\n'
  );
}
