import { canonical } from '../domain/canonical.js';
import { fail } from '../domain/errors.js';

type Plain = Record<string, unknown>;
const plain = (value: unknown): value is Plain =>
  !!value && typeof value === 'object' && !Array.isArray(value);
function nodes(models: Plain, visit: (node: Plain) => void) {
  const walk = (values: unknown[]) => {
    for (const node of values)
      if (plain(node)) {
        visit(node);
        if (Array.isArray(node.children)) walk(node.children);
      }
  };
  for (const model of Object.values(models))
    if (plain(model) && Array.isArray(model.nodes)) walk(model.nodes);
}
/** Exact full-buffer equality, including normals and UVs. Retained names take precedence. */
export function reuseLittlewildMeshes(models: Plain, meshes: Plain, preferred: string[]) {
  const used = new Set<string>();
  nodes(models, (node) => {
    if (typeof node.mesh === 'string') used.add(node.mesh);
  });
  const byContent = new Map<string, string>(),
    names = new Map<string, string>(),
    output: Plain = {};
  for (const id of new Set([...preferred, ...Object.keys(meshes)])) {
    if (!used.has(id) || !Object.hasOwn(meshes, id)) continue;
    const key = canonical(meshes[id]),
      existing = byContent.get(key);
    if (existing) names.set(id, existing);
    else {
      byContent.set(key, id);
      output[id] = meshes[id];
    }
  }
  nodes(models, (node) => {
    if (typeof node.mesh === 'string' && names.has(node.mesh)) node.mesh = names.get(node.mesh);
  });
  return output;
}
/** Matches the engine's whole-definition JSON value/depth bound before publication. */
export function assertLittlewildComplexity(visual: Plain) {
  let count = 0;
  const visit = (value: unknown, depth: number) => {
    if (++count > 400000 || depth > 32)
      fail(
        'LITTLEWILD_BUDGET',
        'Visual exceeds Littlewild’s 400,000 JSON values or depth 32. Reuse mesh resources, reduce segments, or remove unused variants.',
      );
    if (value && typeof value === 'object')
      for (const child of Object.values(value)) visit(child, depth + 1);
  };
  visit(visual, 0);
}
