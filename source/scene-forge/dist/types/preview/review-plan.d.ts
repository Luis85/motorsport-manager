import type * as THREE from 'three';
import type { SceneDocument } from '../domain/schema.js';
import type { Toast } from './toast.js';
export interface ReviewDisplay {
    grid: boolean;
    wireframe: boolean;
    background: string;
}
export declare function reviewPlanFor(stage: {
    clientWidth: number;
    clientHeight: number;
}, camera: THREE.PerspectiveCamera | THREE.OrthographicCamera, target: THREE.Vector3, display: ReviewDisplay): {
    schemaVersion: number;
    kind: string;
    width: number;
    height: number;
    grid: boolean;
    wireframe: boolean;
    contactSheet: boolean;
    background: string;
    frames: {
        id: string;
        camera: {
            fixed: {
                projection: "perspective" | "orthographic";
                position: [number, number, number];
                target: [number, number, number];
                up: [number, number, number];
                near: number;
                far: number;
                zoom: number;
                fov?: number | undefined;
                aspect?: number | undefined;
                left?: number | undefined;
                right?: number | undefined;
                top?: number | undefined;
                bottom?: number | undefined;
            };
        };
    }[];
};
export declare function setupReviewButtons({ source, plan, toast, }: {
    source: SceneDocument;
    plan(): ReturnType<typeof reviewPlanFor>;
    toast: Toast;
}): void;
