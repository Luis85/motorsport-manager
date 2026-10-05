import { type SceneDocument, type Operation, type ModelLibrary } from '../domain/schema.js';
/** Pure edit application. Validation and persistence happen at the transaction boundary. */
export declare function applyOperations(scene: SceneDocument, operations: Operation[], models?: ModelLibrary): SceneDocument;
