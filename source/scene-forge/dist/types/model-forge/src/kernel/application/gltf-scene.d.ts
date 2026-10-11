import * as THREE from 'three';
/** A detached export graph. glTF skin nodes live at scene root: their placement is
 * carried by joint transforms and inverse bind matrices, never a mesh ancestor. */
export declare function gltfScene(root: THREE.Object3D): THREE.Scene;
