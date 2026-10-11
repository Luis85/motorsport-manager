import {
  fail,
  parse,
  SceneSchema,
  OperationSchema,
  type SceneDocument,
  type ModelLibrary,
  type Operation,
} from '../domain/schema.js';
import { applyOperations } from './operations.js';
import { compileScene } from './compiler.js';
import { sceneChanges } from './inspection.js';

export interface SceneState {
  scene: SceneDocument;
  models: ModelLibrary;
  stateHash: string;
}
export interface EditOptions {
  expectedRevision?: number;
  expectedState?: string;
  dryRun?: boolean;
}
export type StateHasher = (scene: SceneDocument, models: ModelLibrary) => string;
export function checkGuards(snapshot: SceneState, options: EditOptions) {
  if (
    options.expectedRevision !== undefined &&
    options.expectedRevision !== snapshot.scene.revision
  )
    fail(
      'REVISION_CONFLICT',
      'Scene changed since it was read. Inspect and reapply against its current revision.',
      { expected: options.expectedRevision, actual: snapshot.scene.revision },
    );
  if (options.expectedState !== undefined && options.expectedState !== snapshot.stateHash)
    fail(
      'STATE_CONFLICT',
      'The scene or model library changed since it was read. Regenerate the preview or inspect the latest state.',
      { expected: options.expectedState, actual: snapshot.stateHash },
    );
}

/** Prepare a validated edit without mutating a snapshot or performing I/O.
 * The repository must hold its lock from snapshot read through persistence.
 */
export function prepareSceneEdit(
  snapshot: SceneState,
  operations: Operation[],
  options: EditOptions,
  hash: StateHasher,
) {
  const ops = operations.map((operation) => parse(OperationSchema, operation));
  const { scene, models } = snapshot;
  checkGuards(snapshot, options);
  const next = parse(SceneSchema, applyOperations(scene, ops, models));
  const built = compileScene(next, models);
  const stats = built.stats;
  built.dispose();
  const changed = JSON.stringify(next) !== JSON.stringify(scene);
  const proposedRevision = scene.revision + (changed ? 1 : 0);
  if (changed && !options.dryRun) next.revision = proposedRevision;
  return {
    next,
    result: {
      scene: scene.id,
      revision: next.revision,
      stateHash: options.dryRun ? snapshot.stateHash : hash(next, models),
      proposedStateHash: hash({ ...next, revision: proposedRevision }, models),
      proposedRevision,
      changes: sceneChanges(scene, next),
      changed,
      dryRun: !!options.dryRun,
      operations: ops.length,
      stats,
    },
  };
}
