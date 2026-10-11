import { Box3, Vector3, PerspectiveCamera, OrthographicCamera } from 'three';
import type { CameraRequest, CameraSnapshot, SceneDocument } from '../domain/schema.js';
/** Fit every bounds corner for the actual image aspect. Shared by previews and captures. */
export declare function fitCamera(box: Box3, aspect: number, request: CameraRequest, authored?: SceneDocument['camera']): {
    camera: PerspectiveCamera | OrthographicCamera;
    target: Vector3;
};
export declare function cameraData(camera: PerspectiveCamera | OrthographicCamera, target: Vector3): CameraSnapshot;
