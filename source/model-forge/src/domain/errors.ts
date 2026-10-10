/**
 * Every error code Model Forge reports, with the remedy an agent should apply. The CLI
 * prints the remedy as `error.hint`; `discover` publishes this table.
 */
export const errorRemedies: Record<string, string> = {
  CLI_USAGE: 'Run describe <command path> to discover accepted arguments and flags.',
  INVALID_OPTION: 'Run describe <command path> and correct the flag value or combination.',
  INPUT_REQUIRED: 'Supply exactly one of --file <path|-> or --data <json>.',
  INPUT_TOO_LARGE:
    'Split the recipe into smaller reusable models; JSON inputs are limited to 16 MiB.',
  JSON_INVALID: 'Pass valid JSON with double-quoted keys.',
  JSON_READ_FAILED: 'Check that the path is a readable JSON file.',
  SCHEMA_INVALID: 'Run schema --kind <kind> --raw and repair the reported field paths.',
  UNKNOWN_SCHEMA: 'Use one of details.available with schema --kind.',
  UNKNOWN_OPERATION:
    'Run discover for the operation list; scene-only operations have model equivalents named in the message.',
  DOCUMENT_REQUIRED: 'Pass the model document explicitly with -d, --document <path>.',
  DOCUMENT_NOT_FOUND: 'Check the -d path, or create one with create <path> or import --out <path>.',
  DOCUMENT_EXISTS: 'Choose a new path; create, import and example create never overwrite.',
  DOCUMENT_LOCKED:
    'Another writer holds <document>.lock. Retry after it finishes; remove the lock only after verifying no writer is running.',
  DOCUMENT_KIND:
    'Use <id>.model.json for a self-contained model and <id>.model-bundle.json when it nests other models.',
  DEPENDENCY_READONLY:
    'Dependencies are frozen. Edit the dependency in its own document and putDependency with replace: true.',
  HISTORY_NOT_FOUND: 'Run history to list the revisions that can be restored.',
  REVISION_CONFLICT:
    'The document changed since you read it. Run inspect again and rebase the edit; do not drop the guard blindly.',
  STATE_CONFLICT:
    'The model or its dependencies changed since you read them. Run inspect again and regenerate the batch.',
  GUARD_MISMATCH: 'Use the same guard on the command line and in the batch, or only one of them.',
  NOT_FOUND: 'Run node list or inspect to see the IDs that exist.',
  REFERENCE_MISSING:
    'Add the referenced node, geometry, material, parameter or dependency in the same batch.',
  DUPLICATE_ID: 'Choose an ID that is not already used.',
  ID_MISMATCH: 'Keep each model keyed by its own id.',
  CYCLE: 'Remove the circular parent or model reference.',
  DEPTH_LIMIT: 'Flatten the hierarchy or model nesting.',
  HAS_CHILDREN: 'Set cascade: true (remove --cascade) or reparent the children first.',
  EMPTY_SELECTION: 'Run node list with the same filters and check the IDs/tags.',
  INVALID_NODE_TYPE: 'Run node list --details to check each node type.',
  UNKNOWN_PARAMETER: 'Run inspect to list the model parameters.',
  PARAMETER_MISSING: 'Declare the parameter with putParameter before referencing it with $param.',
  PARAMETER_RANGE: 'Keep defaults and overrides between min and max.',
  PARAMETER_INTEGER: 'Use a whole-number value for parameters marked integer: true.',
  PATTERN_PATH: 'Separate successive XZ positions for yaw orientation, or use orient: none.',
  PATTERN_COUNT: 'Resolve pattern counts to positive integers; their product must not exceed 256.',
  RIG_INVALID:
    'Run schema --kind rig --raw. Check the single root, joint references, cycles and increasing keyframe times.',
  RIG_BINDING: 'Run rig inspect <node> and use the exact relative mesh paths returned.',
  RIG_MISSING: 'Use rig bind <node> --file <rig.json> before posing a joint.',
  INVALID_PATH: 'Use a path inside the named project, and never the document or its side files.',
  PROJECT_NOT_FOUND: 'Pass --project <directory> containing forge.project.json.',
  PROJECT_LOCKED: 'A Scene Forge command is writing the project. Retry after it finishes.',
  LITTLEWILD_IMPORT:
    'Pass a littlewild-definition, littlewild-creature-package or littlewild-3d-asset JSON file.',
  LITTLEWILD_EXPORT: 'Write to <target>/<family>/<id>/definition.json for the same family and id.',
  LITTLEWILD_STALE: 'Run export --format littlewild without --check to update the definition.',
  EXPORT_INVALID: 'Read details for the Khronos issues; no output was written.',
  QUALITY_GATE_FAILED:
    'Read details.findings, repair the listed geometry or budgets, and run audit again.',
  ALREADY_EXISTS: 'Choose a new output directory or pass --overwrite deliberately.',
  INVALID_CAMERA: 'Use a named view, an orbit or a fixed camera from a replay plan.',
  BROWSER_UNAVAILABLE: 'Run doctor; install Chromium or set FORGE_CHROMIUM_PATH.',
  PLAYWRIGHT_UNAVAILABLE:
    'Run doctor. Make playwright resolvable (details.remedies), then install Chromium.',
  RENDER_FAILED: 'Read details.error; check WebGL support with doctor.',
  BUILD_REQUIRED: 'Run npm run build in source/model-forge, or use bin/model-forge.',
  INTERNAL_ERROR: 'Report the message; retrying the same input will fail the same way.',
};
