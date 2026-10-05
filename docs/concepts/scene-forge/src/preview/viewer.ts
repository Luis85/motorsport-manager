import { createRigOverlay } from './rig-overlay.js';
import { createRealization } from './realization.js';
import { mountEditorTools } from './tool-host.js';
import { editorContext } from './tool-bridge.js';
import { editorTools } from './tools/index.js';
import { selectPreview, setupProjectControls, download } from './project-controls.js';
import { setupOutputButtons } from './output-buttons.js';
import { $, field, button } from './dom.js';
import { clean, transformData } from './transforms.js';
import { createPanels } from './panels.js';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { fitCamera, cameraData } from '../application/camera.js';
import type { CameraRequest } from '../domain/schema.js';
import { errorMessage } from '../domain/errors.js';
import { createTemplates } from './templates.js';
import { createViewport, boundsOf as visibleBounds } from './viewport.js';
import {
  createEditHistory,
  transactEdit,
  sceneEdits,
  validTransforms as validNodeTransforms,
  type EditState,
} from './edit-state.js';
import type { SceneDocument, NodeSpec } from '../domain/schema.js';

const payload = selectPreview(window.__FORGE__, new URLSearchParams(location.search).get('scene'));
const captureMode = new URLSearchParams(location.search).has('capture');
if (captureMode) document.body.classList.add('capture');

async function boot() {
  const source: SceneDocument = structuredClone(payload.document);
  const initial: SceneDocument = structuredClone(source);
  const editable = payload.editable !== false;
  const scene = new THREE.ObjectLoader().parse(payload.scene) as THREE.Scene;
  let content = scene.children[0] as THREE.Group;
  const stage = $('stage');
  const viewport = createViewport(scene, source, stage);
  const { renderer } = viewport;
  const { templates, library, remapTemplate, instantiate } = createTemplates(
    source,
    content,
    payload.library,
  );
  const helpers = new THREE.Group();
  scene.add(helpers);
  const rigOverlay = createRigOverlay(helpers);
  let grid: THREE.GridHelper;
  let camera: THREE.PerspectiveCamera | THREE.OrthographicCamera;
  let controls: OrbitControls;
  let gizmo: TransformControls;
  let selectedId: string | undefined;
  let selection: THREE.BoxHelper | undefined;
  let view = 'iso',
    mode = 'select',
    wireframe = false,
    gridVisible = true;
  let tab = 'scene';
  let dragBefore: NodeSpec[] | undefined,
    wasDragging = false;
  const history = createEditHistory();
  const realization = createRealization(source);
  let toolHost: ReturnType<typeof mountEditorTools> | undefined;
  let lastDownloaded = '';
  let toastTimer: ReturnType<typeof setTimeout>;
  const currentNode = () => source.nodes.find((n) => n.id === selectedId);
  const objectFor = (id: string) => content.getObjectByName(`${source.id}/${id}`);
  const { updateInspector, renderTree, renderModels } = createPanels({
    source,
    library,
    editable,
    selectedId: () => selectedId,
    objectFor,
    select,
    addModel,
  });
  function toast(message: string, error = false) {
    clearTimeout(toastTimer);
    $('toast').textContent = message;
    $('toast').classList.toggle('error', error);
    $('toast').hidden = false;
    toastTimer = setTimeout(
      () => {
        $('toast').hidden = true;
      },
      error ? 7000 : 4500,
    );
  }
  function draw() {
    if (camera) {
      scene.updateMatrixWorld(true);
      selection?.update();
      renderer.render(scene, camera);
    }
  }
  const boundsOf = (object: THREE.Object3D = content) => visibleBounds(object);
  function lighting() {
    grid = viewport.lighting(content, gridVisible);
  }
  function attach() {
    if (!gizmo) return;
    gizmo.detach();
    const object = selectedId ? objectFor(selectedId) : undefined;
    if (editable && object && mode !== 'select' && object.visible) {
      gizmo.setMode(mode as 'translate');
      gizmo.attach(object);
    }
    draw();
  }
  function setMode(next: string) {
    mode = next;
    document
      .querySelectorAll<HTMLButtonElement>('[data-mode]')
      .forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
    attach();
  }
  function setupGizmo() {
    if (gizmo) {
      scene.remove(gizmo.getHelper());
      gizmo.dispose();
    }
    gizmo = new TransformControls(camera, renderer.domElement);
    gizmo.setSpace('local');
    gizmo.setSize(0.85);
    scene.add(gizmo.getHelper());
    if (field('snap').checked) {
      gizmo.setTranslationSnap(0.25);
      gizmo.setRotationSnap(Math.PI / 12);
      gizmo.setScaleSnap(0.1);
    }
    gizmo.addEventListener('dragging-changed', (event) => {
      controls.enabled = !event.value;
    });
    gizmo.addEventListener('mouseDown', () => {
      dragBefore = structuredClone(source.nodes);
      wasDragging = true;
    });
    gizmo.addEventListener('objectChange', () => {
      const node = currentNode();
      const object = selectedId ? objectFor(selectedId) : undefined;
      if (node && object) {
        node.transform = transformData(object);
        updateInspector();
        updateState();
        draw();
      }
    });
    gizmo.addEventListener('mouseUp', () => {
      if (dragBefore) {
        if (validTransforms()) {
          pushUndo(dragBefore);
          updateState();
          lighting();
        } else {
          source.nodes = dragBefore;
          rebuild();
          toast('Scale must stay nonzero and transform values must be finite.', true);
        }
        dragBefore = undefined;
      }
      setTimeout(() => (wasDragging = false), 0);
    });
    gizmo.addEventListener('change', draw);
    attach();
  }
  function fit(nextView = 'iso', selectionOnly = false, overrides: Partial<CameraRequest> = {}) {
    view = nextView;
    const object = selectionOnly && selectedId ? objectFor(selectedId) : undefined;
    const request: CameraRequest = {
      view: nextView as CameraRequest['view'],
      projection: 'auto',
      azimuth: 45,
      elevation: 30,
      padding: 1.12,
      fov: 40,
      ...overrides,
    };
    const fitted = fitCamera(
      boundsOf(object),
      stage.clientWidth / Math.max(stage.clientHeight, 1),
      request,
      source.camera,
    );
    controls?.dispose();
    camera = fitted.camera;
    const target = fitted.target;
    controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(target);
    controls.addEventListener('change', draw);
    controls.update();
    setupGizmo();
    document
      .querySelectorAll<HTMLButtonElement>('[data-view]')
      .forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === nextView)));
    $('view-label').textContent =
      nextView === 'iso'
        ? 'Perspective'
        : nextView === 'authored'
          ? 'Saved camera'
          : nextView[0].toUpperCase() + nextView.slice(1);
    draw();
  }
  function resize() {
    renderer.setSize(stage.clientWidth, stage.clientHeight);
    if (!camera) return;
    const aspect = stage.clientWidth / Math.max(stage.clientHeight, 1);
    if (camera instanceof THREE.PerspectiveCamera) camera.aspect = aspect;
    else {
      const half = (camera.top - camera.bottom) / 2;
      camera.left = -half * aspect;
      camera.right = half * aspect;
    }
    camera.updateProjectionMatrix();
    draw();
  }
  function descendants(id: string) {
    const ids = new Set([id]);
    let changed = true;
    while (changed) {
      changed = false;
      source.nodes.forEach((n) => {
        if (n.parent && ids.has(n.parent) && !ids.has(n.id)) {
          ids.add(n.id);
          changed = true;
        }
      });
    }
    return ids;
  }
  function rebuild() {
    gizmo?.detach();
    if (selection) {
      helpers.remove(selection);
      selection.geometry.dispose();
      (selection.material as THREE.Material).dispose();
      selection = undefined;
    }
    const next = new THREE.Group();
    next.name = source.id;
    const objects = new Map(source.nodes.map((node) => [node.id, instantiate(node)]));
    for (const node of source.nodes)
      (node.parent ? objects.get(node.parent)! : next).add(objects.get(node.id)!);
    realization.apply(next);
    scene.remove(content);
    content = next;
    scene.add(content);
    setWireframe(wireframe);
    lighting();
    renderTree();
    select(selectedId);
    updateState();
    draw();
  }
  const readEditState = (): EditState => ({
    nodes: source.nodes,
    materials: source.materials,
    environment: source.environment,
    selectedId,
  });
  const restoreEditState = (state: EditState) => {
    source.nodes = state.nodes;
    if (state.materials) source.materials = state.materials;
    if (state.environment) source.environment = state.environment;
    selectedId = state.selectedId;
  };
  const validTransforms = () => validNodeTransforms(source.nodes);
  function pushUndo(before: NodeSpec[], selectionBefore = selectedId) {
    history.commit(
      { ...readEditState(), nodes: before, selectedId: selectionBefore },
      readEditState(),
    );
  }
  function change(action: () => void) {
    if (!editable) return false;
    try {
      transactEdit(history, readEditState, restoreEditState, action, rebuild);
      updateState();
      return true;
    } catch (error) {
      toast(errorMessage(error), true);
      return false;
    }
  }
  function travel(direction: 'undo' | 'redo') {
    try {
      history.travel(direction, readEditState(), (state) => {
        restoreEditState(state);
        rebuild();
      });
      updateState();
    } catch (error) {
      toast(errorMessage(error), true);
    }
  }
  const edits = () => sceneEdits(initial, source, payload.stateHash);
  function updateState() {
    const count = edits().operations.length;
    button('save-edits').disabled = !editable || count === 0;
    button('undo').disabled = !history.canUndo;
    button('redo').disabled = !history.canRedo;
    $('edit-state').textContent = count
      ? `${count} local edit${count === 1 ? '' : 's'}`
      : editable
        ? 'Saved scene'
        : 'Model preview';
    $('source').textContent = JSON.stringify(source, null, 2);
    let meshes = 0,
      triangles = 0;
    content.traverseVisible((o) => {
      if (o instanceof THREE.Mesh) {
        meshes++;
        triangles += (o.geometry.index?.count ?? o.geometry.getAttribute('position').count) / 3;
      }
    });
    $('stats').textContent =
      `${source.nodes.length} objects · ${meshes} meshes · ${triangles.toLocaleString()} triangles`;
    const box = boundsOf();
    $('bounds').textContent =
      (box.isEmpty() ? [0, 0, 0] : box.getSize(new THREE.Vector3()).toArray())
        .map((v) => v.toFixed(2))
        .join(' × ') + ' m';
    $('node-count').textContent = String(source.nodes.length);
  }
  function select(id?: string) {
    if (selection) {
      helpers.remove(selection);
      selection.geometry.dispose();
      (selection.material as THREE.Material).dispose();
      selection = undefined;
    }
    selectedId = source.nodes.some((n) => n.id === id) ? id : undefined;
    const object = selectedId ? objectFor(selectedId) : undefined;
    if (object && object.visible && !boundsOf(object).isEmpty()) {
      selection = new THREE.BoxHelper(object, '#ffbb73');
      helpers.add(selection);
    }
    document
      .querySelectorAll<HTMLButtonElement>('.object')
      .forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === selectedId)));
    updateInspector();
    toolHost?.refresh();
    attach();
    draw();
  }
  function switchTab(next: string) {
    tab = next;
    button('scene-tab').tabIndex = next === 'scene' ? 0 : -1;
    button('models-tab').tabIndex = next === 'models' ? 0 : -1;
    $('scene-list').hidden = next !== 'scene';
    $('model-list').hidden = next !== 'models';
    $('scene-tab').setAttribute('aria-selected', String(next === 'scene'));
    $('models-tab').setAttribute('aria-selected', String(next === 'models'));
    $('filter-label').textContent = next === 'scene' ? 'Find an object' : 'Find a model';
    field('filter').value = '';
    renderTree();
    renderModels();
  }
  function availableId(stem: string) {
    const prefix = stem.slice(0, 50);
    if (!templates.has(prefix) && !source.nodes.some((n) => n.id === prefix)) return prefix;
    let i = 2;
    while (templates.has(`${prefix}_${i}`) || source.nodes.some((n) => n.id === `${prefix}_${i}`))
      i++;
    return `${prefix}_${i}`;
  }
  function addModel(id: string) {
    const item = library.get(id);
    if (!item) throw new Error(`Unknown model ${id}`);
    const newId = availableId(id);
    const changed = change(() => {
      source.nodes.push({
        type: 'model',
        id: newId,
        name: item.name,
        model: id,
        parameters: {},
        materialOverrides: {},
        tags: [],
        visible: true,
        transform: { position: [0, -item.stats.bounds.min[1], 0] },
      });
      selectedId = newId;
    });
    if (!changed) return '';
    setMode('translate');
    toast(`Added ${item.name}. Move it with the handles or position fields.`);
    return newId;
  }
  function duplicate() {
    if (!selectedId) return;
    const root = selectedId;
    const ids = descendants(root);
    const newId = availableId(root);
    const map = new Map(
      [...ids].map((id) => [id, id === root ? newId : `${newId.slice(0, 28)}--${id.slice(-32)}`]),
    );
    if (
      new Set(map.values()).size !== map.size ||
      [...map.values()].some((id) => source.nodes.some((n) => n.id === id))
    ) {
      toast(
        'Could not create unique subtree IDs. Duplicate this group through the CLI with a shorter ID.',
        true,
      );
      return;
    }
    const changed = change(() => {
      const copies = source.nodes
        .filter((n) => ids.has(n.id))
        .map((n) => {
          const copy = structuredClone(n);
          copy.id = map.get(n.id)!;
          if (copy.parent && map.has(copy.parent)) copy.parent = map.get(copy.parent);
          const template = templates.get(n.id);
          if (template) templates.set(copy.id, remapTemplate(template.clone(true), copy.id));
          return copy;
        });
      const copiedRoot = copies.find((n) => n.id === newId)!;
      const transform = transformData(objectFor(root)!);
      transform.position[0] += 1;
      copiedRoot.transform = transform;
      source.nodes.push(...copies);
      selectedId = newId;
    });
    if (changed) toast('Duplicated selection.');
  }
  function ground() {
    if (!selectedId) return;
    const id = selectedId;
    change(() => {
      const object = objectFor(id)!;
      const box = new THREE.Box3().setFromObject(object);
      if (box.isEmpty()) throw new Error('This group has no geometry.');
      const position = object.getWorldPosition(new THREE.Vector3());
      position.y -= box.min.y;
      object.parent?.worldToLocal(position);
      const node = source.nodes.find((n) => n.id === id)!;
      node.transform = {
        ...node.transform,
        position: position.toArray().map(clean) as [number, number, number],
      };
    });
  }
  function remove() {
    if (!selectedId) return;
    const ids = descendants(selectedId);
    const changed = change(() => {
      source.nodes = source.nodes.filter((n) => !ids.has(n.id));
      selectedId = undefined;
    });
    if (changed) toast('Removed selection. Undo is available.');
  }
  function setWireframe(enabled: boolean) {
    wireframe = enabled;
    content.traverse((o) => {
      if (o instanceof THREE.Mesh)
        (Array.isArray(o.material) ? o.material : [o.material]).forEach(
          (m) => ((m as THREE.MeshStandardMaterial).wireframe = enabled),
        );
    });
    button('wireframe').setAttribute('aria-pressed', String(enabled));
    draw();
  }
  button('save-edits').addEventListener('click', () => {
    const batch = edits();
    if (!batch.operations.length) return;
    download(
      new Blob([JSON.stringify(batch, null, 2) + '\n'], { type: 'application/json' }),
      `${source.id}.edits.json`,
    );
    lastDownloaded = JSON.stringify(source);
    toast(
      `Edits downloaded. Apply to the project with:\nforge3d apply --file ${source.id}.edits.json`,
    );
  });
  setupOutputButtons({
    source,
    content: () => content,
    helpers,
    gizmo: () => gizmo,
    renderer,
    draw,
    toast,
  });
  button('undo').addEventListener('click', () => travel('undo'));
  button('redo').addEventListener('click', () => travel('redo'));
  button('duplicate').addEventListener('click', duplicate);
  button('ground').addEventListener('click', ground);
  button('remove').addEventListener('click', remove);
  field('node-name').addEventListener('change', () =>
    change(() => {
      const node = currentNode();
      if (node) node.name = field('node-name').value;
    }),
  );
  field('node-visible').addEventListener('change', () =>
    change(() => {
      const node = currentNode();
      if (node) node.visible = field('node-visible').checked;
    }),
  );
  for (const key of ['position', 'rotation', 'scale'] as const)
    for (const axis of ['x', 'y', 'z'])
      field(`${key}-${axis}`).addEventListener('change', () => {
        const values = ['x', 'y', 'z'].map((a) => field(`${key}-${a}`).valueAsNumber) as [
          number,
          number,
          number,
        ];
        change(() => {
          const node = currentNode();
          if (node) node.transform = { ...node.transform, [key]: values };
        });
      });
  $('transform-form').addEventListener('submit', (event) => event.preventDefault());
  button('scene-tab').addEventListener('click', () => switchTab('scene'));
  button('models-tab').addEventListener('click', () => switchTab('models'));
  button('browse-models').addEventListener('click', () => switchTab('models'));
  for (const id of ['scene-tab', 'models-tab'])
    button(id).addEventListener('keydown', (event) => {
      if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key) && editable) {
        event.preventDefault();
        const next =
          event.key === 'Home'
            ? 'scene'
            : event.key === 'End'
              ? 'models'
              : tab === 'scene'
                ? 'models'
                : 'scene';
        switchTab(next);
        button(next === 'scene' ? 'scene-tab' : 'models-tab').focus();
      }
    });
  button('models-tab').tabIndex = -1;
  field('filter').addEventListener('input', () =>
    tab === 'scene' ? renderTree() : renderModels(),
  );
  document.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((b) => {
    b.disabled = !editable && b.dataset.mode !== 'select';
    b.addEventListener('click', () => setMode(b.dataset.mode!));
  });
  document
    .querySelectorAll<HTMLButtonElement>('[data-view]')
    .forEach((b) => b.addEventListener('click', () => fit(b.dataset.view)));
  button('fit').addEventListener('click', () => fit(view, true));
  button('fit-all').addEventListener('click', () => fit('iso'));
  field('snap').addEventListener('change', () => {
    const on = field('snap').checked;
    gizmo.setTranslationSnap(on ? 0.25 : null);
    gizmo.setRotationSnap(on ? Math.PI / 12 : null);
    gizmo.setScaleSnap(on ? 0.1 : null);
  });
  button('grid').addEventListener('click', () => {
    gridVisible = !gridVisible;
    grid.visible = gridVisible;
    button('grid').setAttribute('aria-pressed', String(gridVisible));
    draw();
  });
  button('wireframe').addEventListener('click', () => setWireframe(!wireframe));
  button('recipe').addEventListener('click', () => {
    $('source-title').textContent = 'Current scene recipe';
    $('source-panel').hidden = !$('source-panel').hidden;
    button('recipe').setAttribute('aria-expanded', String(!$('source-panel').hidden));
  });
  button('close-source').addEventListener('click', () => {
    $('source-panel').hidden = true;
    button('recipe').setAttribute('aria-expanded', 'false');
    button('recipe').focus();
  });
  function currentReviewPlan() {
    const ratio = Math.min(1, 2048 / stage.clientWidth, 2048 / stage.clientHeight);
    const width = Math.max(64, Math.round(stage.clientWidth * ratio));
    const height = Math.max(64, Math.round(stage.clientHeight * ratio));
    const fixed = cameraData(camera, controls.target);
    if (fixed.projection === 'perspective') fixed.aspect = width / height;
    return {
      schemaVersion: 1,
      kind: 'review',
      width,
      height,
      grid: gridVisible,
      wireframe,
      contactSheet: false,
      background: source.environment.background,
      frames: [{ id: 'saved-view', camera: { fixed } }],
    };
  }
  button('save-review').addEventListener('click', () => {
    download(
      new Blob([JSON.stringify(currentReviewPlan(), null, 2)], { type: 'application/json' }),
      `${source.id}.review.json`,
    );
    toast('View saved. Review the project with this plan after applying any scene edits.');
  });
  button('copy-camera').addEventListener('click', async () => {
    const data = JSON.stringify(currentReviewPlan(), null, 2);
    try {
      await navigator.clipboard.writeText(data);
      toast('Exact camera and review settings copied.');
    } catch {
      $('source-title').textContent = 'Review plan';
      $('source').textContent = data;
      $('source-panel').hidden = false;
      button('recipe').setAttribute('aria-expanded', 'true');
      toast('Copy the review plan from the source panel, or use Save review plan.');
    }
  });
  const raycaster = new THREE.Raycaster();
  let down = { x: 0, y: 0 };
  renderer.domElement.addEventListener(
    'pointerdown',
    (e) => (down = { x: e.clientX, y: e.clientY }),
  );
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (e.button !== 0 || wasDragging || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 4)
      return;
    const rect = renderer.domElement.getBoundingClientRect();
    raycaster.setFromCamera(
      new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        (-(e.clientY - rect.top) / rect.height) * 2 + 1,
      ),
      camera,
    );
    const hit = raycaster.intersectObject(content, true).find((hit) => {
      let p: THREE.Object3D | null = hit.object;
      while (p) {
        if (!p.visible) return false;
        p = p.parent;
      }
      return true;
    });
    let object = hit?.object;
    let id: string | undefined;
    while (object && object !== content) {
      const node = source.nodes.find((n) => object!.name === `${source.id}/${n.id}`);
      if (node) {
        id = node.id;
        break;
      }
      object = object.parent ?? undefined;
    }
    select(id);
  });
  document.addEventListener('keydown', (event) => {
    if ((event.target as HTMLElement).matches('input,textarea,select')) return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      travel(event.shiftKey ? 'redo' : 'undo');
      return;
    }
    if (event.key === 'Escape') {
      select();
      setMode('select');
      $('source-panel').hidden = true;
      button('recipe').setAttribute('aria-expanded', 'false');
      return;
    }
    if (event.key.toLowerCase() === 'f') {
      event.preventDefault();
      fit(view, !event.shiftKey);
    }
    if (editable && ['q', 'w', 'e', 'r'].includes(event.key.toLowerCase()))
      setMode(
        ({ q: 'select', w: 'translate', e: 'rotate', r: 'scale' } as Record<string, string>)[
          event.key.toLowerCase()
        ],
      );
    if (
      editable &&
      (event.key === 'Delete' || event.key === 'Backspace') &&
      event.target === renderer.domElement
    ) {
      event.preventDefault();
      remove();
    }
  });
  window.addEventListener('beforeunload', (event) => {
    if (edits().operations.length && lastDownloaded !== JSON.stringify(source)) {
      event.preventDefault();
      event.returnValue = '';
    }
  });
  $('scene-name').textContent = source.name;
  $('scene-meta').textContent = `${source.id} · revision ${source.revision} · meters`;
  $('model-count').textContent = String(library.size);
  if (payload.stats.warnings.length) {
    $('warning-panel').hidden = false;
    $('warning-summary').textContent = `${payload.stats.warnings.length} build notes`;
    $('warnings').textContent = payload.stats.warnings.join(' ');
  }
  if (!editable) {
    button('save-edits').hidden = true;
    $('edit-state').textContent = 'Model preview';
    button('models-tab').disabled = true;
    button('browse-models').hidden = true;
  }
  setupProjectControls(payload, source, () => {
    lastDownloaded = JSON.stringify(source);
    toast('Portable scene recipe downloaded, including models and local edits.');
  });
  toolHost = mountEditorTools(
    $('editor-tools'),
    editorContext({
      source,
      models: payload.models,
      editable,
      selectedId: () => selectedId,
      objectFor,
      change,
      select,
      availableId,
      notify: toast,
      showJoints: (visible) => {
        rigOverlay.show(visible && selectedId ? objectFor(selectedId) : undefined);
        draw();
      },
      previewAnimation: (node, clip, time) => {
        realization.animate(content, node, clip, time);
        draw();
      },
    }),
    editorTools,
  );
  window.addEventListener(
    'pagehide',
    () => {
      toolHost?.dispose();
      realization.dispose();
    },
    { once: true },
  );
  realization.apply(content);
  toolHost.refresh();
  renderer.setSize(stage.clientWidth, stage.clientHeight);
  lighting();
  fit(source.camera ? 'authored' : 'iso');
  new ResizeObserver(resize).observe(stage);
  renderTree();
  renderModels();
  updateState();
  updateInspector();
  window.forgeViewer = {
    setView: (v: string) => fit(v),
    setGrid: (visible: boolean) => {
      gridVisible = visible;
      grid.visible = visible;
      button('grid').setAttribute('aria-pressed', String(visible));
      draw();
    },
    clearSelection: () => {
      select();
      setMode('select');
    },
    render: draw,
    getCamera: () => cameraData(camera, controls.target),
    configureCapture: (request: CameraRequest, wireframe: boolean) => {
      fit(request.view, false, request);
      setWireframe(wireframe);
    },
    stats: payload.stats,
    getSource: () => structuredClone(source),
    getEdits: edits,
    select,
    addModel,
    undo: () => travel('undo'),
    redo: () => travel('redo'),
  };
  $('loading').hidden = true;
  draw();
  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => {
      draw();
      resolve();
    }),
  );
  window.forgeReady = true;
}
boot().catch((error) => {
  window.forgeError = String(error);
  $('loading').hidden = false;
  $('loading').textContent =
    `Preview could not start: ${errorMessage(error)}. Check WebGL 2 support, or regenerate the HTML with forge3d preview.`;
});
