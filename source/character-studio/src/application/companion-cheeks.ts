import { surface } from './plush-meshes.js';

/** Thin coat tint follows the actual head curvature rather than intersecting it. */
export function cheekPatch(side: -1 | 1): ReturnType<typeof surface> {
  return surface(() => 1, 16, 8, (x, y, z) => {
    const px = side * .184 + x * .036;
    const py = -.071 + y * .024;
    const latitude = py / .236;
    const radius = Math.sqrt(1 - latitude * latitude) * (1 - .13 * latitude);
    const headZ = .220 * Math.sqrt(radius * radius - (px / .285) ** 2);
    return [px, py, headZ + .0018 + z * .0007];
  });
}
