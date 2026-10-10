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
  // A throw site may name a remedy for its exact context as details.hint; it replaces the
  // code's general remedy, and the remaining details are reported unchanged.
  let details = forge.details;
  let hint = errorRemedies[forge.code];
  if (details && typeof details === 'object' && !Array.isArray(details) && 'hint' in details) {
    const { hint: specific, ...rest } = details as Record<string, unknown>;
    if (typeof specific === 'string') {
      hint = specific;
      details = Object.keys(rest).length ? rest : undefined;
    }
  }
  return (
    JSON.stringify(
      {
        ok: false,
        error: {
          code: forge.code,
          message: forge.message,
          ...(hint ? { hint } : {}),
          ...(details !== undefined ? { details } : {}),
        },
      },
      null,
      compact ? undefined : 2,
    ) + '\n'
  );
}
