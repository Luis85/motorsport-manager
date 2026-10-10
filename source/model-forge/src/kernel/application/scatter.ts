import { Box3, Matrix4, Vector3 } from 'three';
import { fail } from '../domain/errors.js';
import { parse } from '../domain/parse.js';
import { canonical } from '../domain/canonical.js';
import { sha256Hex } from '../domain/digest.js';
import { createRandom, type Random } from '../domain/random.js';
import {
  OperationSchema,
  ScatterRecipeSchema,
  type ModelLibrary,
  type Operation,
  type SceneDocument,
  type ScatterRecipe,
} from '../domain/schema.js';
import { compileScene } from './compiler.js';
import { subtreeIds } from './composition.js';
import {
  areaBounds,
  gridLayout,
  insideArea,
  insideBounds,
  pathLayout,
  poissonDisk,
  uniformRandom,
  type Bounds2,
  type Point2,
} from './placement.js';
import { instanceNode, scatterSources } from './scatter-items.js';
import { terrainSampler } from './terrain.js';

/** Scene documents hold at most this many nodes; a plan that would exceed it is refused. */
const MAX_NODES = 10000;

export interface ScatterOptions {
  /** Return a plan with only the group node when nothing could be placed. */
  allowEmpty?: boolean;
  /** Remove an existing group of the same ID (and its subtree) first. */
  replace?: boolean;
}
export interface ScatterPlacement {
  seed: number;
  /** sha256 of the canonical normalized recipe; its first 8 characters tag the group. */
  recipeHash: string;
  group: string;
  placed: number;
  candidates: number;
  rejected: { outside: number; exclusion: number; slope: number; budget: number };
}
export interface ScatterPlan {
  /** The normalized recipe, with every default spelled out. */
  recipe: ScatterRecipe;
  operations: Operation[];
  placement: ScatterPlacement;
}
interface Candidate {
  point: Point2;
  heading?: number;
}

function candidates(recipe: ScatterRecipe, random: Random): Candidate[] {
  const d = recipe.distribution;
  if (d.type === 'path')
    return pathLayout(d.points, d.spacing).map(({ point, heading }) => ({
      point,
      heading: d.orient === 'yaw' ? heading : undefined,
    }));
  const area = recipe.area!;
  if (d.type === 'random')
    return uniformRandom(area, d.count, random).points.map((point) => ({ point }));
  const bounds = areaBounds(area);
  const points =
    d.type === 'poisson'
      ? poissonDisk(bounds, d.minDistance, random)
      : gridLayout(bounds, d.step, d.jitter, random);
  return points.map((point) => ({ point }));
}

/** XZ footprints (in the scatter frame) of the nodes to keep clear, grown by the margin. */
function footprints(scene: SceneDocument, models: ModelLibrary, recipe: ScatterRecipe): Bounds2[] {
  if (!recipe.avoidNodes) return [];
  const { ids, margin } = recipe.avoidNodes;
  for (const id of ids)
    if (!scene.nodes.some((n) => n.id === id))
      fail('REFERENCE_MISSING', `avoidNodes names missing node ${id}.`, { node: id });
  const built = compileScene(scene, models, { bindRigs: false });
  try {
    const frame = recipe.parent
      ? built.content.getObjectByName(`${scene.id}/${recipe.parent}`)!
      : built.content;
    const toFrame = new Matrix4().copy(frame.matrixWorld).invert();
    return ids.map((id) => {
      const object = built.content.getObjectByName(`${scene.id}/${id}`)!;
      const box = new Box3().setFromObject(object);
      if (box.isEmpty()) box.setFromPoints([object.getWorldPosition(new Vector3())]);
      const corners = [0, 1, 2, 3, 4, 5, 6, 7].map((i) =>
        new Vector3(
          i & 1 ? box.max.x : box.min.x,
          i & 2 ? box.max.y : box.min.y,
          i & 4 ? box.max.z : box.min.z,
        ).applyMatrix4(toFrame),
      );
      const xs = corners.map((c) => c.x),
        zs = corners.map((c) => c.z);
      return {
        min: [Math.min(...xs) - margin, Math.min(...zs) - margin],
        max: [Math.max(...xs) + margin, Math.max(...zs) + margin],
      } as Bounds2;
    });
  } finally {
    built.dispose();
  }
}

type Ground = (point: Point2) => number | 'outside' | 'slope';
function grounding(scene: SceneDocument, recipe: ScatterRecipe): Ground {
  const ground = recipe.ground;
  if (ground.mode === 'none') return () => 0;
  if (ground.mode === 'plane') return () => ground.y;
  const sample = terrainSampler(scene, ground.node, recipe.parent);
  const steepest = ground.maxSlope >= 90 ? -Infinity : Math.cos((ground.maxSlope * Math.PI) / 180);
  return ([x, z]) => {
    const hit = sample(x, z);
    if (!hit.inside) return 'outside';
    if (hit.normal[1] < steepest - 1e-12) return 'slope';
    return hit.y - ground.sink;
  };
}

/** Choose `count` of `total` indices with a keyed shuffle, returned in ascending order. */
function subset(total: number, count: number, random: Random): number[] {
  const indices = Array.from({ length: total }, (_, i) => i);
  for (let i = 0; i < count; i++) {
    const j = random.int(i, total - 1);
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices.slice(0, count).sort((a, b) => a - b);
}

/**
 * Plan a scatter as ordinary operations: one group putNode tagged `scatter` and
 * `scatter:<recipeHash8>`, then one putNode per placement (`<group>-<n>`), preceded by a
 * cascading removeNode of the old group when `replace` is set. Pure and deterministic:
 * the same scene, models and recipe give the same operations. Each candidate draws its
 * item, scale, rotation and parameters from its own keyed stream, so filtering one
 * candidate never changes another placement.
 */
export function planScatter(
  scene: SceneDocument,
  models: ModelLibrary,
  input: unknown,
  options: ScatterOptions = {},
): ScatterPlan {
  const recipe = parse(ScatterRecipeSchema, input);
  const recipeHash = sha256Hex(canonical(recipe));
  const tag = `scatter:${recipeHash.slice(0, 8)}`;
  const existing = scene.nodes.some((n) => n.id === recipe.group);
  if (existing && !options.replace)
    fail('DUPLICATE_ID', `Node ${recipe.group} already exists.`, {
      id: recipe.group,
      hint: 'Choose another group ID, or replace the existing scatter group (replace: true / --replace) with the write guards.',
    });
  const removed = existing ? subtreeIds(scene, recipe.group) : new Set<string>();
  const working: SceneDocument = { ...scene, nodes: scene.nodes.filter((n) => !removed.has(n.id)) };
  if (recipe.parent && !working.nodes.some((n) => n.id === recipe.parent))
    fail('REFERENCE_MISSING', `Scatter parent ${recipe.parent} does not exist.`);
  const sources = scatterSources(working, models, recipe);
  const ground = grounding(working, recipe);
  const avoid = footprints(working, models, recipe);
  const root = createRandom(recipe.seed, 'scatter');
  const pool = candidates(recipe, root.fork('distribution'));
  const rejected = { outside: 0, exclusion: 0, slope: 0, budget: 0 };
  const accepted: { index: number; candidate: Candidate; y: number }[] = [];
  for (const [index, candidate] of pool.entries()) {
    const p = candidate.point;
    if (recipe.area && !insideArea(recipe.area, p)) {
      rejected.outside++;
      continue;
    }
    if (
      recipe.exclude.some((area) => insideArea(area, p)) ||
      avoid.some((b) => insideBounds(b, p))
    ) {
      rejected.exclusion++;
      continue;
    }
    const y = ground(p);
    if (y === 'outside' || y === 'slope') {
      rejected[y]++;
      continue;
    }
    accepted.push({ index, candidate, y });
  }
  const kept =
    accepted.length > recipe.maxCount
      ? subset(accepted.length, recipe.maxCount, root.fork('budget')).map((i) => accepted[i])
      : accepted;
  rejected.budget = accepted.length - kept.length;
  if (!kept.length && !options.allowEmpty)
    fail('SCATTER_EMPTY', 'The scatter placed nothing.', {
      candidates: pool.length,
      rejected,
      hint: 'Read details.rejected: widen the area, lower minDistance or step, relax exclude/avoidNodes margin or ground.maxSlope, or pass allowEmpty to accept an empty group.',
    });
  if (working.nodes.length + 1 + kept.length > MAX_NODES)
    fail('PROCEDURAL_BUDGET', `The scatter would exceed ${MAX_NODES} document nodes.`, {
      limit: MAX_NODES,
      existing: working.nodes.length,
      placements: kept.length,
      hint: 'Lower maxCount or scatter into a separate model.',
    });
  const taken = new Set(working.nodes.map((n) => n.id));
  const nodes = kept.map(({ index, candidate, y }, n) => {
    const id = `${recipe.group}-${n + 1}`;
    if (taken.has(id))
      fail('DUPLICATE_ID', `Placement ID ${id} is already used by another node.`, {
        id,
        hint: 'Choose a group ID whose <group>-<n> instance IDs are free.',
      });
    const random = root.fork(`c${index}`);
    const source = random.pick(
      sources,
      sources.map((s) => s.weight),
    );
    const scale = random.range(recipe.scale[0], recipe.scale[1]);
    const yawRange = recipe.rotation.yaw ?? (candidate.heading !== undefined ? [0, 0] : [0, 360]);
    const yaw = (candidate.heading ?? 0) + random.range(yawRange[0], yawRange[1]);
    const tilt: [number, number] = [
      random.range(recipe.rotation.tilt[0], recipe.rotation.tilt[1]),
      random.range(recipe.rotation.tilt[0], recipe.rotation.tilt[1]),
    ];
    const position: [number, number, number] = [candidate.point[0], y, candidate.point[1]];
    return instanceNode(
      working,
      source,
      id,
      recipe.group,
      tag,
      { position, yaw, tilt, scale },
      random,
    );
  });
  const group = {
    id: recipe.group,
    type: 'group',
    ...(recipe.parent ? { parent: recipe.parent } : {}),
    tags: ['scatter', tag],
  };
  const operations = [
    ...(existing ? [{ op: 'removeNode', id: recipe.group, cascade: true }] : []),
    { op: 'putNode', node: group },
    ...nodes.map((node) => ({ op: 'putNode', node })),
  ].map((operation) => parse(OperationSchema, operation));
  return {
    recipe,
    operations,
    placement: {
      seed: recipe.seed,
      recipeHash,
      group: recipe.group,
      placed: kept.length,
      candidates: pool.length,
      rejected,
    },
  };
}
