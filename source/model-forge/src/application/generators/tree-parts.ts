import type { Random, V3 } from '../../kernel/index.js';
import { type ModelKit, type Vec, degrees, normalize, p, radians, tint } from './kit.js';
import { frond, lump } from './shapes.js';
import type { TreeParameters } from './tree.js';

/**
 * Builders for the four tree forms. Coordinates are meters at the generated height inside
 * the `tree` group; the crown sits in a `canopy` group scaled by the `canopy` parameter.
 */
type Build = (kit: ModelKit, params: TreeParameters, random: Random) => void;

/** Euler XYZ degrees [0, yaw, tilt] that turn local +Y toward a direction. */
function aim(direction: Vec): V3 {
  const [x, y, z] = normalize(direction);
  const elevation = Math.asin(Math.max(-1, Math.min(1, y)));
  return [0, degrees(Math.atan2(-z, x)), degrees(elevation) - 90];
}
const canopyScale: V3 = [p('canopy'), p('canopy'), p('canopy')];

/** A tapered trunk cylinder from the origin to `top`. */
function trunk(kit: ModelKit, top: Vec, bottom: number, upper: number, id = 'trunk') {
  const length = Math.hypot(...top);
  kit.geometry(id, {
    type: 'cylinder',
    radiusTop: upper,
    radiusBottom: bottom,
    height: length,
    segments: 7,
  });
  kit.mesh(id, id, 'bark', {
    parent: 'tree',
    tags: ['trunk'],
    transform: { position: [top[0] / 2, top[1] / 2, top[2] / 2], rotation: aim(top) },
  });
}
/** A bark-colored branch tube through `points`. */
function branch(kit: ModelKit, id: string, points: Vec[], radius: number) {
  kit.geometry(id, {
    type: 'tube',
    points,
    radius,
    tubularSegments: 10,
    radialSegments: 5,
  });
  kit.mesh(id, id, 'bark', { parent: 'tree', tags: ['branch'] });
}
function leanTop(params: TreeParameters, random: Random, height: number): Vec {
  const angle = random.range(0, Math.PI * 2),
    amount = params.lean * params.height;
  return [Math.cos(angle) * amount, height, Math.sin(angle) * amount];
}

export const buildDeciduous: Build = (kit, params, random) => {
  const radius = Math.min(params.canopyRadius, params.height * 0.5);
  const top = leanTop(params, random.fork('lean'), params.height - radius * 0.92);
  trunk(kit, top, params.trunkRadius, params.trunkRadius * 0.55);
  kit.material('leafDark', {
    color: tint(params.leafColor, 0.78),
    roughness: 0.85,
    flatShading: true,
  });
  for (const key of ['A', 'B'])
    kit.geometry(`clump${key}`, {
      type: 'mesh',
      ...lump(random.fork(`clump${key}`), {
        detail: 1,
        roughness: 0.28,
        frequency: 1.8,
        facets: 0,
        floor: -1,
      }),
    });
  kit.group('canopy', {
    parent: 'tree',
    transform: { position: top as V3, scale: canopyScale },
  });
  const clumps = random.fork('clumps');
  for (let i = 0; i < params.clusters; i++) {
    const main = i === 0;
    const angle = (i / Math.max(1, params.clusters - 1)) * Math.PI * 2 + clumps.range(-0.4, 0.4);
    const distance = main ? 0 : radius * clumps.range(0.42, 0.6);
    const size = radius * (main ? 0.82 : clumps.range(0.42, 0.62));
    const center: Vec = [
      Math.cos(angle) * distance,
      main ? radius * 0.05 : radius * clumps.range(-0.3, 0.35),
      Math.sin(angle) * distance,
    ];
    kit.mesh(
      `clump${i + 1}`,
      `clump${clumps.pick(['A', 'B'])}`,
      i % 3 === 1 ? 'leafDark' : 'leaf',
      {
        parent: 'canopy',
        tags: ['foliage'],
        transform: {
          position: [center[0], center[1] - size * 0.9, center[2]],
          rotation: [0, clumps.range(0, 360), 0],
          scale: [size * 2, size * 1.8, size * 2],
        },
      },
    );
    if (!main && i <= 3) {
      const start: Vec = [top[0] * 0.75, top[1] * 0.75, top[2] * 0.75];
      branch(
        kit,
        `branch${i}`,
        [
          start,
          [
            top[0] + center[0] * 0.8,
            top[1] + center[1] * 0.8 - size * 0.3,
            top[2] + center[2] * 0.8,
          ],
        ],
        params.trunkRadius * 0.3,
      );
    }
  }
};

export const buildConifer: Build = (kit, params, random) => {
  const base = params.height * 0.15,
    tiers = params.tiers;
  trunk(kit, [0, params.height * 0.4, 0], params.trunkRadius, params.trunkRadius * 0.6);
  kit.geometry('tier', { type: 'cone', radius: 1, height: 1, segments: 8 });
  kit.material('leafDark', {
    color: tint(params.leafColor, 0.8),
    roughness: 0.85,
    flatShading: true,
  });
  kit.group('canopy', {
    parent: 'tree',
    transform: { position: [0, base, 0], scale: canopyScale },
  });
  const step = (params.height - base) / (tiers + 0.9),
    yaw = random.fork('tiers');
  for (let i = 0; i < tiers; i++) {
    const radius = params.canopyRadius * (1 - (0.78 * i) / (tiers - 1));
    kit.mesh(`tier${i + 1}`, 'tier', i % 2 ? 'leafDark' : 'leaf', {
      parent: 'canopy',
      tags: ['foliage'],
      transform: {
        position: [0, i * step + step * 0.95, 0],
        rotation: [0, yaw.range(0, 45), 0],
        scale: [radius, step * 1.9, radius],
      },
    });
  }
};

export const buildPalm: Build = (kit, params, random) => {
  const height = params.height * 0.9,
    lean = random.fork('lean');
  const angle = lean.range(0, Math.PI * 2),
    reach = params.lean * params.height * 2;
  const points: Vec[] = Array.from({ length: 7 }, (_, k) => {
    const t = k / 6;
    return [Math.cos(angle) * reach * t * t, height * t, Math.sin(angle) * reach * t * t];
  });
  kit.geometry('trunk', {
    type: 'tube',
    points,
    radius: params.trunkRadius,
    tubularSegments: 24,
    radialSegments: 7,
  });
  kit.mesh('trunk', 'trunk', 'bark', { parent: 'tree', tags: ['trunk'] });
  const crown = points[6];
  kit.group('canopy', { parent: 'tree', transform: { position: crown as V3, scale: canopyScale } });
  kit.geometry('frond', {
    type: 'mesh',
    ...frond(params.canopyRadius, params.canopyRadius * 0.34, params.canopyRadius * 0.45),
  });
  kit.material('frond', {
    color: params.leafColor,
    roughness: 0.85,
    flatShading: true,
    doubleSided: true,
  });
  const fronds = random.fork('fronds');
  for (let i = 0; i < params.fronds; i++) {
    const yaw = (i * 360) / params.fronds + fronds.range(-10, 10);
    const elevation = (i % 2 ? 8 : 28) + fronds.range(-8, 8);
    kit.mesh(`frond${i + 1}`, 'frond', 'frond', {
      parent: 'canopy',
      tags: ['foliage'],
      transform: { rotation: [0, yaw, elevation] },
    });
  }
  kit.geometry('nut', { type: 'sphere', radius: params.trunkRadius * 0.75, segments: 8 });
  kit.material('nut', { color: '#5a4128', roughness: 0.8, flatShading: true });
  for (let i = 0; i < 3; i++) {
    const a = (i * Math.PI * 2) / 3 + angle;
    kit.mesh(`nut${i + 1}`, 'nut', 'nut', {
      parent: 'canopy',
      tags: ['fruit'],
      transform: {
        position: [
          Math.cos(a) * params.trunkRadius * 1.3,
          -params.trunkRadius * 1.2,
          Math.sin(a) * params.trunkRadius * 1.3,
        ],
      },
    });
  }
};

export const buildDead: Build = (kit, params, random) => {
  const height = params.height * 0.82;
  const top = leanTop(params, random.fork('lean'), height);
  trunk(kit, top, params.trunkRadius, params.trunkRadius * 0.3);
  const branches = random.fork('branches'),
    count = params.branches;
  for (let i = 0; i < count; i++) {
    const t = 0.38 + (0.55 * i) / Math.max(1, count);
    const start: Vec = [top[0] * t, top[1] * t, top[2] * t];
    const yaw = radians(i * 137.5 + branches.range(-20, 20));
    const rise = radians(branches.range(25, 50));
    const length = params.height * branches.range(0.22, 0.34) * (1 - (0.35 * i) / count);
    const out = (distance: number, lift: number): Vec => [
      start[0] + Math.cos(yaw) * Math.cos(rise) * distance,
      start[1] + Math.sin(rise) * distance + lift,
      start[2] + Math.sin(yaw) * Math.cos(rise) * distance,
    ];
    const middle = out(length * 0.5, branches.range(-0.05, 0.05) * length),
      end = out(length, length * 0.25);
    const radius = params.trunkRadius * 0.3 * (1 - (0.4 * i) / count);
    branch(kit, `branch${i + 1}`, [start, middle, end], radius);
    const side = yaw + (i % 2 ? 0.9 : -0.9);
    branch(
      kit,
      `twig${i + 1}`,
      [
        middle,
        [
          middle[0] + Math.cos(side) * length * 0.35,
          middle[1] + length * 0.25,
          middle[2] + Math.sin(side) * length * 0.35,
        ],
      ],
      radius * 0.6,
    );
  }
};
