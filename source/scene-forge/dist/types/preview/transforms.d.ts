import type { Object3D } from 'three';
export declare const clean: (n: number) => number;
export declare function transformData(object: Object3D): {
    position: [number, number, number];
    rotation: [number, number, number];
    scale: [number, number, number];
};
