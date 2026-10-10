import { canonical } from '../domain/canonical.js';
import { fail } from '../domain/errors.js';

type Plain = Record<string, unknown>;
const plain = (value: unknown): value is Plain =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const fields = new Set([
  'color',
  'roughness',
  'metalness',
  'opacity',
  'transparent',
  'depthWrite',
  'doubleSided',
  'flatShading',
  'emissive',
  'emissiveIntensity',
  'sheen',
  'sheenColor',
  'sheenRoughness',
  'clearcoat',
  'clearcoatRoughness',
]);

/** Bake per-node overrides into portable material slots, without changing shared base values. */
export function importedMaterials(materials: Plain, used: Plain) {
  const byValue = new Map<string, string>();
  return (role: string, props: unknown, nodeId: string, mesh: boolean) => {
    const base = Object.hasOwn(materials, role) ? materials[role] : role;
    if (props !== undefined && !plain(props))
      fail('LITTLEWILD_IMPORT', `Node ${nodeId} materialProps must be an object.`);
    const data: Plain = {
      ...(typeof base === 'string' ? { color: base } : plain(base) ? base : {}),
      ...(plain(props) ? props : {}),
    };
    const unsupported = (field: string, reason: string): never =>
      fail(
        'LITTLEWILD_MATERIAL_UNSUPPORTED',
        `Node ${nodeId} material ${role}: ${field} ${reason}`,
        { node: nodeId, material: role, field, value: data[field] },
      );
    for (const field of Object.keys(data))
      if (!fields.has(field)) unsupported(field, 'is not supported by Scene Forge.');
    const opacity = data.opacity ?? 1;
    const transparent = data.transparent ?? false;
    if (data.depthWrite !== undefined && typeof data.depthWrite !== 'boolean')
      unsupported('depthWrite', 'must be a boolean.');
    if (
      data.depthWrite === false &&
      !(transparent === true && typeof opacity === 'number' && opacity < 1)
    )
      unsupported('depthWrite', 'false requires an alpha-blended surface with opacity below 1.');
    if (
      typeof transparent !== 'boolean' ||
      transparent !== (typeof opacity === 'number' && opacity < 1)
    )
      unsupported(
        'transparent',
        'must match opacity < 1; change the source explicitly before importing.',
      );
    if (typeof data.emissiveIntensity === 'number' && data.emissiveIntensity > 20)
      unsupported('emissiveIntensity', 'exceeds Scene Forge’s maximum of 20.');
    const { transparent: _transparent, ...mapped } = data;
    const material: Plain = {
      roughness: 0.98,
      metalness: 0,
      opacity: 1,
      flatShading: !mesh,
      ...mapped,
    };
    const key = canonical([role, material]);
    const found = byValue.get(key);
    if (found) return found;
    const stem = (Object.hasOwn(materials, role) ? role : `c${role.replace('#', '')}`).replace(
      /[^A-Za-z0-9_-]/g,
      '-',
    );
    const prefix = /^[A-Za-z]/.test(stem) ? stem : `m${stem}`;
    const hasOverride = plain(props) && Object.keys(props).length > 0;
    let id = `${prefix.slice(0, hasOverride ? 32 : 64)}${hasOverride ? `-${nodeId.slice(0, 30)}` : ''}`;
    const start = id;
    let collision = 1;
    while (Object.hasOwn(used, id)) id = `${start.slice(0, 55)}-${collision++}`;
    used[id] = material;
    byValue.set(key, id);
    return id;
  };
}
