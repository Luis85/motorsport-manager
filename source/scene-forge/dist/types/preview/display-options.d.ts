import * as THREE from 'three';
export declare function createDisplayOptions({ content, grid, draw, }: {
    content(): THREE.Object3D;
    grid(): THREE.GridHelper;
    draw(): void;
}): {
    setWireframe: (enabled: boolean) => void;
    setGrid: (visible: boolean) => void;
    wireframe: () => boolean;
    gridVisible: () => boolean;
};
