import { CommanderError } from 'commander';
import { ForgeError, errorMessage } from '../domain/errors.js';
export function formatCliError(error: unknown): string {
  const forge =
    error instanceof ForgeError
      ? error
      : new ForgeError(
          error instanceof CommanderError ? 'CLI_USAGE' : 'INTERNAL_ERROR',
          errorMessage(error),
        );
  return (
    JSON.stringify(
      {
        ok: false,
        error: {
          code: forge.code,
          message: forge.message,
          hint: (
            {
              SCHEMA_INVALID: 'Run schema --kind <kind> --raw and repair the reported field paths.',
              CLI_USAGE: 'Run describe <command path> to discover accepted arguments and flags.',
              REFERENCE_MISSING: 'Inspect registered models and node IDs before retrying.',
              REVISION_CONFLICT:
                'Inspect the latest source and rebase the edit; do not drop the guard blindly.',
              STATE_CONFLICT:
                'Inspect the latest scene/model library and regenerate the review or edit batch.',
              BROWSER_UNAVAILABLE: 'Run doctor; install Chromium or set FORGE_CHROMIUM_PATH.',
              RIG_INVALID:
                'Run schema --kind rig --raw. Check the single root, joint references, cycles and increasing keyframe times.',
              RIG_BINDING: 'Run rig inspect <node> and use the exact relative mesh paths returned.',
              RIG_MISSING: 'Use rig bind <node> --file <rig.json> before posing a joint.',
              PARAMETER_INTEGER: 'Use a whole-number override for parameters marked integer: true.',
              PATTERN_PATH:
                'Separate successive XZ positions for yaw orientation, or use orient: none.',
              PATTERN_COUNT:
                'Resolve pattern counts to positive integers; their product must not exceed 256.',
              QUALITY_GATE_FAILED:
                'Read details.findings, repair the listed geometry or budgets, and run audit again.',
              INPUT_TOO_LARGE:
                'Split the recipe into smaller reusable models; JSON inputs are limited to 16 MiB.',
              EMPTY_SELECTION: 'Run node list with the same filters and check the IDs/tags.',
            } as Record<string, string>
          )[forge.code],
          ...(forge.details !== undefined ? { details: forge.details } : {}),
        },
      },
      null,
      2,
    ) + '\n'
  );
}
