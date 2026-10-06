import * as THREE from 'three';
import type { Geometry } from '../domain/schema.js';
import type { Resolved } from '../domain/validate.js';

/** Centripetal spline tube with separate cap vertices for hard end normals and radial UVs. */
export function tubeGeometry(spec: Resolved<Extract<Geometry, { type: 'tube' }>>) {
  const curve = new THREE.CatmullRomCurve3(
    spec.points.map((point) => new THREE.Vector3(...point)),
    spec.closed,
    'centripetal',
  );
  const geometry = new THREE.TubeGeometry(
    curve,
    spec.tubularSegments,
    spec.radius,
    spec.radialSegments,
    spec.closed,
  );
  if (spec.closed || !spec.capEnds) return geometry;
  const position = geometry.getAttribute('position');
  const positions = Array.from(position.array),
    normals = Array.from(geometry.getAttribute('normal').array),
    uvs = Array.from(geometry.getAttribute('uv').array),
    indices = Array.from(geometry.index!.array);
  for (const end of [0, 1]) {
    const center = curve.getPointAt(end),
      normal = curve.getTangentAt(end).multiplyScalar(end ? 1 : -1),
      base = positions.length / 3;
    positions.push(...center.toArray());
    normals.push(...normal.toArray());
    uvs.push(0.5, 0.5);
    for (let j = 0; j < spec.radialSegments; j++) {
      const index = end * spec.tubularSegments * (spec.radialSegments + 1) + j;
      positions.push(position.getX(index), position.getY(index), position.getZ(index));
      normals.push(...normal.toArray());
      const angle = (j / spec.radialSegments) * Math.PI * 2;
      uvs.push(0.5 + Math.cos(angle) / 2, 0.5 + Math.sin(angle) / 2);
    }
    for (let j = 0; j < spec.radialSegments; j++) {
      const a = base + 1 + j,
        b = base + 1 + ((j + 1) % spec.radialSegments);
      const va = new THREE.Vector3().fromArray(positions, a * 3).sub(center),
        vb = new THREE.Vector3().fromArray(positions, b * 3).sub(center);
      indices.push(...(va.cross(vb).dot(normal) > 0 ? [base, a, b] : [base, b, a]));
    }
  }
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  return geometry;
}
