import {
  fail,
  ForgeError,
  gridArea,
  nodeFrame,
  terrainSpec,
  applySimilarity,
  type Area,
  type SceneDocument,
  type ScatterRecipeInput,
} from '../kernel.js';

/**
 * Compile the procedural command flags into the same ScatterRecipe a `--file` accepts.
 * Pure text-to-data translation: the kernel's planner validates the result, so a flag
 * recipe and its echoed JSON recipe are interchangeable.
 */
export type Pair = [number, number];

/** A missing input, with its remedy as the error's top-level hint (like every other code). */
function required(message: string, hint: string): never {
  throw Object.assign(new ForgeError('INPUT_REQUIRED', message), { hint });
}
const invalid = (flag: string, expected: string, value: string): never =>
  fail('INVALID_OPTION', `${flag} expects ${expected}, got ${JSON.stringify(value)}.`, {
    flag,
    value,
  });
function numbersOf(text: string, flag: string, expected: string, count?: number): number[] {
  const parts = text.split(',');
  const values = parts.map(Number);
  if (
    parts.some((part) => !part.trim()) ||
    values.some((n) => !Number.isFinite(n)) ||
    (count !== undefined && values.length !== count)
  )
    invalid(flag, expected, text);
  return values;
}
/** `x,z;x,z;...` into points. */
export function parsePoints(text: string, flag: string, minimum = 1): Pair[] {
  const points = text
    .split(';')
    .map((part) => numbersOf(part, flag, 'semicolon-separated x,z points', 2) as Pair);
  if (points.length < minimum) invalid(flag, `at least ${minimum} x,z points`, text);
  return points;
}
/** `a..b` (inclusive range) or a single value `a` (fixed). */
export function parseRange(text: string, flag: string): Pair {
  const parts = text.split('..');
  const [low, high] = parts.map((part) => (part.trim() ? Number(part) : NaN));
  const range: Pair = [low, parts.length === 1 ? low : high];
  if (parts.length > 2 || range.some((v) => !Number.isFinite(v)) || range[0] > range[1])
    invalid(flag, 'a range min..max (or one value)', text);
  return range;
}
/** `rect:x0,z0,x1,z1`, `circle:x,z,r` or `polygon:x,z;x,z;x,z[;...]`. */
export function parseArea(text: string, flag = '--area'): Area {
  const [type, body = ''] = text.split(/:(.*)/s);
  if (type === 'rect') {
    const [x0, z0, x1, z1] = numbersOf(body, flag, 'rect:x0,z0,x1,z1', 4);
    return {
      type: 'rect',
      min: [Math.min(x0, x1), Math.min(z0, z1)],
      max: [Math.max(x0, x1), Math.max(z0, z1)],
    };
  }
  if (type === 'circle') {
    const [x, z, radius] = numbersOf(body, flag, 'circle:x,z,radius', 3);
    return { type: 'circle', center: [x, z], radius };
  }
  if (type === 'polygon') return { type: 'polygon', points: parsePoints(body, flag, 3) };
  return invalid(flag, 'rect:x0,z0,x1,z1, circle:x,z,r or polygon:x,z;x,z;x,z', text);
}
/** `rock,tree:3` into weighted model items. */
export function parseItems(text: string) {
  return text.split(',').map((entry) => {
    const [model, weight] = entry.trim().split(':');
    if (!model) invalid('--model', 'model IDs, optionally weighted as id:weight', text);
    if (weight === undefined) return { model };
    const value = Number(weight);
    if (!weight.trim() || !(value > 0)) invalid('--model', 'a positive weight after id:', text);
    return { model, weight: value };
  });
}
/** `CxR` grid counts. */
export function parseGrid(text: string): Pair {
  const match = /^(\d+)x(\d+)$/i.exec(text.trim());
  const counts = match ? ([Number(match[1]), Number(match[2])] as Pair) : undefined;
  if (!counts || counts.some((n) => n < 1))
    return invalid('--grid', 'COLUMNSxROWS such as 4x3', text);
  return counts;
}

/** Flags shared by scatter and layout. */
export interface PlacementFlags {
  model?: string;
  seed?: number;
  group?: string;
  parent?: string;
  on?: string;
  sink?: number;
  maxSlope?: number;
  scale?: string;
  yaw?: string;
  tilt?: string;
  max?: number;
  exclude?: string[];
  avoid?: string;
  margin?: number;
}
export interface ScatterFlags extends PlacementFlags {
  area?: string;
  spacing?: number;
  count?: number;
}
export interface LayoutFlags extends PlacementFlags {
  path?: string;
  spacing?: number;
  orient?: 'yaw' | 'none';
  grid?: string;
  step?: string;
  jitter?: number;
  center?: string;
}

/** Recipe flags that conflict with a complete `--file`/`--data` recipe. */
export const recipeFlags = [
  'model',
  'area',
  'spacing',
  'count',
  'parent',
  'on',
  'sink',
  'maxSlope',
  'scale',
  'yaw',
  'tilt',
  'max',
  'exclude',
  'avoid',
  'margin',
] as const;

function common(flags: PlacementFlags, defaultGroup: string, defaultYaw?: Pair) {
  if (!flags.model)
    required(
      'Pass --model <id[,id:weight...]> or a recipe --file.',
      'Run model list for the registered model IDs; weight them as id:weight.',
    );
  const items = parseItems(flags.model);
  if ((flags.sink !== undefined || flags.maxSlope !== undefined) && !flags.on)
    fail('INVALID_OPTION', '--sink and --max-slope apply only with --on <terrain node>.');
  if (flags.margin !== undefined && !flags.avoid)
    fail('INVALID_OPTION', '--margin applies only with --avoid <ids>.');
  const yaw = flags.yaw ? parseRange(flags.yaw, '--yaw') : defaultYaw;
  const tilt = flags.tilt ? parseRange(flags.tilt, '--tilt') : undefined;
  return {
    schemaVersion: 1 as const,
    kind: 'scatter' as const,
    ...(flags.seed !== undefined ? { seed: flags.seed } : {}),
    group: flags.group ?? `${items[0].model.slice(0, 48)}-${defaultGroup}`,
    ...(flags.parent ? { parent: flags.parent } : {}),
    ...(flags.exclude?.length
      ? { exclude: flags.exclude.map((a) => parseArea(a, '--exclude')) }
      : {}),
    ...(flags.avoid
      ? {
          avoidNodes: {
            ids: flags.avoid.split(',').map((id) => id.trim()),
            ...(flags.margin !== undefined ? { margin: flags.margin } : {}),
          },
        }
      : {}),
    ...(flags.max !== undefined ? { maxCount: flags.max } : {}),
    items,
    ...(flags.scale ? { scale: parseRange(flags.scale, '--scale') } : {}),
    ...(yaw || tilt ? { rotation: { ...(yaw ? { yaw } : {}), ...(tilt ? { tilt } : {}) } } : {}),
    ...(flags.on
      ? {
          ground: {
            mode: 'terrain' as const,
            node: flags.on,
            ...(flags.sink !== undefined ? { sink: flags.sink } : {}),
            ...(flags.maxSlope !== undefined ? { maxSlope: flags.maxSlope } : {}),
          },
        }
      : {}),
  };
}

/** The world-space XZ footprint of a terrain node: a rect, or a polygon when it is turned. */
export function terrainFootprint(scene: SceneDocument, node: string): Area {
  const [sx, sz] = terrainSpec(scene, node).size as Pair;
  const frame = nodeFrame(scene, node, 'terrain');
  const corners = [
    [-sx / 2, -sz / 2],
    [sx / 2, -sz / 2],
    [sx / 2, sz / 2],
    [-sx / 2, sz / 2],
  ].map(([x, z]) => {
    const p = applySimilarity(frame, [x, 0, z]);
    return [p[0], p[2]] as Pair;
  });
  if (Math.abs(frame.yaw % (2 * Math.PI)) > 1e-12) return { type: 'polygon', points: corners };
  return { type: 'rect', min: corners[0], max: corners[2] };
}

/**
 * `scatter` flags: poisson (--spacing) or uniform random (--count) placements in --area,
 * which defaults to the --on terrain's footprint when no --parent frame is involved.
 */
export function scatterRecipe(flags: ScatterFlags, scene: SceneDocument): ScatterRecipeInput {
  if ((flags.spacing === undefined) === (flags.count === undefined))
    required(
      'Pass exactly one of --spacing <meters> (even blue noise) or --count <n>.',
      'Use --spacing for an even natural spread; use layout for paths and grids.',
    );
  let area: Area;
  if (flags.area) area = parseArea(flags.area);
  else if (flags.on && !flags.parent) area = terrainFootprint(scene, flags.on);
  else
    return required(
      'Pass --area rect:x0,z0,x1,z1|circle:x,z,r|polygon:x,z;...',
      '--area may be omitted only with --on <terrain> and no --parent: it then covers the terrain.',
    );
  return {
    ...common(flags, 'scatter'),
    area,
    distribution:
      flags.spacing !== undefined
        ? { type: 'poisson', minDistance: flags.spacing }
        : { type: 'random', count: flags.count! },
  };
}

/** `layout` flags: evenly spaced along --path, or a COLUMNSxROWS --grid; yaw defaults to 0. */
export function layoutRecipe(flags: LayoutFlags): ScatterRecipeInput {
  if (!!flags.path === !!flags.grid)
    required(
      'Pass exactly one of --path "x,z;x,z;..." or --grid COLUMNSxROWS.',
      'A path places along a polyline with --spacing; a grid places COLUMNSxROWS with --step.',
    );
  if (flags.path) {
    if (flags.spacing === undefined)
      required(
        '--path needs --spacing <meters>.',
        'Pass --spacing: the distance between placements.',
      );
    if (flags.step || flags.jitter !== undefined || flags.center)
      fail('INVALID_OPTION', '--step, --jitter and --center apply only to --grid.');
    return {
      ...common(flags, 'layout', [0, 0]),
      distribution: {
        type: 'path',
        points: parsePoints(flags.path, '--path', 2),
        spacing: flags.spacing,
        orient: flags.orient ?? 'yaw',
      },
    };
  }
  if (flags.spacing !== undefined || flags.orient)
    fail('INVALID_OPTION', '--spacing and --orient apply only to --path; use --step for --grid.');
  if (!flags.step)
    return required(
      '--grid needs --step <meters>.',
      'Pass --step s: COLUMNSxROWS placements spaced s apart on both axes.',
    );
  const steps = numbersOf(flags.step, '--step', 'one spacing s, or s,s', undefined);
  if (steps.length > 2 || steps.some((s) => !(s > 0)) || steps[0] !== steps.at(-1))
    throw Object.assign(
      new ForgeError('INVALID_OPTION', 'Grid layouts use one positive step on both axes.', {
        step: flags.step,
      }),
      { hint: 'Pass --step s. For different row spacing, lay out each row with --path.' },
    );
  const [columns, rows] = parseGrid(flags.grid!);
  const step = steps[0];
  const [cx, cz] = flags.center ? numbersOf(flags.center, '--center', 'x,z', 2) : [0, 0];
  // The kernel's grid fills its area's bounds from the center out; gridArea's margin just
  // under half a step keeps exactly COLUMNS x ROWS points with 1e-4 bounds (no float noise).
  return {
    ...common(flags, 'layout', [0, 0]),
    area: gridArea(columns, rows, step, [cx, cz]),
    distribution: {
      type: 'grid',
      step,
      ...(flags.jitter !== undefined ? { jitter: flags.jitter } : {}),
    },
  };
}
