import * as THREE from 'three';
import type { HeightfieldGeometry } from '../domain/schema.js';
import type { Resolved } from '../domain/validate.js';

/**
 * Deterministic heightfield terrain. Heights come from fBm noise on an integer lattice
 * using only + - * / and 32-bit integer hashing, so every JavaScript engine computes the
 * same values. The mesh and sampleHeightfield share one grid and one triangulation:
 * each cell (ix, iz) splits along the diagonal from (ix+1, iz) to (ix, iz+1).
 */
export type HeightfieldSpec = Resolved<HeightfieldGeometry>;

/** Integer lattice hash: a uniform value in [0, 1) for (x, z, octave, seed). */
function lattice(x: number, z: number, octave: number, seed: number): number {
  let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(z | 0, 0x165667b1);
  h = Math.imul(h ^ seed, 0x85ebca6b) ^ Math.imul(octave + 1, 0xc2b2ae35);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  h = Math.imul(h, 0x297a2d39);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}
const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (t: number) => t * t * (3 - 2 * t);

/** Value noise in [0, 1): quintic interpolation of four lattice values. */
function valueNoise(x: number, z: number, octave: number, seed: number): number {
  const x0 = Math.floor(x),
    z0 = Math.floor(z),
    tx = fade(x - x0),
    tz = fade(z - z0);
  const a = lattice(x0, z0, octave, seed),
    b = lattice(x0 + 1, z0, octave, seed),
    c = lattice(x0, z0 + 1, octave, seed),
    d = lattice(x0 + 1, z0 + 1, octave, seed);
  const top = a + (b - a) * tx,
    bottom = c + (d - c) * tx;
  return top + (bottom - top) * tz;
}

/** Normalized height in [0, 1] at grid coordinates u, v in [0, 1]. */
function height(spec: HeightfieldSpec, u: number, v: number): number {
  const { kind, octaves, frequency, lacunarity, gain } = spec.noise;
  let sum = 0,
    weight = 0,
    amplitude = 1,
    f = frequency;
  for (let octave = 0; octave < octaves; octave++) {
    const n = valueNoise(u * f, v * f, octave, spec.seed);
    const signed = 2 * n - 1,
      folded = signed < 0 ? -signed : signed;
    const shaped = kind === 'ridged' ? (1 - folded) * (1 - folded) : kind === 'billow' ? folded : n;
    sum += shaped * amplitude;
    weight += amplitude;
    amplitude *= gain;
    f *= lacunarity;
  }
  let h = weight > 0 ? sum / weight : 0;
  const dx = 2 * u - 1,
    dz = 2 * v - 1,
    d2 = clamp01(dx * dx + dz * dz);
  if (spec.falloff === 'island') h *= smooth(clamp01((1 - d2) * 1.25));
  else if (spec.falloff === 'basin') h = h * 0.5 + 0.5 * smooth(d2);
  if (spec.terrace > 0) {
    const t = h * spec.terrace,
      step = Math.floor(t),
      frac = t - step;
    h = (step + frac * frac * frac * frac) / spec.terrace;
  }
  return clamp01(h);
}

/** Heights in meters (0..amplitude) for every grid vertex, row-major by z then x. */
export function heightGrid(spec: HeightfieldSpec): Float64Array {
  const [nx, nz] = spec.resolution;
  const grid = new Float64Array(nx * nz);
  for (let iz = 0; iz < nz; iz++)
    for (let ix = 0; ix < nx; ix++)
      grid[iz * nx + ix] = height(spec, ix / (nx - 1), iz / (nz - 1)) * spec.amplitude;
  return grid;
}

export interface HeightSample {
  /** Height on the rendered surface in the geometry's local frame. */
  y: number;
  /** Unit normal of the rendered triangle under the point. */
  normal: [number, number, number];
  /** False when (x, z) lies outside the terrain extent; the sample is then clamped to the edge. */
  inside: boolean;
}

/** A sampler over one computed grid, for many queries against the same terrain. */
export function heightfieldSampler(spec: HeightfieldSpec) {
  const grid = heightGrid(spec);
  const [nx, nz] = spec.resolution,
    [sx, sz] = spec.size;
  const cellX = sx / (nx - 1),
    cellZ = sz / (nz - 1);
  return (x: number, z: number): HeightSample => {
    const gx = (x + sx / 2) / cellX,
      gz = (z + sz / 2) / cellZ;
    const inside = gx >= -1e-9 && gz >= -1e-9 && gx <= nx - 1 + 1e-9 && gz <= nz - 1 + 1e-9;
    const cx = Math.min(nx - 1, Math.max(0, gx)),
      cz = Math.min(nz - 1, Math.max(0, gz));
    const ix = Math.min(nx - 2, Math.floor(cx)),
      iz = Math.min(nz - 2, Math.floor(cz));
    const fx = cx - ix,
      fz = cz - iz;
    const a = grid[iz * nx + ix],
      b = grid[iz * nx + ix + 1],
      c = grid[(iz + 1) * nx + ix],
      d = grid[(iz + 1) * nx + ix + 1];
    let y: number, slopeX: number, slopeZ: number;
    if (fx + fz <= 1) {
      // Triangle (a, c, b): the cell corner at (ix, iz).
      y = a + fx * (b - a) + fz * (c - a);
      slopeX = (b - a) / cellX;
      slopeZ = (c - a) / cellZ;
    } else {
      // Triangle (b, c, d): the cell corner at (ix + 1, iz + 1).
      y = d + (1 - fx) * (c - d) + (1 - fz) * (b - d);
      slopeX = (d - c) / cellX;
      slopeZ = (d - b) / cellZ;
    }
    const length = Math.sqrt(slopeX * slopeX + 1 + slopeZ * slopeZ);
    return { y, normal: [-slopeX / length, 1 / length, -slopeZ / length], inside };
  };
}

/** Height and surface normal of the rendered mesh at local (x, z). */
export function sampleHeightfield(spec: HeightfieldSpec, x: number, z: number): HeightSample {
  return heightfieldSampler(spec)(x, z);
}

/** The terrain mesh: grid positions, shared-vertex triangles, UVs and optional band colors. */
export function heightfieldGeometry(spec: HeightfieldSpec): THREE.BufferGeometry {
  const grid = heightGrid(spec);
  const [nx, nz] = spec.resolution,
    [sx, sz] = spec.size;
  const positions = new Float32Array(nx * nz * 3),
    uvs = new Float32Array(nx * nz * 2);
  for (let iz = 0; iz < nz; iz++)
    for (let ix = 0; ix < nx; ix++) {
      const i = iz * nx + ix;
      positions[i * 3] = -sx / 2 + (sx * ix) / (nx - 1);
      positions[i * 3 + 1] = grid[i];
      positions[i * 3 + 2] = -sz / 2 + (sz * iz) / (nz - 1);
      uvs[i * 2] = ix / (nx - 1);
      uvs[i * 2 + 1] = 1 - iz / (nz - 1);
    }
  const indices: number[] = [];
  for (let iz = 0; iz < nz - 1; iz++)
    for (let ix = 0; ix < nx - 1; ix++) {
      const a = iz * nx + ix,
        b = a + 1,
        c = a + nx,
        d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  if (spec.bands) {
    const bands = spec.bands.map((band) => ({
      below: band.below,
      color: new THREE.Color(band.color),
    }));
    const colors = new Float32Array(nx * nz * 3);
    for (let i = 0; i < nx * nz; i++) {
      const normalized = spec.amplitude > 0 ? grid[i] / spec.amplitude : 0;
      const band = bands.find((entry) => normalized <= entry.below) ?? bands[bands.length - 1];
      colors[i * 3] = band.color.r;
      colors[i * 3 + 1] = band.color.g;
      colors[i * 3 + 2] = band.color.b;
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  }
  return geometry;
}
