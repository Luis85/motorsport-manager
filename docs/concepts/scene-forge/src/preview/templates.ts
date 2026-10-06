import * as THREE from 'three';
import { createLight } from '../application/lights.js';
import { scalar } from '../domain/scalar.js';
import type { SceneDocument, NodeSpec, ScalarValue } from '../domain/schema.js';
import type { LibraryItem } from './contracts.js';

/** Rebuild only authored placement using compiled prototypes and their shared resources. */
export function createTemplates(source: SceneDocument, content: THREE.Group, items: LibraryItem[]) {
  const loader = new THREE.ObjectLoader();
  const templates = new Map<string, THREE.Object3D>();
  const library = new Map<string, LibraryItem & { prototype: THREE.Object3D }>(
    items.map((item) => [item.id, { ...item, prototype: loader.parse(item.object) }]),
  );
  const authoredPaths = new Set(source.nodes.map((n) => `${source.id}/${n.id}`));
  for (const node of source.nodes) {
    const object = content.getObjectByName(`${source.id}/${node.id}`)!;
    const copy = object.clone(true);
    const remove: THREE.Object3D[] = [];
    copy.traverse((child) => {
      if (child !== copy && authoredPaths.has(child.name)) remove.push(child);
    });
    remove.forEach((child) => child.removeFromParent());
    templates.set(node.id, copy);
  }
  function remapTemplate(object: THREE.Object3D, id: string) {
    const old = object.name;
    object.traverse((child) => {
      if (child.name.startsWith(old))
        child.name = `${source.id}/${id}` + child.name.slice(old.length);
      if (Array.isArray(child.userData.materialSlots))
        child.userData.materialSlots = child.userData.materialSlots.map((slot: string) =>
          slot.startsWith(old + '/') ? `${source.id}/${id}` + slot.slice(old.length) : slot,
        );
      if (child.userData.forgePath?.startsWith(old))
        child.userData.forgePath =
          `${source.id}/${id}` + child.userData.forgePath.slice(old.length);
    });
    object.name = `${source.id}/${id}`;
    object.userData = { ...object.userData, forgeId: id, forgePath: object.name };
    return object;
  }
  function instantiate(node: NodeSpec) {
    let template = node.type === 'light' ? createLight(node) : templates.get(node.id);
    if (!template) {
      if (node.type !== 'model' || !library.has(node.model))
        throw new Error(`Cannot rebuild ${node.id}: model template is missing.`);
      template = remapTemplate(library.get(node.model)!.prototype.clone(true), node.id);
      templates.set(node.id, template);
    }
    const object = template.clone(true);
    object.name = `${source.id}/${node.id}`;
    object.userData = {
      ...object.userData,
      forgeId: node.id,
      forgePath: object.name,
      label: node.name ?? node.id,
      type: node.type,
      tags: node.tags,
    };
    if (node.type === 'model') {
      const targets = node.pattern ? object.children : [object];
      for (const target of targets) {
        delete target.userData.rig;
        if (node.rig) target.userData.rig = structuredClone(node.rig);
      }
    }
    object.visible = node.visible;
    const number = (v: ScalarValue) => scalar(v, source.parameters);
    const t = node.transform ?? {};
    object.position.fromArray((t.position ?? [0, 0, 0]).map(number));
    object.rotation.set(
      ...((t.rotation ?? [0, 0, 0]).map((v) => (number(v) * Math.PI) / 180) as [
        number,
        number,
        number,
      ]),
    );
    object.scale.fromArray((t.scale ?? [1, 1, 1]).map(number));
    return object;
  }

  return { templates, library, remapTemplate, instantiate };
}
