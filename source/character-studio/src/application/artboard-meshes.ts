import { surface, type BakedMesh } from './plush-meshes.js';
import { withSphericalUvs } from './companion-uvs.js';

import { paintedHead } from './artboard-head.js';
export function artboardMeshes(): Record<string, ReturnType<typeof withSphericalUvs>> {
  const meshes: Record<string, BakedMesh> = {
    'studio-soft': surface(() => 1, 28, 20),
    'studio4-body': surface(y => .96 - .26 * y, 32, 24,
      (x, y, z) => [x, y, z + .10 * (1 - y * y)]),
    'studio4-ear-round': surface(() => 1, 32, 20, (x, y, z) =>
      [x, y, z > 0 ? z - .58 * Math.max(0, 1 - (x * x + y * y) / .64) ** 2 : z]),
    'studio4-ear-tapered': surface(y => .83 - .27 * y, 28, 20,
      (x, y, z) => [x, y, z > 0 ? z - .25 * Math.max(0, 1 - (x * x + y * y) / .65) ** 2 : z]),
    'studio4-eyelid': surface(() => 1, 24, 10,
      (x, y, z) => [x, .10 * y + .91 * Math.sqrt(Math.max(.01, 1 - .97 * x * x)), z]),
    'studio4-brow': surface(() => 1, 20, 10,
      (x, y, z) => [x, .22 * y + .42 * (1 - x * x), z]),
    'studio4-nose': surface(y => .70 + .33 * y, 24, 16),
    'studio4-smile': surface(() => 1, 24, 16,
      (x, y, z) => [x * (1 + .18 * y), y + .30 * x * x, z]),
    'studio4-tuft': surface(y => .74 - .33 * y, 16, 12,
      (x, y, z) => [x + .22 * (y + 1) ** 2, y, z]),
  };
  return {...paintedHead(), ...Object.fromEntries(Object.entries(meshes).map(([id, mesh]) => [id, withSphericalUvs(mesh)]))};
}
