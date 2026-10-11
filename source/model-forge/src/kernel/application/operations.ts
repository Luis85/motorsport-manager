import {
  ForgeError,
  fail,
  type SceneDocument,
  type Operation,
  type ModelLibrary,
} from '../domain/schema.js';
import { selectNodes } from './inspection.js';
import { applySpatialOperation } from './composition.js';

/** Pure edit application. Validation and persistence happen at the transaction boundary. */
export function applyOperations(
  scene: SceneDocument,
  operations: Operation[],
  models: ModelLibrary = {},
): SceneDocument {
  const next = structuredClone(scene);
  for (const [operationIndex, operation] of structuredClone(operations).entries()) {
    try {
      switch (operation.op) {
        case 'patchNodes': {
          const selected = selectNodes(next, operation.selector);
          if (!selected.length)
            fail(
              'EMPTY_SELECTION',
              'No nodes match the selector. Inspect node list before retrying.',
            );
          for (const node of selected)
            applySpatialOperation(
              next,
              { op: 'patchNode', id: node.id, patch: operation.patch },
              models,
            );
          break;
        }
        case 'putNode': {
          const index = next.nodes.findIndex((n) => n.id === operation.node.id);
          if (index < 0) next.nodes.push(operation.node);
          else next.nodes[index] = operation.node;
          break;
        }
        case 'removeNode': {
          if (!next.nodes.some((n) => n.id === operation.id))
            fail('NOT_FOUND', `Node ${operation.id} does not exist.`);
          const remove = new Set([operation.id]);
          let added = true;
          while (added) {
            added = false;
            for (const n of next.nodes)
              if (n.parent && remove.has(n.parent) && !remove.has(n.id)) {
                if (!operation.cascade)
                  fail(
                    'HAS_CHILDREN',
                    `Node ${operation.id} has children. Set cascade: true to remove its subtree.`,
                  );
                remove.add(n.id);
                added = true;
              }
          }
          next.nodes = next.nodes.filter((n) => !remove.has(n.id));
          break;
        }
        case 'putGeometry':
          next.geometries[operation.id] = operation.geometry;
          break;
        case 'removeGeometry':
          delete next.geometries[operation.id];
          break;
        case 'putMaterial':
          next.materials[operation.id] = operation.material;
          break;
        case 'removeMaterial':
          delete next.materials[operation.id];
          break;
        case 'setParameter':
          next.parameters[operation.id] = operation.value;
          break;
        case 'setCamera':
          next.camera = operation.camera;
          break;
        case 'setEnvironment':
          next.environment = operation.environment;
          break;
        default:
          applySpatialOperation(next, operation, models);
      }
    } catch (error) {
      if (error instanceof ForgeError)
        throw new ForgeError(error.code, error.message, {
          operationIndex,
          operation: operation.op,
          cause: error.details,
        });
      throw error;
    }
  }
  return next;
}
