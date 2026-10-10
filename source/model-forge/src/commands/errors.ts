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
  // A throw site may name a remedy for its exact context as details.hint (or as the error's
  // own hint); it replaces the code's general remedy, and other details are unchanged.
  let details = forge.details;
  let hint = errorRemedies[forge.code];
  // An own hint serves errors whose details are not an object (a SCHEMA_INVALID issue array).
  if ('hint' in forge && typeof forge.hint === 'string') hint = forge.hint;
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
