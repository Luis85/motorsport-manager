import { Box3, type Object3D } from 'three';
import { fail } from '../domain/errors.js';

/** A detached, engine-neutral map of authored articulation, attachment and volume roles. */
export interface SemanticBinding {
  kind: 'articulation' | 'socket' | 'volume';
  role: string;
  path: string;
  parent: string;
  localMatrix: number[];
  worldMatrix: number[];
  bounds?: { min: number[]; max: number[] };
}
export interface SemanticBindings {
  format: 'forge-semantic-bindings';
  version: 1;
  coordinates: { unit: 'metre'; up: '+Y'; forward: '+Z'; matrix: 'column-major' };
  bindings: SemanticBinding[];
}

function reject(message: string): never {
  return fail('SCHEMA_INVALID', message, {
    hint: 'Repair semantic tags, unique node paths and finite geometry in the source recipe; recompile before exporting.',
  });
}

/**
 * Tags use `socket:muzzle`, `articulation:turret`, or `volume:engine`.
 * Scope one independently instantiated assembly at a time; role identity is unique
 * within each kind. This reads compiled geometry, including hidden volume meshes,
 * never writes a recipe, and deliberately does not infer gameplay characteristics.
 */
export function semanticBindings(
  root: Object3D,
  required: readonly string[] = [],
): SemanticBindings {
  root.updateWorldMatrix(true, true);
  const bindings: SemanticBinding[] = [];
  const roles = new Set<string>();
  const pathCounts = new Map<string, number>();
  let visited = 0;
  root.traverse((object) => {
    if (++visited > 20000) reject('Semantic binding traversal exceeds 20,000 objects.');
    if (object.name) pathCounts.set(object.name, (pathCounts.get(object.name) ?? 0) + 1);
  });
  root.traverse((object) => {
    const tags: unknown = object.userData.tags;
    if (!Array.isArray(tags)) return;
    for (const tag of tags) {
      if (typeof tag !== 'string' || !/^(socket|articulation|volume):/.test(tag)) continue;
      const match = /^(socket|articulation|volume):([a-zA-Z][a-zA-Z0-9_-]{0,63})$/.exec(tag);
      if (!match) reject(`Invalid semantic role: ${tag}`);
      if (roles.has(tag)) reject(`Duplicate semantic role: ${tag}`);
      if (!object.name) reject(`Semantic role ${tag} requires a stable object path.`);
      if (pathCounts.get(object.name) !== 1) reject(`Duplicate semantic path: ${object.name}`);
      const binding: SemanticBinding = {
        kind: match[1] as SemanticBinding['kind'],
        role: match[2],
        path: object.name,
        parent: object.parent?.name ?? '',
        localMatrix: object.matrix.toArray(),
        worldMatrix: object.matrixWorld.toArray(),
      };
      if (![...binding.localMatrix, ...binding.worldMatrix].every(Number.isFinite))
        reject(`Non-finite semantic transform: ${tag}`);
      if (binding.kind === 'volume') {
        const bounds = new Box3().setFromObject(object, true);
        if (
          bounds.isEmpty() ||
          ![...bounds.min.toArray(), ...bounds.max.toArray()].every(Number.isFinite)
        )
          reject(`Semantic volume ${tag} needs nonempty finite geometry.`);
        binding.bounds = { min: bounds.min.toArray(), max: bounds.max.toArray() };
      }
      roles.add(tag);
      bindings.push(binding);
      if (bindings.length > 256) reject('An assembly supports at most 256 semantic bindings.');
    }
  });
  for (const role of required) {
    if (!roles.has(role)) reject(`Missing required semantic role: ${role}`);
  }
  return {
    format: 'forge-semantic-bindings',
    version: 1,
    coordinates: { unit: 'metre', up: '+Y', forward: '+Z', matrix: 'column-major' },
    bindings: bindings.sort((a, b) => `${a.kind}:${a.role}`.localeCompare(`${b.kind}:${b.role}`)),
  };
}
