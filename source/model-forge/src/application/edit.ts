import {
  fail,
  parse,
  ForgeError,
  applyOperations,
  canonical,
  modelParameters,
  sceneChanges,
  type ModelDocument,
  type SceneDocument,
} from '../kernel/index.js';
import {
  ModelOperationSchema,
  BatchEnvelopeSchema,
  MetadataFields,
  operationNames,
  modelOperations,
  sceneOnlyOperations,
  type ModelOperation,
  type ModelOnlyOperation,
} from '../domain/document.js';
import {
  type EditorDocument,
  atOperation,
  contentKey,
  documentStateHash,
  revisionOf,
  stageScene,
  unstage,
  validateEditorDocument,
  withoutRevision,
} from './document.js';

export interface EditGuards {
  expectedRevision?: number;
  expectedState?: string;
}
export interface EditOptions extends EditGuards {
  dryRun?: boolean;
}

/** Reject a stale writer before any change is prepared. */
export function checkGuards(document: EditorDocument, guards: EditGuards) {
  const revision = revisionOf(document);
  if (guards.expectedRevision !== undefined && guards.expectedRevision !== revision)
    fail(
      'REVISION_CONFLICT',
      `Document ${document.model.id} is at revision ${revision}, not ${guards.expectedRevision}. Inspect it and reapply against the current revision.`,
      { expected: guards.expectedRevision, actual: revision },
    );
  const state = documentStateHash(document);
  if (guards.expectedState !== undefined && guards.expectedState !== state)
    fail(
      'STATE_CONFLICT',
      `Document ${document.model.id} or its dependencies changed since they were read. Inspect the latest state.`,
      { expected: guards.expectedState, actual: state },
    );
}

/** Validate a batch's entries one by one so every failure names its operation index. */
export function parseOperations(entries: unknown[]): ModelOperation[] {
  return entries.map((entry, index) => {
    const op = entry && typeof entry === 'object' && 'op' in entry ? String(entry.op) : undefined;
    if (op && Object.hasOwn(sceneOnlyOperations, op))
      fail('UNKNOWN_OPERATION', `${op} is a scene operation. ${sceneOnlyOperations[op]}`, {
        operationIndex: index,
        operation: op,
      });
    if (!op || !(operationNames as readonly string[]).includes(op))
      fail('UNKNOWN_OPERATION', `Unknown operation ${op ?? '(missing op)'}.`, {
        operationIndex: index,
        available: operationNames,
      });
    try {
      return parse(ModelOperationSchema, entry);
    } catch (error) {
      return atOperation(error, index, op);
    }
  });
}
/** Parse a batch document: `{expectedRevision?, expectedState?, operations: [...]}`. */
export function parseBatch(input: unknown) {
  const envelope = parse(BatchEnvelopeSchema, input);
  return { ...envelope, operations: parseOperations(envelope.operations) };
}

/** Node IDs an operation addresses, for explaining failures against frozen dependencies. */
function addressedNodes(operation: ModelOperation): string[] {
  switch (operation.op) {
    case 'patchNode':
    case 'removeNode':
    case 'duplicateNode':
    case 'groundNode':
      return [operation.id];
    case 'reparentNode':
      return [operation.id, ...(operation.parent ? [operation.parent] : [])];
    case 'groupNodes':
      return operation.nodes;
    case 'placeNode':
      return [operation.id, operation.target];
    case 'patchNodes':
      return operation.selector.ids ?? [];
    default:
      return [];
  }
}
/**
 * Removing a geometry or material the model does not define is an error here (the kernel's
 * scene semantics treat it as a no-op): NOT_FOUND, or DEPENDENCY_READONLY when only a frozen
 * dependency defines that ID.
 */
function checkRemoval(draft: Draft, op: ModelOperation) {
  if (op.op !== 'removeGeometry' && op.op !== 'removeMaterial') return;
  const field = op.op === 'removeGeometry' ? 'geometries' : 'materials';
  const noun = field === 'geometries' ? 'Geometry' : 'Material';
  if (Object.hasOwn(draft.scene[field], op.id)) return;
  const owner = Object.values(draft.dependencies).find((dependency) =>
    Object.hasOwn(dependency[field], op.id),
  );
  if (owner)
    fail(
      'DEPENDENCY_READONLY',
      `${noun} ${op.id} belongs to frozen dependency ${owner.id}. Edit that model in its own document.`,
      { [field === 'geometries' ? 'geometry' : 'material']: op.id, dependency: owner.id },
    );
  fail('NOT_FOUND', `${noun} ${op.id} does not exist in model ${draft.model.id}.`, {
    available: Object.keys(draft.scene[field]),
    hint: `Run inspect --source to see the ${field} of the editable model.`,
  });
}
function dependencyOwner(document: EditorDocument, scene: SceneDocument, op: ModelOperation) {
  for (const id of addressedNodes(op)) {
    if (scene.nodes.some((node) => node.id === id)) continue;
    for (const dependency of Object.values(document.dependencies))
      if (dependency.nodes.some((node) => node.id === id))
        return { node: id, dependency: dependency.id };
  }
  return undefined;
}

interface Draft {
  kind: EditorDocument['kind'];
  model: ModelDocument;
  dependencies: EditorDocument['dependencies'];
  scene: SceneDocument;
}
function applyModelOperation(draft: Draft, operation: ModelOnlyOperation) {
  const { model } = draft;
  switch (operation.op) {
    case 'putParameter': {
      const { op, id, ...spec } = operation;
      // Check range and integer rules here so a failure names this operation's index.
      modelParameters({ ...model, parameters: { [id]: spec } });
      model.parameters[id] = spec;
      draft.scene.parameters[id] = spec.default;
      return;
    }
    case 'removeParameter':
      if (!Object.hasOwn(model.parameters, operation.id))
        fail('NOT_FOUND', `Parameter ${operation.id} does not exist.`);
      delete model.parameters[operation.id];
      delete draft.scene.parameters[operation.id];
      return;
    case 'setMetadata':
      for (const field of MetadataFields) {
        const value = operation[field];
        if (value === undefined) continue;
        if (value === null) delete model[field];
        else model[field] = value;
      }
      draft.scene.name = model.name;
      return;
    case 'putDependency':
    case 'removeDependency': {
      if (draft.kind !== 'model-bundle')
        fail(
          'DOCUMENT_KIND',
          `${operation.op} needs a model-bundle document; ${model.id} is a self-contained model.`,
          { hint: 'export --format model-bundle, then import it as <id>.model-bundle.json.' },
        );
      if (operation.op === 'removeDependency') {
        if (!Object.hasOwn(draft.dependencies, operation.id))
          fail('NOT_FOUND', `Dependency ${operation.id} does not exist.`, {
            available: Object.keys(draft.dependencies),
          });
        const nodes = draft.scene.nodes
          .filter((node) => node.type === 'model' && node.model === operation.id)
          .map((node) => node.id);
        const models = Object.values(draft.dependencies)
          .filter((other) =>
            other.nodes.some((node) => node.type === 'model' && node.model === operation.id),
          )
          .map((other) => other.id);
        if (nodes.length || models.length)
          fail(
            'DEPENDENCY_IN_USE',
            `Dependency ${operation.id} is still instantiated by ${[
              ...nodes.map((id) => `node ${id}`),
              ...models.map((id) => `dependency ${id}`),
            ].join(', ')}.`,
            { dependency: operation.id, nodes, dependencies: models },
          );
        delete draft.dependencies[operation.id];
        return;
      }
      const incoming = withoutRevision(operation.model);
      const id = incoming.id;
      if (id === model.id)
        fail('DEPENDENCY_READONLY', `The editable model ${id} cannot also be a dependency.`);
      const current = draft.dependencies[id];
      if (current && canonical(current) !== canonical(incoming) && !operation.replace)
        fail(
          'DEPENDENCY_READONLY',
          `Dependency ${id} is frozen and differs from the supplied model. Pass replace: true to replace it deliberately.`,
        );
      draft.dependencies[id] = incoming;
    }
  }
}

function diff<T>(before: Record<string, T>, after: Record<string, T>) {
  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  return {
    added: Object.keys(after).filter((k) => !Object.hasOwn(before, k)),
    updated: Object.keys(after).filter(
      (k) => Object.hasOwn(before, k) && !same(before[k], after[k]),
    ),
    removed: Object.keys(before).filter((k) => !Object.hasOwn(after, k)),
  };
}
/** Exact IDs added, updated and removed per collection, plus changed metadata fields. */
export function documentChanges(before: EditorDocument, after: EditorDocument) {
  const staged = sceneChanges(stageScene(before.model), stageScene(after.model));
  return {
    nodes: staged.nodes,
    geometries: staged.geometries,
    materials: staged.materials,
    parameters: diff(before.model.parameters, after.model.parameters),
    dependencies: diff(before.dependencies, after.dependencies),
    metadata: MetadataFields.filter((f) => before.model[f] !== after.model[f]),
  };
}

/**
 * Prepare a validated edit without I/O or mutating the input. The store holds the document
 * lock from reading `document` through persisting `next`.
 */
export function prepareModelEdit(
  document: EditorDocument,
  operations: ModelOperation[],
  options: EditOptions = {},
) {
  checkGuards(document, options);
  const draft: Draft = {
    kind: document.kind,
    model: structuredClone(document.model),
    dependencies: structuredClone(document.dependencies),
    scene: stageScene(document.model),
  };
  for (const [index, operation] of operations.entries()) {
    try {
      if ((modelOperations as readonly string[]).includes(operation.op))
        applyModelOperation(draft, operation as ModelOnlyOperation);
      else {
        const owner = dependencyOwner(document, draft.scene, operation);
        checkRemoval(draft, operation);
        try {
          draft.scene = applyOperations(draft.scene, [operation as never], draft.dependencies);
        } catch (error) {
          if (owner && error instanceof ForgeError && error.code === 'NOT_FOUND')
            fail(
              'DEPENDENCY_READONLY',
              `Node ${owner.node} belongs to frozen dependency ${owner.dependency}. Edit that model in its own document.`,
              owner,
            );
          // The kernel reports a taken node ID as ALREADY_EXISTS; here it is an ID choice.
          if (error instanceof ForgeError && error.code === 'ALREADY_EXISTS')
            fail('DUPLICATE_ID', error.message, {
              ...(error.details && typeof error.details === 'object' ? error.details : {}),
              hint: 'Choose another node ID; run node list to see the IDs already in use.',
            });
          throw error;
        }
      }
    } catch (error) {
      atOperation(error, index, operation.op);
    }
  }
  const next: EditorDocument = {
    kind: document.kind,
    model: unstage(draft.model, draft.scene),
    dependencies: draft.dependencies,
  };
  const { stats } = validateEditorDocument(next);
  const changed = contentKey(next) !== contentKey(document);
  const revision = revisionOf(document);
  const proposedRevision = revision + (changed ? 1 : 0);
  const proposed = { ...next, model: { ...next.model, revision: proposedRevision } };
  if (changed && !options.dryRun) next.model.revision = proposedRevision;
  return {
    next: changed ? next : document,
    result: {
      id: document.model.id,
      kind: document.kind,
      revision: options.dryRun ? revision : proposedRevision,
      stateHash: documentStateHash(changed && !options.dryRun ? next : document),
      proposedRevision,
      proposedStateHash: changed ? documentStateHash(proposed) : documentStateHash(document),
      changes: documentChanges(document, next),
      changed,
      dryRun: !!options.dryRun,
      operations: operations.length,
      stats,
    },
  };
}
