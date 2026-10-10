import * as THREE from 'three';
import type { Geometry } from '../domain/schema.js';
import type { Resolved } from '../domain/validate.js';

/** Smooth, closed plush forms. Taper narrows the top; bend offsets the two ends along X. */
export function organicGeometry(g: Resolved<Extract<Geometry, { type: 'organic' }>>) {
  const around = g.segments;
  const rows = Math.max(8, Math.floor(around / 2));
  const positions: number[] = [],
    uvs: number[] = [],
    indices: number[] = [];
  const power = (v: number) => Math.sign(v) * Math.pow(Math.abs(v), g.roundness);
  for (let row = 0; row <= rows; row++) {
    const latitude = (Math.PI * row) / rows;
    const y = power(Math.cos(latitude));
    const radius = Math.pow(Math.sin(latitude), g.roundness) * (1 - g.taper * y);
    for (let column = 0; column <= around; column++) {
      const longitude = (Math.PI * 2 * column) / around;
      positions.push(
        ((radius * power(Math.cos(longitude)) + g.bend * y * y) * g.size[0]) / 2,
        (y * g.size[1]) / 2,
        (radius * power(Math.sin(longitude)) * g.size[2]) / 2,
      );
      uvs.push(column / around, 1 - row / rows);
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
