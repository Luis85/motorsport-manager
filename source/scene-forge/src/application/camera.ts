import { Box3, Vector3, PerspectiveCamera, OrthographicCamera, MathUtils } from 'three';
import type { CameraRequest, CameraSnapshot, SceneDocument } from '../domain/schema.js';

/** Fit every bounds corner for the actual image aspect. Shared by previews and captures. */
export function fitCamera(
  box: Box3,
  aspect: number,
  request: CameraRequest,
  authored?: SceneDocument['camera'],
) {
  if (request.fixed) {
    const c = request.fixed;
    const camera =
      c.projection === 'perspective'
        ? new PerspectiveCamera(c.fov!, c.aspect!, c.near, c.far)
        : new OrthographicCamera(c.left!, c.right!, c.top!, c.bottom!, c.near, c.far);
    camera.position.fromArray(c.position);
    camera.up.fromArray(c.up);
    camera.zoom = c.zoom;
    const target = new Vector3().fromArray(c.target);
    camera.lookAt(target);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
    return { camera, target };
  }
  if (box.isEmpty()) box = new Box3(new Vector3(-0.5, -0.5, -0.5), new Vector3(0.5, 0.5, 0.5));
  const center = box.getCenter(new Vector3()),
    size = box.getSize(new Vector3());
  const span = Math.max(size.length(), 0.1),
    near = Math.max(span / 1000, 0.00001),
    far = span * 1000;
  const directions: Record<string, number[]> = {
    iso: [1.25, 0.9, 1.65],
    front: [0, 0, 1],
    back: [0, 0, -1],
    right: [1, 0, 0],
    side: [1, 0, 0],
    left: [-1, 0, 0],
    top: [0, 1, 0],
    bottom: [0, -1, 0],
  };
  const a = MathUtils.degToRad(request.azimuth),
    e = MathUtils.degToRad(request.elevation);
  const direction =
    request.view === 'orbit'
      ? new Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e))
      : new Vector3(
          ...((directions[request.view] ?? directions.iso) as [number, number, number]),
        ).normalize();
  const worldUp =
    Math.abs(direction.y) > 0.999
      ? new Vector3(0, 0, direction.y > 0 ? -1 : 1)
      : new Vector3(0, 1, 0);
  const right = new Vector3().crossVectors(worldUp, direction).normalize(),
    up = new Vector3().crossVectors(direction, right);
  const corners: Vector3[] = [];
  for (const x of [-0.5, 0.5])
    for (const y of [-0.5, 0.5])
      for (const z of [-0.5, 0.5]) corners.push(new Vector3(size.x * x, size.y * y, size.z * z));
  const orthographic =
    request.projection === 'orthographic' ||
    (request.projection === 'auto' && !['iso', 'orbit', 'authored'].includes(request.view));
  let camera: PerspectiveCamera | OrthographicCamera;
  const target = center.clone();
  if (request.view === 'authored' && authored) {
    camera = new PerspectiveCamera(authored.fov, aspect, near, far);
    camera.position.fromArray(authored.position);
    target.fromArray(authored.target);
    // Authored cameras may be much farther away than the asset size.
    camera.far = Math.max(far, camera.position.distanceTo(target) + span * 2);
  } else if (orthographic) {
    const half =
      Math.max(
        0.05,
        ...corners.map((c) => Math.max(Math.abs(c.dot(up)), Math.abs(c.dot(right)) / aspect)),
      ) * request.padding;
    camera = new OrthographicCamera(-half * aspect, half * aspect, half, -half, near, far);
    camera.position.copy(center).addScaledVector(direction, span * 3);
  } else {
    camera = new PerspectiveCamera(request.fov, aspect, near, far);
    const tanV = Math.tan(MathUtils.degToRad(request.fov / 2)),
      tanH = tanV * aspect;
    const distance = Math.max(
      0.1,
      ...corners.map(
        (c) =>
          c.dot(direction) +
          request.padding * Math.max(Math.abs(c.dot(right)) / tanH, Math.abs(c.dot(up)) / tanV),
      ),
    );
    camera.position.copy(center).addScaledVector(direction, distance + near * 2);
  }
  camera.up.copy(worldUp);
  camera.lookAt(target);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  return { camera, target };
}

export function cameraData(
  camera: PerspectiveCamera | OrthographicCamera,
  target: Vector3,
): CameraSnapshot {
  return {
    projection: camera instanceof PerspectiveCamera ? 'perspective' : 'orthographic',
    position: camera.position.toArray(),
    target: target.toArray(),
    up: camera.up.toArray(),
    near: camera.near,
    far: camera.far,
    zoom: camera.zoom,
    ...(camera instanceof PerspectiveCamera
      ? { fov: camera.fov, aspect: camera.aspect }
      : { left: camera.left, right: camera.right, top: camera.top, bottom: camera.bottom }),
  };
}
