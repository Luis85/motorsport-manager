import { createHash } from 'node:crypto';
import { canonical } from '../domain/canonical.js';
import type { StateHasher } from '../application/edit.js';
import type { ModelDocument, ModelLibrary } from '../domain/schema.js';
/** SHA-256 is a persisted concurrency token; preserve its canonical representation. */
export const stateHash: StateHasher = (scene, models) =>
  createHash('sha256').update(canonical({ scene, models })).digest('hex');
/**
 * Concurrency token of one editable model document and its frozen dependencies. A model
 * without `revision` hashes exactly as before revisions existed.
 */
export const modelStateHash = (model: ModelDocument, dependencies: ModelLibrary) =>
  createHash('sha256').update(canonical({ model, dependencies })).digest('hex');
