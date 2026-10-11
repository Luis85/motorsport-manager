import * as THREE from 'three';
import type { Geometry } from '../domain/schema.js';
import type { Resolved } from '../domain/validate.js';

type Form = Resolved<Extract<Geometry, { type: 'organic' }>>;
/** Smoothstep never overshoots the authored bounds and keeps station transitions C1. */
function section(profile: Form['profile'], y: number) {
  if (!profile) return { width: 1, depth: 1, offset: [0, 0] };
  let index = 1;
  while (index < profile.length - 1 && profile[index].at < y) index++;
  const a = profile[index - 1],
    b = profile[index];
  const t = Math.max(0, Math.min(1, (y - a.at) / (b.at - a.at))),
    blend = t * t * (3 - 2 * t);
  const mix = (start: number, end: number) => start + (end - start) * blend;
  return {
    width: mix(a.width, b.width),
    depth: mix(a.depth, b.depth),
    offset: a.offset.map((value, axis) => mix(value, b.offset[axis])),
  };
}

/** Smooth, closed plush forms. Taper narrows the top; bend offsets the two ends along X. */
export function organicGeometry(g: Form) {
  const around = g.segments;
  const baseRows = Math.max(8, Math.floor(around / 2));
  const positions: number[] = [],
    uvs: number[] = [],
    indices: number[] = [];
  const power = (v: number) => Math.sign(v) * Math.pow(Math.abs(v), g.roundness);
  const heights = Array.from({ length: baseRows + 1 }, (_, row) =>
    power(Math.cos((Math.PI * row) / baseRows)),
  );
  for (const station of g.profile ?? [])
    if (!heights.some((y) => Math.abs(y - station.at) < 1e-10)) heights.push(station.at);
  heights.sort((a, b) => b - a);
  const rows = heights.length - 1;
  for (let row = 0; row <= rows; row++) {
    const y = heights[row];
    const latitude = g.profile
      ? Math.acos(Math.sign(y) * Math.pow(Math.abs(y), 1 / g.roundness))
      : (Math.PI * row) / rows;
    const shape = section(g.profile, y);
    const radius = Math.pow(Math.sin(latitude), g.roundness) * (1 - g.taper * y);
    for (let column = 0; column <= around; column++) {
      const longitude = (Math.PI * 2 * column) / around;
      positions.push(
        ((radius * power(Math.cos(longitude)) * shape.width + g.bend * y * y + shape.offset[0]) *
          g.size[0]) /
          2,
        (y * g.size[1]) / 2,
        ((radius * power(Math.sin(longitude)) * shape.depth + shape.offset[1]) * g.size[2]) / 2,
      );
      uvs.push(column / around, g.profile ? 1 - latitude / Math.PI : 1 - row / rows);
      if (row < rows && column < around) {
        const a = row * (around + 1) + column,
          b = a + around + 1;
        if (row > 0) indices.push(a, a + 1, b);
        if (row < rows - 1) indices.push(b, a + 1, b + 1);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  // The UV seam has duplicate vertices but shares its smooth geometric normal.
  const normals = geometry.getAttribute('normal');
  for (let row = 0; row <= rows; row++) {
    const first = row * (around + 1),
      last = first + around;
    const normal = new THREE.Vector3()
      .fromBufferAttribute(normals, first)
      .add(new THREE.Vector3().fromBufferAttribute(normals, last))
      .normalize();
    if (row === 0 || row === rows) {
      for (let col = 0; col <= around; col++) normals.setXYZ(first + col, 0, row === 0 ? 1 : -1, 0);
    } else {
      normals.setXYZ(first, normal.x, normal.y, normal.z);
      normals.setXYZ(last, normal.x, normal.y, normal.z);
    }
  }
  return geometry;
}
