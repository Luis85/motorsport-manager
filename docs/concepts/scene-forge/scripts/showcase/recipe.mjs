// These helpers only generate checked-in JSON. Recipes never execute JavaScript.
export const p = (name) => ({ $param: name });
export const op = (name, ...args) => ({ $expr: name, args });
export const add = (...args) => op('add', ...args);
export const sub = (a, b) => op('sub', a, b);
export const mul = (...args) => op('mul', ...args);
export const div = (a, b) => op('div', a, b);
export const param = (value, min, max, description, integer = false) => ({
  default: value,
  min,
  max,
  description,
  ...(integer ? { integer: true } : {}),
});
export const material = (color, extra = {}) => ({ color, roughness: 0.55, ...extra });
export const box = (...size) => ({ type: 'box', size });
export const cylinder = (radius, height, segments = 24) => ({
  type: 'cylinder',
  radiusTop: radius,
  radiusBottom: radius,
  height,
  segments,
});
export const sphere = (radius, segments = 16) => ({ type: 'sphere', radius, segments });
export const tube = (points, radius, extra = {}) => ({
  type: 'tube',
  points,
  radius,
  tubularSegments: 48,
  radialSegments: 8,
  ...extra,
});
export const mesh = (id, geometry, material, position = [0, 0, 0], extra = {}) => ({
  id,
  type: 'mesh',
  geometry,
  material,
  transform: { position },
  ...extra,
});
export const instance = (id, model, position = [0, 0, 0], extra = {}) => ({
  id,
  type: 'model',
  model,
  transform: { position },
  ...extra,
});
export const group = (id, position = [0, 0, 0], extra = {}) => ({
  id,
  type: 'group',
  transform: { position },
  ...extra,
});
export const model = (id, name, parameters, materials, geometries, nodes) => ({
  schemaVersion: 1,
  kind: 'model',
  id,
  name,
  parameters,
  materials,
  geometries,
  nodes,
});
export const scene = (id, name, materials, geometries, nodes) => ({
  schemaVersion: 1,
  kind: 'scene',
  id,
  name,
  materials,
  geometries,
  nodes,
});
