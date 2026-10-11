import {
  parse,
  ModelSchema,
  type ModelDocument,
  type Random,
  type ScalarValue,
  type V3,
} from '../../kernel/index.js';

/**
 * Small authoring kit shared by the generators: scalar expression helpers, rounding and an
 * insertion-ordered model builder. Every number a generator writes is rounded to 1e-4, so
 * equal inputs give equal bytes and documents stay readable.
 */
export const round4 = (value: number) => Math.round(value * 1e4) / 1e4 + 0;

/** Round every number in a JSON value to 1e-4; -0 becomes 0. */
export function roundDeep<T>(value: T): T {
  if (typeof value === 'number') return round4(value) as T;
  if (Array.isArray(value)) return value.map(roundDeep) as T;
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, roundDeep(entry)]),
    ) as T;
  return value;
}

type S = ScalarValue;
const expr = ($expr: 'add' | 'sub' | 'mul' | 'div' | 'neg' | 'max' | 'min', args: S[]): S => ({
  $expr,
  args,
});
/** `{"$param": id}` */
export const p = (id: string): S => ({ $param: id });
export const add = (...args: S[]) => expr('add', args);
export const sub = (a: S, b: S) => expr('sub', [a, b]);
export const mul = (...args: S[]) => expr('mul', args);
export const div = (a: S, b: S) => expr('div', [a, b]);
export const neg = (a: S) => expr('neg', [a]);
export const half = (a: S) => mul(a, 0.5);
export const smallest = (...args: S[]) => expr('min', args);

export interface ParameterOptions {
  min?: number;
  max?: number;
  integer?: boolean;
  description: string;
}
interface Transform {
  position?: V3;
  rotation?: V3;
  scale?: V3;
}
interface NodeOptions {
  parent?: string;
  transform?: Transform;
  tags?: string[];
  pattern?: Record<string, unknown>;
  name?: string;
}

/** Builds one model document in insertion order; IDs must be unique per collection. */
export class ModelKit {
  private readonly parameters: Record<string, Record<string, unknown>> = {};
  private readonly geometries: Record<string, unknown> = {};
  private readonly materials: Record<string, unknown> = {};
  private readonly nodes: Record<string, unknown>[] = [];

  /** Declare a model parameter and return its `$param` reference. */
  param(id: string, value: number, options: ParameterOptions): S {
    const clamp = (v: number) =>
      Math.min(options.max ?? Infinity, Math.max(options.min ?? -Infinity, v));
    this.parameters[id] = {
      default: options.integer ? Math.round(clamp(value)) : round4(clamp(value)),
      ...(options.min !== undefined ? { min: options.min } : {}),
      ...(options.max !== undefined ? { max: options.max } : {}),
      description: options.description,
      ...(options.integer ? { integer: true } : {}),
    };
    return p(id);
  }
  material(id: string, spec: Record<string, unknown>) {
    this.materials[id] = spec;
    return id;
  }
  hasGeometry(id: string) {
    return Object.hasOwn(this.geometries, id);
  }
  geometry(id: string, spec: Record<string, unknown>) {
    this.geometries[id] = spec;
    return id;
  }
  group(id: string, options: NodeOptions = {}) {
    return this.push({ id, type: 'group', ...options });
  }
  mesh(id: string, geometry: string, material: string, options: NodeOptions = {}) {
    return this.push({ id, type: 'mesh', geometry, material, ...options });
  }
  private push(node: Record<string, unknown>) {
    for (const key of Object.keys(node)) if (node[key] === undefined) delete node[key];
    this.nodes.push(node);
    return node.id as string;
  }
  /** The validated document with every number rounded to 1e-4. */
  finish(identity: { id: string; name: string; category: string }): ModelDocument {
    return parse(
      ModelSchema,
      roundDeep({
        schemaVersion: 1,
        kind: 'model',
        id: identity.id,
        name: identity.name,
        category: identity.category,
        parameters: this.parameters,
        geometries: this.geometries,
        materials: this.materials,
        nodes: this.nodes,
      }),
    );
  }
}

/** A color with every channel multiplied by `factor` (clamped to 0..255). */
export function tint(color: string, factor: number) {
  const channel = (i: number) =>
    Math.max(0, Math.min(255, Math.round(parseInt(color.slice(1 + i * 2, 3 + i * 2), 16) * factor)))
      .toString(16)
      .padStart(2, '0');
  return `#${channel(0)}${channel(1)}${channel(2)}`;
}
/** A color shifted in brightness by up to `amount` (0..1) from a keyed stream. */
export const shade = (color: string, random: Random, amount: number) =>
  tint(color, 1 + random.range(-amount, amount));

/** Unit vector helpers for mesh construction. */
export type Vec = [number, number, number];
export const length = (v: Vec) => Math.hypot(v[0], v[1], v[2]);
export const normalize = (v: Vec): Vec => {
  const n = length(v) || 1;
  return [v[0] / n, v[1] / n, v[2] / n];
};
export const degrees = (radians: number) => (radians * 180) / Math.PI;
export const radians = (deg: number) => (deg * Math.PI) / 180;
