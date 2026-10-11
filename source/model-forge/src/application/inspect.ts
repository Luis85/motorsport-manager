import { Mesh } from 'three';
import {
  fail,
  parse,
  compileScene,
  inspectNodes,
  auditScene,
  SelectorSchema,
  type NodeSelector,
  type QualityPolicy,
} from '../kernel/index.js';
import {
  type EditorDocument,
  documentStateHash,
  libraryOf,
  modelTarget,
  revisionOf,
  serializeDocument,
  stageScene,
  validateEditorDocument,
} from './document.js';

export interface InspectOptions {
  source?: boolean;
  parameters?: Record<string, number>;
  node?: string;
}

/** Identity and guards every read result repeats, so an agent can build the next edit. */
export const documentHeader = (document: EditorDocument) => ({
  id: document.model.id,
  kind: document.kind,
  revision: revisionOf(document),
  stateHash: documentStateHash(document),
});

/** Summary of one document: identity, guards, parameters, dependencies and statistics. */
export function inspectDocument(document: EditorDocument, options: InspectOptions = {}) {
  const validation = validateEditorDocument(document);
  let stats = validation.stats;
  if (options.parameters) {
    const built = compileScene(modelTarget(document, options.parameters), libraryOf(document));
    stats = built.stats;
    built.dispose();
  }
  const { model } = document;
  return {
    ...documentHeader(document),
    name: model.name,
    ...(model.category !== undefined ? { category: model.category } : {}),
    ...(model.description !== undefined ? { description: model.description } : {}),
    parameters: model.parameters,
    ...(options.parameters ? { parameterOverrides: options.parameters } : {}),
    dependencies: validation.dependencies,
    unusedDependencies: validation.unusedDependencies,
    counts: {
      nodes: model.nodes.length,
      geometries: Object.keys(model.geometries).length,
      materials: Object.keys(model.materials).length,
    },
    stats,
    ...(options.node ? { node: nodeDetails(document, options.node, options.parameters) } : {}),
    ...(options.source ? { source: serializeDocument(document) } : {}),
  };
}

function nodeDetails(document: EditorDocument, id: string, parameters?: Record<string, number>) {
  if (!document.model.nodes.some((node) => node.id === id))
    fail('NOT_FOUND', `Node ${id} does not exist.`, {
      available: document.model.nodes.map((node) => node.id),
    });
  return inspectNodes(
    stageScene(document.model, parameters),
    document.dependencies,
    { ids: [id] },
    true,
  )[0];
}

export interface NodeQuery {
  ids?: string;
  tag?: string;
  type?: string;
  model?: string;
  parent?: string;
  root?: boolean;
}
/** CLI-style filters to a validated kernel selector. Filters intersect. */
export function nodeSelector(query: NodeQuery): NodeSelector {
  if (query.parent && query.root) fail('INVALID_OPTION', '--root conflicts with --parent.');
  return parse(SelectorSchema, {
    ids: query.ids?.split(',').map((id) => id.trim()),
    tag: query.tag,
    type: query.type,
    model: query.model,
    parent: query.root ? null : query.parent,
  });
}
/** Query authored nodes; details add world placement, bounds and subtree statistics. */
export function listNodes(
  document: EditorDocument,
  selector: NodeSelector,
  options: {
    details?: boolean;
    limit: number;
    offset: number;
    parameters?: Record<string, number>;
  },
) {
  if (
    !Number.isInteger(options.limit) ||
    options.limit < 1 ||
    options.limit > 1000 ||
    !Number.isInteger(options.offset) ||
    options.offset < 0
  )
    fail('INVALID_OPTION', 'Use limit 1–1000 and a nonnegative integer offset.');
  const nodes = inspectNodes(
    stageScene(document.model, options.parameters),
    document.dependencies,
    selector,
    !!options.details,
  );
  const end = options.offset + options.limit;
  return {
    ...documentHeader(document),
    total: nodes.length,
    offset: options.offset,
    nodes: nodes.slice(options.offset, end),
    nextOffset: end < nodes.length ? end : null,
  };
}

/** A nested model instance's rig, and the mesh paths its bindings may name. */
export function rigInspect(document: EditorDocument, id: string) {
  const node = document.model.nodes.find((n) => n.id === id);
  if (node?.type !== 'model')
    fail(
      'INVALID_NODE_TYPE',
      'Rigs bind to nested model-instance nodes. Instantiate a dependency model with putNode {type: "model"} first.',
    );
  const scene = stageScene(document.model);
  const built = compileScene(scene, document.dependencies, { bindRigs: false });
  try {
    const object = built.content.getObjectByName(`${scene.id}/${id}`)!;
    const meshes: string[] = [];
    object.traverse((child) => {
      if (child instanceof Mesh) meshes.push(child.name.slice(object.name.length + 1));
    });
    return { ...documentHeader(document), node: id, rig: node.rig ?? null, meshes };
  } finally {
    built.dispose();
  }
}

/** Quality audit of the model's visible deliverable at default or overridden parameters. */
export function auditDocument(
  document: EditorDocument,
  policy: Partial<QualityPolicy>,
  options: { parameters?: Record<string, number>; strict?: boolean } = {},
) {
  const report = {
    ...auditScene(modelTarget(document, options.parameters), libraryOf(document), policy),
    sourceStateHash: documentStateHash(document),
    revision: revisionOf(document),
  };
  if (options.strict && report.summary.warnings) report.passed = false;
  if (!report.passed)
    fail('QUALITY_GATE_FAILED', 'The model did not pass the quality gate.', report);
  return report;
}
