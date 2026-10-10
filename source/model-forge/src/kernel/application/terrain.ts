import { fail } from '../domain/errors.js';
import { resolveData } from '../domain/validate.js';
import type { SceneDocument, TransformSpec } from '../domain/schema.js';
import { heightfieldSampler, type HeightfieldSpec, type HeightSample } from './heightfield.js';

/**
 * Terrain frames. Grounding samples a heightfield node through its node chain, which may
 * only translate, turn about Y and scale uniformly (TERRAIN_TRANSFORM otherwise): those
 * transforms keep "up" vertical, so a height sample stays a height sample in every frame.
 */
export interface Similarity {
  scale: number;
  /** Radians about +Y. */
  yaw: number;
  translation: [number, number, number];
}
const identity = (): Similarity => ({ scale: 1, yaw: 0, translation: [0, 0, 0] });

/** Rotate about +Y like Three.js: x' = x cos + z sin, z' = -x sin + z cos. */
function turn(yaw: number, x: number, z: number): [number, number] {
  if (yaw === 0) return [x, z];
  const c = Math.cos(yaw),
    s = Math.sin(yaw);
  return [x * c + z * s, -x * s + z * c];
}
export function applySimilarity(f: Similarity, p: readonly number[]): [number, number, number] {
  const [x, z] = turn(f.yaw, p[0] * f.scale, p[2] * f.scale);
  return [x + f.translation[0], p[1] * f.scale + f.translation[1], z + f.translation[2]];
}
export function invertSimilarity(f: Similarity, p: readonly number[]): [number, number, number] {
  const [x, z] = turn(-f.yaw, p[0] - f.translation[0], p[2] - f.translation[2]);
  return [x / f.scale, (p[1] - f.translation[1]) / f.scale, z / f.scale];
}

/** World frame of a node (or the document root for undefined) as a similarity. */
export function nodeFrame(scene: SceneDocument, id: string | undefined, role: string): Similarity {
  const chain = [];
  const seen = new Set<string>();
  for (let current = id; current; ) {
    if (seen.has(current)) fail('CYCLE', `Parent cycle includes ${current}.`);
    seen.add(current);
    const node = scene.nodes.find((n) => n.id === current);
    if (!node) return fail('REFERENCE_MISSING', `Node ${current} does not exist.`);
    chain.push(node);
    current = node.parent;
  }
  let frame = identity();
  for (const node of chain.reverse()) {
    const t = resolveData(node.transform ?? {}, scene.parameters) as {
      [K in keyof TransformSpec]?: number[];
    };
    const [rx, ry, rz] = t.rotation ?? [0, 0, 0],
      [sx, sy, sz] = t.scale ?? [1, 1, 1];
    if (
      node.pattern ||
      Math.abs(rx) > 1e-9 ||
      Math.abs(rz) > 1e-9 ||
      sx <= 0 ||
      Math.abs(sx - sy) > 1e-9 ||
      Math.abs(sx - sz) > 1e-9
    )
      fail(
        'TERRAIN_TRANSFORM',
        `Node ${node.id} on the ${role} chain uses a transform grounding cannot follow.`,
        {
          node: node.id,
          transform: node.transform,
          pattern: node.pattern !== undefined,
          hint: 'Terrain grounding supports translation, yaw (rotation about Y) and positive uniform scale, without patterns, on the terrain node, the scatter parent and their ancestors.',
        },
      );
    const local: Similarity = {
      scale: sx,
      yaw: (ry * Math.PI) / 180,
      translation: (t.position ?? [0, 0, 0]) as [number, number, number],
    };
    frame = {
      scale: frame.scale * local.scale,
      yaw: frame.yaw + local.yaw,
      translation: applySimilarity(frame, local.translation),
    };
  }
  return frame;
}

/** The resolved heightfield of a terrain node. */
export function terrainSpec(scene: SceneDocument, id: string): HeightfieldSpec {
  const node = scene.nodes.find((n) => n.id === id);
  if (!node) return fail('REFERENCE_MISSING', `Terrain node ${id} does not exist.`);
  const geometry = node.type === 'mesh' ? scene.geometries[node.geometry] : undefined;
  if (!geometry || geometry.type !== 'heightfield')
    fail('INVALID_NODE_TYPE', `Node ${id} is not a mesh with heightfield geometry.`, {
      hint: 'Ground on a mesh node whose geometry has type heightfield.',
    });
  const spec = resolveData(geometry, scene.parameters) as HeightfieldSpec;
  if (spec.size.some((v) => !(v > 0)))
    fail('INVALID_GEOMETRY', `Heightfield of ${id} needs a positive size.`);
  return spec;
}

/**
 * Sample a terrain node in the frame of `frameNode` (world when undefined): (x, z) are
 * coordinates in that frame, and y and normal come back in it.
 */
export function terrainSampler(scene: SceneDocument, terrain: string, frameNode?: string) {
  const sample = heightfieldSampler(terrainSpec(scene, terrain));
  const terrainFrame = nodeFrame(scene, terrain, 'terrain'),
    frame = nodeFrame(scene, frameNode, 'scatter parent');
  return (x: number, z: number): HeightSample => {
    const local = invertSimilarity(terrainFrame, applySimilarity(frame, [x, 0, z]));
    const hit = sample(local[0], local[2]);
    const world = applySimilarity(terrainFrame, [local[0], hit.y, local[2]]);
    const [nx, nz] = turn(terrainFrame.yaw - frame.yaw, hit.normal[0], hit.normal[2]);
    return {
      y: invertSimilarity(frame, world)[1],
      normal: [nx, hit.normal[1], nz],
      inside: hit.inside,
    };
  };
}

/** World-space samples of a terrain node, for terrain queries. */
export function sampleTerrainNode(
  scene: SceneDocument,
  terrain: string,
  points: readonly (readonly [number, number])[],
) {
  const sample = terrainSampler(scene, terrain);
  return points.map(([x, z]) => ({ x, z, ...sample(x, z) }));
}
