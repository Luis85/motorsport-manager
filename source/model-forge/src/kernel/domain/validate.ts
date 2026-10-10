import { validateRig } from './rig.js';
import { scalar } from './scalar.js';
export { scalar } from './scalar.js';
import {
  fail,
  type SceneDocument,
  type ModelLibrary,
  type ModelDocument,
  type ScalarValue,
  type TransformSpec,
} from './schema.js';

/** Resolved recipes contain numeric scalars, while retaining their discriminated unions and tuples. */
export type Resolved<T> = T extends number
  ? T
  : T extends ScalarValue
    ? number
    : T extends object
      ? { [K in keyof T]: Resolved<T[K]> }
      : T;

export function resolveData<T>(value: T, params: Record<string, number>): Resolved<T> {
  if (Array.isArray(value)) return value.map((v) => resolveData(v, params)) as Resolved<T>;
  if (value && typeof value === 'object') {
    if ('$param' in value || '$expr' in value)
      return scalar(value as ScalarValue, params) as Resolved<T>;
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, resolveData(v, params)]),
    ) as Resolved<T>;
  }
  return value as Resolved<T>;
}
export function modelParameters(model: ModelDocument, overrides: Record<string, number> = {}) {
  for (const k of Object.keys(overrides))
    if (!Object.hasOwn(model.parameters, k))
      fail('UNKNOWN_PARAMETER', `Model ${model.id} has no parameter ${k}.`);
  return Object.fromEntries(
    Object.entries(model.parameters).map(([id, p]) => {
      const v = overrides[id] ?? p.default;
      if (p.min !== undefined && p.max !== undefined && p.min > p.max)
        fail('PARAMETER_RANGE', `${model.id}.${id} has a minimum greater than its maximum.`);
      if (p.integer && !Number.isInteger(v))
        fail('PARAMETER_INTEGER', `${model.id}.${id} requires an integer.`, { value: v });
      if ((p.min !== undefined && v < p.min) || (p.max !== undefined && v > p.max))
        fail('PARAMETER_RANGE', `${model.id}.${id} is outside its permitted range.`, {
          value: v,
          min: p.min,
          max: p.max,
        });
      return [id, v];
    }),
  );
}
function validTransform(t?: TransformSpec) {
  if (t?.scale?.some((v) => typeof v === 'number' && Math.abs(v) < 1e-6))
    fail('INVALID_SCALE', 'Scale components cannot be zero.');
}
export function validateDocument(
  document: SceneDocument | ModelDocument,
  models: ModelLibrary = {},
  stack: string[] = [],
): void {
  if (stack.length > 16) fail('DEPTH_LIMIT', 'Model nesting exceeds 16 levels.');
  if (
    document.kind === 'scene' &&
    document.camera &&
    document.camera.position.every((v, i) => v === document.camera!.target[i])
  )
    fail('INVALID_CAMERA', 'Camera position and target must differ.');
  const params = document.kind === 'scene' ? document.parameters : modelParameters(document);
  const d = resolveData(document, params);
  const ids = new Set<string>();
  for (const n of d.nodes) {
    if (ids.has(n.id)) fail('DUPLICATE_ID', `Duplicate node ${n.id}.`);
    ids.add(n.id);
  }
  const nodes = new Map(d.nodes.map((n) => [n.id, n]));
  for (const n of d.nodes) {
    validTransform(n.transform);
    if (n.pattern) {
      const counts =
        n.pattern.type === 'grid'
          ? n.pattern.counts
          : [n.pattern.type === 'path' ? n.pattern.points.length : n.pattern.count];
      if (
        counts.some((c) => !Number.isInteger(c) || c < 1 || c > 256) ||
        counts.reduce((a, b) => a * b, 1) > 256
      )
        fail(
          'PATTERN_COUNT',
          `Pattern ${n.id} requires positive integer counts and at most 256 copies.`,
        );
      if (n.type !== 'mesh' && n.type !== 'model')
        fail(
          'INVALID_NODE_TYPE',
          'Patterns apply to meshes or model instances, not groups or lights.',
        );
    }
    if (n.pattern?.type === 'path' && n.pattern.orient === 'yaw') {
      for (let i = 1; i < n.pattern.points.length; i++) {
        const a = n.pattern.points[i - 1],
          b = n.pattern.points[i];
        if (Math.hypot(b[0] - a[0], b[2] - a[2]) < 1e-9)
          fail(
            'PATTERN_PATH',
            `Path ${n.id} needs horizontal separation between points for yaw orientation. Use orient: none for vertical placement.`,
          );
      }
    }
    if (n.parent && !ids.has(n.parent))
      fail('REFERENCE_MISSING', `Parent ${n.parent} of ${n.id} does not exist.`);
    let current = n.parent;
    const visited = new Set([n.id]);
    while (current) {
      if (visited.size > 64) fail('DEPTH_LIMIT', 'Node hierarchy exceeds 64 levels.');
      if (visited.has(current)) fail('CYCLE', `Parent cycle includes ${n.id}.`);
      visited.add(current);
      current = nodes.get(current)?.parent;
    }
    if (n.pattern && d.nodes.some((child) => child.parent === n.id))
      fail(
        'PATTERN_HAS_CHILDREN',
        `Pattern node ${n.id} cannot have child nodes; pattern a model instance instead.`,
      );
    if (n.pattern?.type === 'radial' && (n.pattern.radius as number) < 0)
      fail('INVALID_GEOMETRY', `Radial pattern ${n.id} requires a nonnegative radius.`);
    if (n.type === 'mesh') {
      if (!Object.hasOwn(d.geometries, n.geometry))
        fail('REFERENCE_MISSING', `Geometry ${n.geometry} used by ${n.id} does not exist.`);
      if (!Object.hasOwn(d.materials, n.material))
        fail('REFERENCE_MISSING', `Material ${n.material} used by ${n.id} does not exist.`);
    }
    if (n.type === 'model') {
      if (n.rig) {
        validateRig(n.rig);
        if (d.nodes.some((child) => child.parent === n.id))
          fail(
            'RIG_CHILDREN',
            `Rigged instance ${n.id} cannot have authored children. Include them in its model recipe first.`,
          );
      }
      const m = models[n.model];
      if (!Object.hasOwn(models, n.model))
        fail('REFERENCE_MISSING', `Model ${n.model} used by ${n.id} is not registered.`);
      if (stack.includes(n.model))
        fail('CYCLE', `Model cycle: ${[...stack, n.model].join(' -> ')}.`);
      for (const [from, to] of Object.entries(n.materialOverrides)) {
        if (!Object.hasOwn(m.materials, from) || !Object.hasOwn(d.materials, to))
          fail('REFERENCE_MISSING', `Invalid material override ${from} -> ${to} on ${n.id}.`);
      }
      const mp = modelParameters(m, n.parameters as Record<string, number>);
      validateDocument(
        { ...m, ...resolveData({ geometries: m.geometries, nodes: m.nodes }, mp), parameters: {} },
        models,
        [...stack, n.model],
      );
    }
  }
  const geometryStack = new Set<string>();
  const checked = new Set<string>();
  const checkGeometry = (id: string) => {
    if (geometryStack.has(id)) fail('CYCLE', `Geometry cycle includes ${id}.`);
    if (checked.has(id)) return;
    const g = d.geometries[id];
    if (!Object.hasOwn(d.geometries, id))
      fail('REFERENCE_MISSING', `Geometry ${id} does not exist.`);
    if (geometryStack.size > 64)
      fail('DEPTH_LIMIT', 'Geometry dependency chain exceeds 64 levels.');
    geometryStack.add(id);
    const positive = (v: unknown, label: string, allowZero = false) => {
      if (typeof v !== 'number' || !Number.isFinite(v) || (allowZero ? v < 0 : v <= 0))
        fail(
          'INVALID_GEOMETRY',
          `${id}.${label} must be ${allowZero ? 'nonnegative' : 'positive'}.`,
        );
    };
    if ('size' in g) g.size.forEach((v) => positive(v, 'size'));
    for (const k of ['radius', 'height', 'tube', 'depth'] as const)
      if (k in g) positive((g as unknown as Record<string, unknown>)[k], k);
    if (g.type === 'organic') {
      for (const [field, min, max] of [
        ['roundness', 0.65, 1.5],
        ['taper', -0.65, 0.65],
        ['bend', -0.75, 0.75],
      ] as const)
        if (g[field] < min || g[field] > max)
          fail('INVALID_GEOMETRY', `${id}.${field} must be between ${min} and ${max}.`);
      if (g.profile) {
        if (g.profile[0].at !== -1 || g.profile.at(-1)!.at !== 1)
          fail('INVALID_GEOMETRY', `${id}.profile must start at -1 and end at 1.`);
        for (const [index, station] of g.profile.entries()) {
          if (
            station.at < -1 ||
            station.at > 1 ||
            (index > 0 && station.at - g.profile[index - 1].at < 0.02 - 1e-12)
          )
            fail(
              'INVALID_GEOMETRY',
              `${id}.profile heights must increase by at least 0.02 within -1..1.`,
            );
          if ([station.width, station.depth].some((value) => value < 0.1 || value > 2))
            fail('INVALID_GEOMETRY', `${id}.profile width/depth must be between 0.1 and 2.`);
          if (station.offset.some((value) => value < -0.75 || value > 0.75))
            fail('INVALID_GEOMETRY', `${id}.profile offset must be between -0.75 and 0.75.`);
        }
      }
    }
    if (g.type === 'tube') {
      if (g.closed && g.points.length < 3)
        fail('INVALID_GEOMETRY', `Closed tube ${id} needs at least three points.`);
      const edges = g.closed ? g.points.length : g.points.length - 1;
      for (let i = 0; i < edges; i++) {
        const a = g.points[i],
          b = g.points[(i + 1) % g.points.length];
        if (Math.hypot(...b.map((v, j) => v - a[j])) < 1e-9)
          fail(
            'INVALID_GEOMETRY',
            `Tube ${id} has coincident consecutive points; omit a duplicated closing point.`,
          );
      }
    }
    if (g.type === 'cylinder') {
      positive(g.radiusTop, 'radiusTop', true);
      positive(g.radiusBottom, 'radiusBottom', true);
      if (g.radiusTop === 0 && g.radiusBottom === 0)
        fail('INVALID_GEOMETRY', `${id} needs at least one nonzero radius.`);
    }
    if (g.type === 'capsule') positive(g.length, 'length', true);
    if (g.type === 'heightfield') {
      positive(g.amplitude, 'amplitude', true);
      if (g.bands?.some((band, index) => index > 0 && band.below <= g.bands![index - 1].below))
        fail('INVALID_GEOMETRY', `${id}.bands must list strictly increasing below values.`);
    }
    if (g.type === 'extrude' && g.bevel !== undefined) positive(g.bevel, 'bevel', true);
    if (g.type === 'lathe') g.points.forEach((p) => positive(p[0], 'point radius', true));
    if (
      g.type === 'mesh' &&
      (g.indices.length % 3 || g.indices.some((i) => i >= g.positions.length))
    )
      fail('INVALID_GEOMETRY', `${id} needs triangle indices inside the positions array.`);
    if (g.type === 'mesh') {
      for (const name of ['normals', 'uvs'] as const)
        if (g[name] && g[name]!.length !== g.positions.length)
          fail('INVALID_GEOMETRY', `${id}.${name} must contain one value per position.`);
      if (g.normals?.some((n) => Math.hypot(...(n as number[])) < 1e-12))
        fail(
          'INVALID_GEOMETRY',
          `${id}.normals must be nonzero; they are normalized on compilation.`,
        );
    }
    if (g.type === 'boolean') {
      validTransform(g.leftTransform);
      validTransform(g.rightTransform);
      checkGeometry(g.left);
      checkGeometry(g.right);
    }
    geometryStack.delete(id);
    checked.add(id);
  };
  Object.keys(d.geometries).forEach(checkGeometry);
}
