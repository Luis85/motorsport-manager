// Offline composer entry point. Boots the compiled scene payload and owns the editor's
// live state: scene content, selection, the transactional edit/undo port and the
// rebuild that realizes edited nodes. Camera, gizmo, picking, panels, commands,
// shortcuts, status and output hand-offs are separate modules wired together here;
// `window.forgeViewer` is the automation contract used by capture and review.
import { createRigOverlay } from './rig-overlay.js';
import { createRealization } from './realization.js';
import { mountEditorTools } from './tool-host.js';
import { editorContext } from './tool-bridge.js';
import { editorTools } from './tools/index.js';
import { selectPreview, setupProjectControls } from './project-controls.js';
import { setupOutputButtons } from './output-buttons.js';
import { $, button } from './dom.js';
import { transformData } from './transforms.js';
import { createPanels } from './panels.js';
import * as THREE from 'three';
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
import { createToast } from './toast.js';
import { createCameraRig } from './camera-rig.js';
import { createTransformGizmo } from './transform-gizmo.js';
import { createDisplayOptions } from './display-options.js';
import { createNodeCommands } from './node-commands.js';
import { renderEditStatus, renderSceneHeader } from './edit-status.js';
import { bindInspectorFields } from './inspector-fields.js';
import { setupPanelTabs } from './panel-tabs.js';
import { setupSourcePanel } from './source-panel.js';
import { reviewPlanFor, setupReviewButtons } from './review-plan.js';
import { setupPicking } from './picking.js';
import { setupShortcuts } from './shortcuts.js';
import { setupEditDownload } from './edit-download.js';

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
  let selectedId: string | undefined;
  let selection: THREE.BoxHelper | undefined;
  let dragBefore: NodeSpec[] | undefined,
    wasDragging = false;
  const history = createEditHistory();
  const realization = createRealization(source);
  let toolHost: ReturnType<typeof mountEditorTools> | undefined;
  const toast = createToast();
  const currentNode = () => source.nodes.find((n) => n.id === selectedId);
  const objectFor = (id: string) => content.getObjectByName(`${source.id}/${id}`);
  const selectedObject = () => (selectedId ? objectFor(selectedId) : undefined);
  const boundsOf = (object: THREE.Object3D = content) => visibleBounds(object);
  const display = createDisplayOptions({ content: () => content, grid: () => grid, draw });
  const gizmo = createTransformGizmo({
    scene,
    renderer,
    editable,
    controls: () => rig.controls(),
    selectedObject,
    draw,
    onDragStart: () => {
      dragBefore = structuredClone(source.nodes);
      wasDragging = true;
    },
    onObjectChange: () => {
      const node = currentNode();
      const object = selectedObject();
      if (node && object) {
        node.transform = transformData(object);
        updateInspector();
        updateState();
        draw();
      }
    },
    onDragEnd: () => {
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
    },
  });
  const rig = createCameraRig({
    stage,
    renderer,
    source,
    bounds: (object) => boundsOf(object),
    selectedObject,
    draw,
    onCamera: gizmo.setup,
  });
  const commands = createNodeCommands({
    source,
    templates,
    library,
    remapTemplate,
    objectFor,
    change,
    selectedId: () => selectedId,
    setSelectedId: (id) => (selectedId = id),
    setMode: gizmo.setMode,
    toast,
  });
  const { updateInspector, renderTree, renderModels } = createPanels({
    source,
    library,
    editable,
    selectedId: () => selectedId,
    objectFor,
    select,
    addModel: commands.addModel,
  });
  function draw() {
    const camera = rig.camera();
    if (camera) {
      scene.updateMatrixWorld(true);
      selection?.update();
      renderer.render(scene, camera);
    }
  }
  function lighting() {
    grid = viewport.lighting(content, display.gridVisible());
  }
  function rebuild() {
    gizmo.detach();
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
    display.setWireframe(display.wireframe());
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
    renderEditStatus({
      source,
      content,
      editable,
      editCount: edits().operations.length,
      canUndo: history.canUndo,
      canRedo: history.canRedo,
      bounds: () => boundsOf(),
    });
  }
  function select(id?: string) {
    if (selection) {
      helpers.remove(selection);
      selection.geometry.dispose();
      (selection.material as THREE.Material).dispose();
      selection = undefined;
    }
    selectedId = source.nodes.some((n) => n.id === id) ? id : undefined;
    const object = selectedObject();
    if (object && object.visible && !boundsOf(object).isEmpty()) {
      selection = new THREE.BoxHelper(object, '#ffbb73');
      helpers.add(selection);
    }
    document
      .querySelectorAll<HTMLButtonElement>('.object')
      .forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === selectedId)));
    updateInspector();
    toolHost?.refresh();
    gizmo.attach();
    draw();
  }
  const clearSelection = () => {
    select();
    gizmo.setMode('select');
  };
  const handoff = setupEditDownload({ source, edits, toast });
  setupOutputButtons({
    source,
    content: () => content,
    helpers,
    gizmo: gizmo.current,
    renderer,
    draw,
    toast,
  });
  button('undo').addEventListener('click', () => travel('undo'));
  button('redo').addEventListener('click', () => travel('redo'));
  button('duplicate').addEventListener('click', commands.duplicate);
  button('ground').addEventListener('click', commands.ground);
  button('remove').addEventListener('click', commands.remove);
  bindInspectorFields({ currentNode, change });
  setupPanelTabs({ editable, renderTree, renderModels });
  document
    .querySelectorAll<HTMLButtonElement>('[data-view]')
    .forEach((b) => b.addEventListener('click', () => rig.fit(b.dataset.view)));
  button('fit').addEventListener('click', () => rig.fit(rig.view(), true));
  button('fit-all').addEventListener('click', () => rig.fit('iso'));
  setupSourcePanel();
  setupReviewButtons({
    source,
    plan: () =>
      reviewPlanFor(stage, rig.camera(), rig.controls().target, {
        grid: display.gridVisible(),
        wireframe: display.wireframe(),
        background: source.environment.background,
      }),
    toast,
  });
  setupPicking({
    canvas: renderer.domElement,
    camera: rig.camera,
    content: () => content,
    source,
    dragging: () => wasDragging,
    select,
  });
  setupShortcuts({
    editable,
    canvas: renderer.domElement,
    travel,
    clearSelection,
    frame: (selectionOnly) => rig.fit(rig.view(), selectionOnly),
    setMode: gizmo.setMode,
    remove: commands.remove,
  });
  renderSceneHeader({
    source,
    modelCount: library.size,
    warnings: payload.stats.warnings,
    editable,
  });
  setupProjectControls(payload, source, () => {
    handoff.markDownloaded();
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
      availableId: commands.availableId,
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
  rig.fit(source.camera ? 'authored' : 'iso');
  new ResizeObserver(rig.resize).observe(stage);
  renderTree();
  renderModels();
  updateState();
  updateInspector();
  window.forgeViewer = {
    setView: (v: string) => rig.fit(v),
    setGrid: display.setGrid,
    clearSelection,
    render: draw,
    getCamera: rig.snapshot,
    configureCapture: (request: CameraRequest, wireframe: boolean) => {
      rig.fit(request.view, false, request);
      display.setWireframe(wireframe);
    },
    stats: payload.stats,
    getSource: () => structuredClone(source),
    getEdits: edits,
    select,
    addModel: commands.addModel,
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
