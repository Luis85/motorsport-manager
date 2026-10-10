/// <reference path="./gltf-validator.d.ts" />
import { gltfScene } from '../application/gltf-scene.js';
import { rigClips } from '../application/rigging.js';
import { installTextureExport } from './export-textures.js';
import { installBlobReader } from './blob-reader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { OBJExporter } from 'three/addons/exporters/OBJExporter.js';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';
import { Box3, Vector3, Mesh, type Material } from 'three';
import { compileScene } from '../application/compiler.js';
import { authoringTarget } from '../application/target.js';
import { fail, type SceneDocument, type ModelLibrary } from '../domain/schema.js';

export const exportFormats = ['glb', 'gltf', 'obj', 'stl', 'three'] as const;
export type ExportFormat = (typeof exportFormats)[number];
/** Official Khronos validation. No external resources are fetched. */
export async function validateExport(data: Uint8Array | string, format: ExportFormat) {
  if (format !== 'glb' && format !== 'gltf')
    fail('INVALID_OPTION', 'Export validation is available for glb and gltf only.');
  const { validateBytes } = await import('gltf-validator');
  const report = await validateBytes(typeof data === 'string' ? Buffer.from(data) : data, {
    maxIssues: 100,
  });
  return { validator: 'Khronos glTF-Validator', ...report.issues };
}
export async function exportScene(
  document: SceneDocument,
  models: ModelLibrary,
  format: ExportFormat,
  nodeId?: string,
) {
  if (nodeId) document = authoringTarget(document, models, { node: nodeId });
  const built = compileScene(document, models);
  try {
    // Apply the same visibility policy for every exporter, including OBJ and STL.
    const hidden: import('three').Object3D[] = [];
    built.scene.traverse((object) => {
      if (!object.visible) hidden.push(object);
    });
    if (
      nodeId &&
      hidden.some(
        (object) =>
          object.name === `${document.id}/${nodeId}` ||
          object.getObjectByName(`${document.id}/${nodeId}`),
      )
    )
      fail('NODE_HIDDEN', `Node ${nodeId} is hidden by itself or an ancestor.`);
    hidden.forEach((object) => object.removeFromParent());
    const bounds = new Box3().setFromObject(built.scene);
    const usedMaterials = new Set<Material>();
    const usedGeometries = new Set<import('three').BufferGeometry>();
    let nodes = 0,
      meshes = 0,
      triangles = 0;
    built.scene.traverse((object) => {
      if (object.userData.forgeId) nodes++;
      if (object instanceof Mesh) {
        usedGeometries.add(object.geometry);
        meshes++;
        triangles +=
          (object.geometry.index?.count ?? object.geometry.getAttribute('position').count) / 3;
        (Array.isArray(object.material) ? object.material : [object.material]).forEach((m) =>
          usedMaterials.add(m),
        );
      }
    });
    const stats = {
      ...built.stats,
      nodes,
      meshes,
      triangles,
      materials: usedMaterials.size,
      geometries: usedGeometries.size,
      bounds: {
        min: bounds.isEmpty() ? [0, 0, 0] : bounds.min.toArray(),
        max: bounds.isEmpty() ? [0, 0, 0] : bounds.max.toArray(),
        size: bounds.isEmpty() ? [0, 0, 0] : bounds.getSize(new Vector3()).toArray(),
      },
    };
    let data: Uint8Array | string;
    const warnings = [...built.stats.warnings];
    if (format === 'glb' || format === 'gltf') {
      installBlobReader();
      const portable = gltfScene(built.scene);
      const result = await installTextureExport(new GLTFExporter()).parseAsync(portable, {
        binary: format === 'glb',
        onlyVisible: true,
        trs: false,
        animations: rigClips(portable),
      });
      data =
        format === 'glb'
          ? new Uint8Array(result as ArrayBuffer)
          : JSON.stringify(result, null, 2) + '\n';
    } else if (format === 'obj') {
      data = new OBJExporter().parse(built.scene);
      warnings.push(
        'OBJ export contains geometry, normals and UVs only; materials are not exported. Use GLB to retain PBR materials.',
      );
    } else if (format === 'stl') {
      const view = new STLExporter().parse(built.scene, { binary: true });
      data = new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
      warnings.push(
        'STL stores triangles only: no hierarchy, materials or unit metadata. Coordinates are in meters.',
      );
    } else data = JSON.stringify(built.scene.toJSON(), null, 2) + '\n';
    return { data, stats, warnings };
  } finally {
    built.dispose();
  }
}
