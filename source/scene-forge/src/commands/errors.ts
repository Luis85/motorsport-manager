import { CommanderError } from 'commander';
import { ForgeError, errorMessage } from '../kernel.js';
/** A command-specific remedy that replaces the generic hint for this one failure. */
export function withHint(error: unknown, hints: Record<string, string>): unknown {
  if (error instanceof ForgeError && Object.hasOwn(hints, error.code))
    return Object.assign(error, { hint: hints[error.code] });
  return error;
}
const ownHint = (error: ForgeError) =>
  'hint' in error && typeof error.hint === 'string' ? error.hint : undefined;
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
          hint:
            ownHint(forge) ??
            (
              {
                SCHEMA_INVALID:
                  'Run schema --kind <kind> --raw and repair the reported field paths.',
                CLI_USAGE: 'Run describe <command path> to discover accepted arguments and flags.',
                REFERENCE_MISSING: 'Inspect registered models and node IDs before retrying.',
                REVISION_CONFLICT:
                  'Inspect the latest source and rebase the edit; do not drop the guard blindly.',
                STATE_CONFLICT:
                  'Inspect the latest scene/model library and regenerate the review or edit batch.',
                BROWSER_UNAVAILABLE: 'Run doctor; install Chromium or set FORGE_CHROMIUM_PATH.',
                PLAYWRIGHT_UNAVAILABLE:
                  'Run doctor. Make playwright resolvable (details.remedies), then install Chromium.',
                RIG_INVALID:
                  'Run schema --kind rig --raw. Check the single root, joint references, cycles and increasing keyframe times.',
                RIG_BINDING:
                  'Run rig inspect <node> and use the exact relative mesh paths returned.',
                RIG_MISSING: 'Use rig bind <node> --file <rig.json> before posing a joint.',
                PARAMETER_INTEGER:
                  'Use a whole-number override for parameters marked integer: true.',
                PATTERN_PATH:
                  'Separate successive XZ positions for yaw orientation, or use orient: none.',
                PATTERN_COUNT:
                  'Resolve pattern counts to positive integers; their product must not exceed 256.',
                QUALITY_GATE_FAILED:
                  'Read details.findings, repair the listed geometry or budgets, and run audit again.',
                INPUT_TOO_LARGE:
                  'Split the recipe into smaller reusable models; JSON inputs are limited to 16 MiB.',
                EMPTY_SELECTION: 'Run node list with the same filters and check the IDs/tags.',
                PROCEDURAL_BUDGET:
                  'Procedural output is bounded (2,000 placements, 20,000 candidate points, 10,000 scene nodes, 256 x 256 terrain vertices). Increase spacing, shrink the area or lower counts.',
                SCATTER_EMPTY:
                  'Nothing was placed. Read details.rejected and widen the area, lower the spacing or relax exclusions and maxSlope.',
                TERRAIN_TRANSFORM:
                  'Grounding follows only translation, yaw and positive uniform scale on the terrain node, the scatter parent and their ancestors.',
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
