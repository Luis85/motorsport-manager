import * as THREE from 'three';
import type { SceneDocument, NodeSpec } from '../domain/schema.js';
import type { LibraryItem } from './contracts.js';
import { $, field } from './dom.js';
import { clean, transformData } from './transforms.js';

interface PanelContext {
  source: SceneDocument;
  library: ReadonlyMap<string, LibraryItem>;
  editable: boolean;
  selectedId(): string | undefined;
  objectFor(id: string): THREE.Object3D | undefined;
  select(id: string): void;
  addModel(id: string): string;
}
export function createPanels({
  source,
  library,
  editable,
  selectedId,
  objectFor,
  select,
  addModel,
}: PanelContext) {
  const category = $('asset-category') as HTMLSelectElement;
  [...new Set([...library.values()].map((item) => item.category ?? 'Project'))]
    .sort()
    .forEach((value) => category.add(new Option(value, value)));
  category.addEventListener('change', renderModels);
  const collapsed = new Set<string>();
  function updateInspector() {
    const node = source.nodes.find((node) => node.id === selectedId()),
      object = node ? objectFor(node.id) : undefined;
    $('empty-selection').hidden = !!node;
    $('transform-form').hidden = !node;
    $('selection-title').textContent = node?.name ?? node?.id ?? 'Scene composition';
    $('selection-kind').textContent = node
      ? node.type === 'model'
        ? `Model · ${node.model}`
        : node.type
      : '';
    if (!node || !object) {
      $('details').textContent = 'Select an object to inspect its source and dimensions.';
      return;
    }
    field('node-name').value = node.name ?? node.id;
    $('selected-id').textContent = node.id;
    field('node-visible').checked = node.visible;
    const transform = transformData(object);
    for (const key of ['position', 'rotation', 'scale'] as const)
      for (const [i, axis] of ['x', 'y', 'z'].entries())
        field(`${key}-${axis}`).value = String(transform[key][i]);
    const box = new THREE.Box3().setFromObject(object);
    $('details').textContent = JSON.stringify(
      {
        node,
        worldBounds: box.isEmpty()
          ? null
          : { min: box.min.toArray().map(clean), max: box.max.toArray().map(clean) },
      },
      null,
      2,
    );
    $('transform-form')
      .querySelectorAll<HTMLInputElement | HTMLButtonElement>('input,button')
      .forEach((el) => (el.disabled = !editable));
  }
  function renderTree() {
    const list = $('objects');
    list.replaceChildren();
    const query = field('filter').value.toLowerCase();
    const byParent = new Map<string, NodeSpec[]>();
    source.nodes.forEach((n) => {
      const key = n.parent ?? '';
      if (!byParent.has(key)) byParent.set(key, []);
      byParent.get(key)!.push(n);
    });
    const matches = (node: NodeSpec): boolean =>
      `${node.id} ${node.name ?? ''} ${node.type === 'model' ? node.model : ''}`
        .toLowerCase()
        .includes(query) || (byParent.get(node.id) ?? []).some(matches);
    const visit = (parent: string, depth: number) => {
      for (const node of byParent.get(parent) ?? []) {
        if (query && !matches(node)) continue;
        const row = document.createElement('div');
        row.className = 'object-row';
        row.style.paddingLeft = `${Math.min(depth, 6) * 10}px`;
        const children = byParent.get(node.id) ?? [];
        if (children.length) {
          const toggle = document.createElement('button');
          toggle.className = 'toggle';
          toggle.textContent = collapsed.has(node.id) ? '+' : '−';
          toggle.setAttribute(
            'aria-label',
            `${collapsed.has(node.id) ? 'Expand' : 'Collapse'} ${node.name ?? node.id}`,
          );
          toggle.setAttribute('aria-expanded', String(!collapsed.has(node.id)));
          toggle.addEventListener('click', () => {
            if (collapsed.has(node.id)) collapsed.delete(node.id);
            else collapsed.add(node.id);
            renderTree();
          });
          row.append(toggle);
        }
        const b = document.createElement('button');
        b.className = 'object' + (!node.visible ? ' hidden-object' : '');
        b.dataset.id = node.id;
        b.textContent = node.name ?? node.id;
        b.title = node.id;
        b.setAttribute('aria-pressed', String(node.id === selectedId()));
        b.addEventListener('click', () => select(node.id));
        row.append(b);
        list.append(row);
        if (query || !collapsed.has(node.id)) visit(node.id, depth + 1);
      }
    };
    visit('', 0);
    if (!list.childElementCount) {
      const p = document.createElement('p');
      p.className = 'empty-list';
      p.textContent = query
        ? 'No matching objects.'
        : 'This scene is empty. Open Models to add your first instance.';
      list.append(p);
    }
  }
  function renderModels() {
    const list = $('models');
    list.replaceChildren();
    const query = field('filter').value.toLowerCase();
    for (const item of library.values()) {
      if (category.value && (item.category ?? 'Project') !== category.value) continue;
      if (
        !`${item.id} ${item.name} ${item.category ?? ''} ${item.description ?? ''}`
          .toLowerCase()
          .includes(query)
      )
        continue;
      const row = document.createElement('div');
      row.className = 'asset';
      const details = document.createElement('div'),
        name = document.createElement('strong'),
        meta = document.createElement('p');
      name.textContent = item.name;
      name.title = item.description ?? item.name;
      meta.textContent = `${item.category ?? 'Project'} · ${item.stats.meshes} meshes · ${item.stats.triangles.toLocaleString()} triangles`;
      details.append(name, meta);
      const add = document.createElement('button');
      add.textContent = 'Add';
      add.setAttribute('aria-label', `Add ${item.name}`);
      add.disabled = !editable;
      add.addEventListener('click', () => addModel(item.id));
      row.append(details, add);
      list.append(row);
    }
    if (!list.childElementCount) {
      const p = document.createElement('p');
      p.className = 'empty-list';
      p.textContent = library.size
        ? 'No matching models.'
        : 'No models registered. Use model capture or model import, then regenerate the preview.';
      list.append(p);
    }
  }
  return { updateInspector, renderTree, renderModels };
}
