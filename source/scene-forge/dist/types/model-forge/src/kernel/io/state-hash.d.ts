import type { StateHasher } from '../application/edit.js';
import type { ModelDocument, ModelLibrary } from '../domain/schema.js';
/** SHA-256 is a persisted concurrency token; preserve its canonical representation. */
export declare const stateHash: StateHasher;
/**
 * Concurrency token of one editable model document and its frozen dependencies. A model
 * without `revision` hashes exactly as before revisions existed.
 */
export declare const modelStateHash: (model: ModelDocument, dependencies: ModelLibrary) => string;
