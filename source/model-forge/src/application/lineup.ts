import { Box3, Vector3 } from 'three';
import {
  fail,
  parse,
  canonical,
  fitCamera,
  cameraData,
  compileScene,
  CameraRequestSchema,
  ReviewPlanSchema,
  SceneSchema,
  type ModelLibrary,
  type ReviewPlan,
} from '../kernel/index.js';
import { MAX_REVIEW_FRAMES } from '../domain/generate.js';
import { type EditorDocument, libraryOf, modelTarget } from './document.js';

export interface LineupItem {
  /** Frame and node ID: usually the model ID. */
  id: string;
  document: EditorDocument;
}
export interface LineupOptions {
  width: number;
  height: number;
}

/** Views of a single document: enough sides to judge one generated shape. */
const singleViews = ['iso', 'front', 'right', 'top'];

/**
 * A review scene that holds several documents and one fixed camera per document, rendered in
 * one capture session, framed at one common size so that size differences show. The
 * documents stand along the horizontal iso view direction, spaced
 * so that, from each frame's camera, the following documents are behind the camera and the
 * preceding ones lie beyond its far plane: every frame shows exactly one document. A single
 * document gets fitted iso, front, right and top views instead.
 */
export function lineupReview(items: LineupItem[], options: LineupOptions) {
  if (!items.length) fail('INVALID_OPTION', 'A lineup needs at least one document.');
  if (items.length > MAX_REVIEW_FRAMES)
    fail('INVALID_OPTION', `A review renders at most ${MAX_REVIEW_FRAMES} documents.`, {
      count: items.length,
      hint: `Lower --count to ${MAX_REVIEW_FRAMES}, or review the documents in smaller sets with -d <document> review.`,
    });
  const models: ModelLibrary = {};
  for (const item of items)
    for (const [id, model] of Object.entries(libraryOf(item.document))) {
      if (Object.hasOwn(models, id) && canonical(models[id]) !== canonical(model))
        fail('DUPLICATE_ID', `Two reviewed documents define different models named ${id}.`, {
          model: id,
        });
      models[id] = model;
    }
  const aspect = options.width / options.height;
  const request = parse(CameraRequestSchema, { view: 'iso', projection: 'perspective' });
  // Every frame uses the same framing size (the largest extent of any document), so size
  // differences between documents stay visible; each frame is centered on its document.
  const boxes = items.map((item) => {
    const built = compileScene(modelTarget(item.document), libraryOf(item.document), {
      bindRigs: false,
    });
    try {
      const { min, max } = built.stats.bounds;
      return new Box3(new Vector3(...min), new Vector3(...max));
    } finally {
      built.dispose();
    }
  });
  const extent = new Vector3();
  for (const box of boxes) extent.max(box.getSize(new Vector3()));
  const fitted = boxes.map((box) => {
    const center = box.getCenter(new Vector3());
    const frame = new Box3(
      new Vector3(center.x - extent.x / 2, box.min.y, center.z - extent.z / 2),
      new Vector3(center.x + extent.x / 2, box.min.y + extent.y, center.z + extent.z / 2),
    );
    const { camera, target } = fitCamera(frame, aspect, request);
    const span = Math.max(extent.length(), 0.1);
    return { camera, target, span, distance: camera.position.distanceTo(target) };
  });
  const direction = new Vector3(1.25, 0, 1.65).normalize();
  const elevation = Math.cos(Math.atan2(0.9, Math.hypot(1.25, 1.65)));
  const spacing =
    (1.25 * Math.max(...fitted.map((f) => f.distance + f.span))) / Math.max(elevation, 0.1);
  const offsets = items.map((_, index) =>
    items.length === 1 ? new Vector3() : direction.clone().multiplyScalar(spacing * index),
  );
  const scene = parse(SceneSchema, {
    schemaVersion: 1,
    kind: 'scene',
    id: 'lineup',
    name: items.length === 1 ? items[0].document.model.name : `Lineup of ${items.length}`,
    nodes: items.map((item, index) => ({
      id: item.id,
      type: 'model',
      model: item.document.model.id,
      ...(index ? { transform: { position: offsets[index].toArray() } } : {}),
    })),
  });
  const frames =
    items.length === 1
      ? singleViews.map((view) => ({ id: view, camera: { view, padding: 1.12 } }))
      : items.map((item, index) => {
          const { camera, target, span, distance } = fitted[index];
          camera.position.add(offsets[index]);
          const snapshot = cameraData(camera, target.clone().add(offsets[index]));
          return {
            id: item.id,
            camera: { fixed: { ...snapshot, far: Math.max(distance + span, snapshot.near * 10) } },
          };
        });
  const plan: ReviewPlan = parse(ReviewPlanSchema, {
    schemaVersion: 1,
    kind: 'review',
    width: options.width,
    height: options.height,
    contactSheet: true,
    frames,
  });
  return { scene, models, plan };
}
