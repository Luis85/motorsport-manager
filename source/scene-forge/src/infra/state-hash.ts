import { createHash } from 'node:crypto';
import { canonical } from '../domain/canonical.js';
import type { StateHasher } from '../application/edit.js';
/** SHA-256 is a persisted concurrency token; preserve its canonical representation. */
export const stateHash: StateHasher = (scene, models) =>
  createHash('sha256').update(canonical({ scene, models })).digest('hex');
