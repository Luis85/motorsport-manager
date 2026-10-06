import type { StateHasher } from '../application/edit.js';
/** SHA-256 is a persisted concurrency token; preserve its canonical representation. */
export declare const stateHash: StateHasher;
