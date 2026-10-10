import {
  expressionOperators,
  exportFormats,
  littlewildFamilies,
  viewNames,
} from '../kernel/index.js';
import { documentSuffixes, sceneOnlyOperations } from './document.js';
import { errorRemedies } from './errors.js';
import { schemaKinds } from './schemas.js';

/** One-line semantics of every operation a model document accepts. */
export const operationSemantics: Record<string, string> = {
  putNode: 'Insert or fully replace one node (mesh, group, light or nested model instance).',
  patchNode: 'Merge supplied node fields; transform components and named overrides merge.',
  patchNodes: 'Apply one patch to every node matching a selector; an empty match fails.',
  removeNode: 'Remove a node; cascade: true also removes its descendants.',
  duplicateNode:
    'Copy a node subtree under newId with an optional local offset; a taken ID fails with DUPLICATE_ID.',
  reparentNode: 'Change a parent; keepWorld (default true) preserves world placement.',
  groupNodes: 'Create group id around sibling nodes, preserving their world placement.',
  groundNode: 'Move a node vertically so its world bounds rest on y (default 0).',
  placeNode: 'Move a node beside a target node by world bounds (side, gap, center).',
  putGeometry: 'Insert or fully replace a geometry definition.',
  removeGeometry:
    'Remove a geometry of the editable model (NOT_FOUND when absent, DEPENDENCY_READONLY when only a dependency defines it); final validation rejects remaining references.',
  putMaterial: 'Insert or fully replace a material definition.',
  removeMaterial:
    'Remove a material of the editable model (NOT_FOUND when absent, DEPENDENCY_READONLY when only a dependency defines it); final validation rejects remaining references.',
  putParameter:
    'Insert or replace a model parameter {id, default, min?, max?, integer?, description?}.',
  removeParameter: 'Remove a parameter; remaining $param references fail validation.',
  setMetadata: 'Set name, category or description; null clears category or description.',
  putDependency:
    'Bundle documents only: add a frozen dependency model; replacing a different one needs replace: true.',
  removeDependency:
    'Bundle documents only: remove a frozen dependency; DEPENDENCY_IN_USE names the nodes and dependencies still instantiating it.',
};

/** Ordered agent protocol. Every step is one stateless command against an explicit document. */
export const workflow = [
  {
    step: 'discover',
    command: 'discover',
    purpose: 'Read this protocol, limits and error remedies.',
  },
  {
    step: 'schema',
    command: 'schema --kind batch --raw',
    purpose: 'Load the exact JSON Schema of batches, operations, geometry and materials.',
  },
  {
    step: 'create',
    command: 'create <path> --id <id> --name <name> | import --from <file> --out <path>',
    purpose: 'Start a new document; neither command overwrites an existing file.',
  },
  {
    step: 'inspect',
    command: '-d <doc> inspect --source',
    purpose: 'Read the source, revision, stateHash, parameters, dependencies and statistics.',
  },
  {
    step: 'dry-run',
    command: '-d <doc> apply --file batch.json --dry-run',
    purpose: 'Validate and compile; read changes, proposedRevision and proposedStateHash.',
  },
  {
    step: 'apply',
    command: '-d <doc> apply --file batch.json --expected-revision <n> --expected-state <hash>',
    purpose: 'Commit atomically; on REVISION_CONFLICT or STATE_CONFLICT inspect again.',
  },
  {
    step: 'verify',
    command: '-d <doc> validate; -d <doc> audit --file policy.json',
    purpose: 'Check geometry, references, parameters and quality budgets.',
  },
  {
    step: 'review',
    command: '-d <doc> review --out <new directory>',
    purpose: 'Render views plus a contact sheet and review.json in headless Chromium.',
  },
  {
    step: 'export',
    command: '-d <doc> export --format <format> --out <path> --validate',
    purpose: 'Write the deliverable for its consumer (see exports).',
  },
];

export const exportConsumers = [
  {
    format: 'model',
    writes: 'One portable model recipe (kind model) without the editor revision.',
    consumers: ['scene-forge model import --file <file>'],
  },
  {
    format: 'model-bundle',
    writes: 'The model with its exact nested dependency closure (kind model-bundle).',
    consumers: ['scene-forge model import --file <file> [--replace]', 'model-forge import'],
  },
  {
    format: 'littlewild',
    writes:
      'Littlewild <family>/<id>/definition.json; only the selected visual variant changes, gameplay facets are preserved, and unchanged source nodes, materials, meshes and layout keep their exact representation (an unedited import re-exports byte-identically).',
    consumers: [
      'wildlands creature attach-visual',
      'Wildlands/Littlewild games through docs/concepts/<game>/assets',
    ],
  },
  {
    format: 'glb',
    writes: 'Binary glTF 2.0 with PBR materials, skins and clips.',
    consumers: ['game engines', 'DCC tools', 'web viewers'],
  },
  { format: 'gltf', writes: 'Text glTF 2.0 with embedded buffers.', consumers: ['DCC tools'] },
  { format: 'obj', writes: 'Geometry, normals and UVs; no materials.', consumers: ['DCC tools'] },
  { format: 'stl', writes: 'Binary triangles only.', consumers: ['3D printing'] },
  { format: 'three', writes: 'Three.js Object JSON.', consumers: ['three.js ObjectLoader'] },
];

/** The complete machine-readable discovery document. */
export function discoverCatalog(tool: string, version: string, commands: string[]) {
  return {
    tool,
    version,
    purpose: 'Agent-first standalone editor for exactly one 3D model recipe per document.',
    workflow,
    commands,
    documents: {
      kinds: Object.entries(documentSuffixes).map(([kind, suffix]) => ({
        kind,
        file: `<id>${suffix}`,
        editable: kind === 'model' ? 'the model' : 'the entry model; other models are frozen',
      })),
      revision:
        'Integer in the editable model. create and import write none (revision 0) and an explicit 0 reads as absent; each changed write adds 1.',
      stateHash:
        'sha256 of canonical {model, dependencies}; a concurrency token (64 lowercase hex digits).',
      history:
        '<document>.history/<revision>.json holds each replaced version; an existing snapshot is never replaced (HISTORY_CONFLICT).',
      lock: '<document>.lock is held from read through write; reads never lock. DOCUMENT_LOCKED reports the holder pid, createdAt and stale; locks are never removed automatically.',
      selection: 'Always explicit: -d, --document <path>. No working-directory discovery.',
      sceneForgeProjects:
        'Documents inside a Scene Forge project (an ancestor directory with forge.project.json) are read-only: writes, new documents and model/model-bundle exports there fail with PROJECT_MODEL_READONLY. Use import --project and scene-forge model import --replace with guards.',
    },
    agentContract: {
      success: 'stdout: {"ok":true,"data":...}; exit 0',
      error: 'stderr: {"ok":false,"error":{code,message,hint?,details?}}; exit 1',
      input: '--file <path>, --file - (stdin) or --data <json>; at most 16 MiB',
      guards: '--expected-revision and --expected-state (or the same batch fields)',
      dryRun: '--dry-run validates and compiles without writing',
      idempotency: 'An operation batch that changes nothing keeps the revision',
      failures: 'Operation failures carry details.operationIndex (zero-based)',
      noHiddenState: 'No prompts, colors, sessions or implicit documents',
      hints:
        'error.hint is the remedy for that failure in its context; discover lists the general remedy per code',
    },
    outputs: {
      existing:
        'export, preview and review never replace an existing file or non-empty directory without --overwrite (ALREADY_EXISTS); export --format littlewild merges into an existing definition.json instead.',
      forbidden:
        'No output may replace the source document, a *.lock file or anything inside a *.history directory, even with --overwrite (INVALID_PATH).',
      documents: 'create, import and example create never overwrite (DOCUMENT_EXISTS).',
    },
    operations: Object.entries(operationSemantics).map(([op, semantics]) => ({ op, semantics })),
    sceneOnlyOperations: sceneOnlyOperations,
    schemas: schemaKinds,
    geometryTypes: [
      'box',
      'sphere',
      'organic',
      'cylinder',
      'cone',
      'torus',
      'capsule',
      'plane',
      'lathe',
      'extrude',
      'mesh',
      'boolean',
      'tube',
    ],
    patterns: ['linear', 'radial', 'grid', 'path'],
    lights: ['point', 'spot', 'directional'],
    expressions: { operators: expressionOperators, maxDepth: 16, trigonometry: 'degrees' },
    rigging: {
      scope: 'nested model-instance nodes inside the document',
      commands: ['rig inspect', 'rig bind', 'rig pose', 'rig remove'],
    },
    review: { views: viewNames, outputs: ['PNG frames', 'contact-sheet.png', 'review.json'] },
    imports: {
      recipes: ['model', 'model-bundle (--entry selects the model)'],
      sceneForge: '--project <directory> --id <model> reads the project read-only',
      littlewild: [
        'littlewild-definition',
        'littlewild-creature-package',
        'littlewild-3d-asset (--variant selects one; variantModels maps all)',
      ],
    },
    exports: exportConsumers,
    exportFormats: [...exportFormats, 'model', 'model-bundle', 'littlewild'],
    littlewildFamilies: Object.keys(littlewildFamilies),
    conventions: {
      units: 'meters',
      up: 'Y',
      handedness: 'right',
      rotation: 'degrees, local XYZ Euler',
      defaultFacing: '+Z',
    },
    limits: {
      inputBytes: 16 * 1024 * 1024,
      nodesPerModel: 10000,
      operationsPerBatch: 10000,
      expandedObjects: 20000,
      expandedTriangles: 2000000,
      patternCopies: 256,
      modelDepth: 16,
      rigJoints: 64,
    },
    errorCodes: Object.entries(errorRemedies).map(([code, remedy]) => ({ code, remedy })),
  };
}
