import {
  Box3,
  Vector3,
  Mesh,
  SkinnedMesh,
  MeshStandardMaterial,
  DoubleSide,
  type BufferGeometry,
} from 'three';
import { compileScene } from './compiler.js';
import {
  parse,
  QualityPolicySchema,
  type SceneDocument,
  type ModelLibrary,
  type QualityPolicy,
} from '../domain/schema.js';

export interface QualityFinding {
  code: string;
  severity: 'error' | 'warning';
  message: string;
  count: number;
  paths: string[];
  hint: string;
}

/** Inspect the visible deliverable. Findings are aggregated; paths are capped to keep agent responses bounded. */
export function auditScene(
  scene: SceneDocument,
  models: ModelLibrary = {},
  input: Partial<QualityPolicy> = {},
) {
  const policy = parse(QualityPolicySchema, { schemaVersion: 1, kind: 'quality-policy', ...input });
  const built = compileScene(scene, models);
  try {
    const findings = new Map<string, QualityFinding>();
    const add = (
      code: string,
      severity: QualityFinding['severity'],
      message: string,
      hint: string,
      path?: string,
      count = 1,
    ) => {
      const f = findings.get(code) ?? { code, severity, message, count: 0, paths: [], hint };
      f.count += count;
      if (path && !f.paths.includes(path) && f.paths.length < 10) f.paths.push(path);
      findings.set(code, f);
    };
    const geometries = new Set<BufferGeometry>(),
      materials = new Set<MeshStandardMaterial>();
    const degenerate = new Map<BufferGeometry, number>();
    const bounds = new Box3();
    const a = new Vector3(),
      b = new Vector3(),
      c = new Vector3(),
      ab = new Vector3(),
      ac = new Vector3();
    let meshes = 0,
      triangles = 0,
      geometryBytes = 0,
      nodes = 0;
    built.content.traverseVisible((object) => {
      if (object.userData.forgeId) nodes++;
      if (!(object instanceof Mesh)) return;
      meshes++;
      const g: BufferGeometry = object.geometry;
      const position = g.getAttribute('position');
      const count = (g.index?.count ?? position.count) / 3;
      triangles += count;
      if (!geometries.has(g)) {
        geometries.add(g);
        geometryBytes +=
          (g.index?.array.byteLength ?? 0) +
          Object.values(g.attributes).reduce((sum, attr) => sum + attr.array.byteLength, 0);
      }
      if (object instanceof SkinnedMesh) {
        object.computeBoundingBox();
        if (object.boundingBox)
          bounds.union(object.boundingBox.clone().applyMatrix4(object.matrixWorld));
      } else {
        if (!g.boundingBox) g.computeBoundingBox();
        bounds.union(g.boundingBox!.clone().applyMatrix4(object.matrixWorld));
      }
      if (!degenerate.has(g)) {
        let invalid = 0;
        for (let i = 0; i < count * 3; i += 3) {
          const at = (offset: number) => (g.index ? g.index.getX(i + offset) : i + offset);
          a.fromBufferAttribute(position, at(0));
          b.fromBufferAttribute(position, at(1));
          c.fromBufferAttribute(position, at(2));
          ab.subVectors(b, a);
          ac.subVectors(c, a);
          const edge = Math.max(ab.lengthSq(), ac.lengthSq(), b.distanceToSquared(c));
          if (ab.cross(ac).lengthSq() <= edge * edge * 1e-24) invalid++;
        }
        degenerate.set(g, invalid);
      }
      const invalid = degenerate.get(g)!;
      if (invalid)
        add(
          'DEGENERATE_TRIANGLES',
          'error',
          'Visible geometry contains zero-area or nearly collinear triangles.',
          'Repair mesh indices/positions or revise boolean operands; inspect the listed paths.',
          object.name,
          invalid,
        );
      if (policy.requireUVs && !g.hasAttribute('uv'))
        add(
          'UVS_REQUIRED',
          'error',
          'The quality policy requires UV coordinates.',
          'Supply one uv pair per position in custom meshes; CSG currently discards UVs.',
          object.name,
        );
      if (object.matrixWorld.determinant() < 0)
        add(
          'MIRRORED_TRANSFORM',
          'warning',
          'A visible mesh has a mirrored world transform.',
          'Review winding, normals and face culling in the target renderer.',
          object.name,
        );
      for (const m of (Array.isArray(object.material)
        ? object.material
        : [object.material]) as MeshStandardMaterial[]) {
        materials.add(m);
        if (m.transparent)
          add(
            'TRANSPARENCY',
            policy.allowTransparency ? 'warning' : 'error',
            'Alpha blending can produce sorting differences between renderers.',
            'Review overlapping transparent surfaces; use opaque materials when transparency is unnecessary.',
            object.name,
          );
        if (m.side === DoubleSide && !policy.allowDoubleSided)
          add(
            'DOUBLE_SIDED',
            'error',
            'The quality policy disallows double-sided materials.',
            'Correct winding or explicitly permit double-sided surfaces in the policy.',
            object.name,
          );
      }
    });
    if (!meshes)
      add(
        'EMPTY_DELIVERABLE',
        'error',
        'No visible meshes will be exported.',
        'Add a mesh/model or enable visibility on its ancestors.',
      );
    const size = bounds.isEmpty() ? [0, 0, 0] : bounds.getSize(new Vector3()).toArray();
    const metrics = {
      nodes,
      meshes,
      triangles,
      geometries: geometries.size,
      materials: materials.size,
      geometryBytes,
      maxExtent: Math.max(...size),
      bounds: {
        min: bounds.isEmpty() ? [0, 0, 0] : bounds.min.toArray(),
        max: bounds.isEmpty() ? [0, 0, 0] : bounds.max.toArray(),
        size,
      },
    };
    for (const [limit, metric] of [
      ['maxTriangles', 'triangles'],
      ['maxMeshes', 'meshes'],
      ['maxMaterials', 'materials'],
      ['maxGeometries', 'geometries'],
      ['maxExtent', 'maxExtent'],
    ] as const) {
      const value = policy[limit];
      if (value !== undefined && metrics[metric] > value)
        add(
          'BUDGET_' + metric.toUpperCase(),
          'error',
          `${metric} is ${metrics[metric]}; the policy limit is ${value}.`,
          'Reduce the asset cost/extent or revise the project-specific policy.',
        );
    }
    const list = [...findings.values()];
    return {
      schemaVersion: 1,
      kind: 'quality-report',
      scope: 'visible',
      passed: !list.some((f) => f.severity === 'error'),
      policy,
      metrics,
      findings: list,
      summary: {
        errors: list.filter((f) => f.severity === 'error').length,
        warnings: list.filter((f) => f.severity === 'warning').length,
      },
      limitations: [
        'Not a manifold, collision, UV-overlap or native application import check.',
        'geometryBytes counts unique attribute/index buffers, not GPU memory or export file size.',
      ],
    };
  } finally {
    built.dispose();
  }
}
