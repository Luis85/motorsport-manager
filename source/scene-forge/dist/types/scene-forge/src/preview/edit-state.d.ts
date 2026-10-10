import type { NodeSpec, SceneDocument } from '../kernel-render.js';
export interface EditState {
    nodes: NodeSpec[];
    materials?: SceneDocument['materials'];
    environment?: SceneDocument['environment'];
    selectedId?: string;
}
export declare const editFingerprint: ({ selectedId: _selected, ...state }: EditState) => string;
export declare function createEditHistory(limit?: number): {
    readonly canUndo: boolean;
    readonly canRedo: boolean;
    commit(before: EditState, after: EditState): void;
    travel(direction: "undo" | "redo", current: EditState, apply: (state: EditState) => void): void;
};
export type EditHistory = ReturnType<typeof createEditHistory>;
/** Commit history only after a successful rebuild; failure restores nodes and selection. */
export declare function transactEdit(history: EditHistory, read: () => EditState, restore: (state: EditState) => void, action: () => void, rebuild: () => void): void;
export declare function validTransforms(nodes: NodeSpec[]): boolean;
export declare function sceneEdits(initial: SceneDocument, source: SceneDocument, stateHash?: string): {
    operations: ({
        op: "putNode";
        node: {
            type: "light";
            light: "point" | "spot" | "directional";
            color: string;
            intensity: number;
            distance: number;
            angle: number;
            penumbra: number;
            castShadow: boolean;
            id: string;
            visible: boolean;
            tags: string[];
            name?: string | undefined;
            parent?: string | undefined;
            transform?: {
                position?: [import("../kernel-render.js").ScalarValue, import("../kernel-render.js").ScalarValue, import("../kernel-render.js").ScalarValue] | undefined;
                rotation?: [import("../kernel-render.js").ScalarValue, import("../kernel-render.js").ScalarValue, import("../kernel-render.js").ScalarValue] | undefined;
                scale?: [import("../kernel-render.js").ScalarValue, import("../kernel-render.js").ScalarValue, import("../kernel-render.js").ScalarValue] | undefined;
            } | undefined;
            pattern?: {
                type: "path";
                points: [import("../kernel-render.js").ScalarValue, import("../kernel-render.js").ScalarValue, import("../kernel-render.js").ScalarValue][];
                orient: "none" | "yaw";
            } | {
                type: "linear";
                count: import("../kernel-render.js").ScalarValue;
                step: [import("../kernel-render.js").ScalarValue, import("../kernel-render.js").ScalarValue, import("../kernel-render.js").ScalarValue];
            } | {
                type: "radial";
                count: import("../kernel-render.js").ScalarValue;
                radius: import("../kernel-render.js").ScalarValue;
                startAngle: import("../kernel-render.js").ScalarValue;
                sweep: import("../kernel-render.js").ScalarValue;
                orient: boolean;
            } | {
                type: "grid";
                counts: [import("../kernel-render.js").ScalarValue, import("../kernel-render.js").ScalarValue, import("../kernel-render.js").ScalarValue];
                step: [import("../kernel-render.js").ScalarValue, import("../kernel-render.js").ScalarValue, import("../kernel-render.js").ScalarValue];
                centered: boolean;
            } | undefined;
        } | {
            type: "group";
            id: string;
            visible: boolean;
            tags: string[];
            name?: string | undefined;
            parent?: string | undefined;
            transform?: {
                position?: [import("../kernel-render.js").ScalarValue, import("../kernel-render.js").ScalarValue, import("../kernel-render.js").ScalarValue] | undefined;
                rotation?: [import("../kernel-render.js").ScalarValue, import("../kernel-render.js").ScalarValue, import("../kernel-render.js").ScalarValue] | undefined;
                scale?: [import("../kernel-render.js").ScalarValue, import("../kernel-render.js").ScalarValue, import("../kernel-render.js").ScalarValue] | undefined;
            } | undefined;
            pattern?: {
                type: "path";
                points: [import("../kernel-render.js").ScalarValue, import("../kernel-render.js").ScalarValue, import("../kernel-render.js").ScalarValue][];
                orient: "none" | "yaw";
            } | {
                type: "linear";
                count: import("../kernel-render.js").ScalarValue;
                step: [import("../kernel-render.js").ScalarValue, import("../kernel-render.js").ScalarValue, import("../kernel-render.js").ScalarValue];
            } | {
                type: "radial";
                count: import("../kernel-render.js").ScalarValue;
                radius: import("../kernel-render.js").ScalarValue;
                startAngle: import("../kernel-render.js").ScalarValue;
                sweep: import("../kernel-render.js").ScalarValue;
                orient: boolean;
            } | {
                type: "grid";
                counts: [import("../kernel-render.js").ScalarValue, import("../kernel-render.js").ScalarValue, import("../kernel-render.js").ScalarValue];
                step: [import("../kernel-render.js").ScalarValue, import("../kernel-render.js").ScalarValue, import("../kernel-render.js").ScalarValue];
                centered: boolean;
            } | undefined;
        } | {
            type: "mesh";
            geometry: string;
            material: string;
            id: string;
            visible: boolean;
            tags: string[];
            name?: string | undefined;
            parent?: string | undefined;
            transform?: {
                position?: [import("../kernel-render.js").ScalarValue, import("../kernel-render.js").ScalarValue, import("../kernel-render.js").ScalarValue] | undefined;
                rotation?: [import("../kernel-render.js").ScalarValue, import("../kernel-render.js").ScalarValue, import("../kernel-render.js").ScalarValue] | undefined;
                scale?: [import("../kernel-render.js").ScalarValue, import("../kernel-render.js").ScalarValue, import("../kernel-render.js").ScalarValue] | undefined;
            } | undefined;
            pattern?: {
                type: "path";
                points: [import("../kernel-render.js").ScalarValue, import("../kernel-render.js").ScalarValue, import("../kernel-render.js").ScalarValue][];
                orient: "none" | "yaw";
            } | {
                type: "linear";
                count: import("../kernel-render.js").ScalarValue;
                step: [import("../kernel-render.js").ScalarValue, import("../kernel-render.js").ScalarValue, import("../kernel-render.js").ScalarValue];
            } | {
                type: "radial";
                count: import("../kernel-render.js").ScalarValue;
                radius: import("../kernel-render.js").ScalarValue;
                startAngle: import("../kernel-render.js").ScalarValue;
                sweep: import("../kernel-render.js").ScalarValue;
                orient: boolean;
            } | {
                type: "grid";
                counts: [import("../kernel-render.js").ScalarValue, import("../kernel-render.js").ScalarValue, import("../kernel-render.js").ScalarValue];
                step: [import("../kernel-render.js").ScalarValue, import("../kernel-render.js").ScalarValue, import("../kernel-render.js").ScalarValue];
                centered: boolean;
            } | undefined;
        } | {
            type: "model";
            model: string;
            parameters: Record<string, import("../kernel-render.js").ScalarValue>;
            materialOverrides: Record<string, string>;
            id: string;
            visible: boolean;
            tags: string[];
            rig?: {
                joints: {
                    id: string;
                    position: [number, number, number];
                    rotation: [number, number, number];
                    parent?: string | undefined;
                }[];
                binding: "rigid" | "smooth";
                bindings: Record<string, string>;
                pose: Record<string, [number, number, number]>;
                clips: {
                    id: string;
                    duration: number;
                    tracks: {
                        joint: string;
                        keyframes: {
                            time: number;
                            rotation: [number, number, number];
                        }[];
                    }[];
                }[];
            } | undefined;
            name?: string | undefined;
            parent?: string | undefined;
            transform?: {
                position?: [import("../kernel-render.js").ScalarValue, import("../kernel-render.js").ScalarValue, import("../kernel-render.js").ScalarValue] | undefined;
                rotation?: [import("../kernel-render.js").ScalarValue, import("../kernel-render.js").ScalarValue, import("../kernel-render.js").ScalarValue] | undefined;
                scale?: [import("../kernel-render.js").ScalarValue, import("../kernel-render.js").ScalarValue, import("../kernel-render.js").ScalarValue] | undefined;
            } | undefined;
            pattern?: {
                type: "path";
                points: [import("../kernel-render.js").ScalarValue, import("../kernel-render.js").ScalarValue, import("../kernel-render.js").ScalarValue][];
                orient: "none" | "yaw";
            } | {
                type: "linear";
                count: import("../kernel-render.js").ScalarValue;
                step: [import("../kernel-render.js").ScalarValue, import("../kernel-render.js").ScalarValue, import("../kernel-render.js").ScalarValue];
            } | {
                type: "radial";
                count: import("../kernel-render.js").ScalarValue;
                radius: import("../kernel-render.js").ScalarValue;
                startAngle: import("../kernel-render.js").ScalarValue;
                sweep: import("../kernel-render.js").ScalarValue;
                orient: boolean;
            } | {
                type: "grid";
                counts: [import("../kernel-render.js").ScalarValue, import("../kernel-render.js").ScalarValue, import("../kernel-render.js").ScalarValue];
                step: [import("../kernel-render.js").ScalarValue, import("../kernel-render.js").ScalarValue, import("../kernel-render.js").ScalarValue];
                centered: boolean;
            } | undefined;
        };
    } | {
        op: "patchNodes";
        selector: {
            ids?: string[] | undefined;
            tag?: string | undefined;
            type?: "mesh" | "light" | "group" | "model" | undefined;
            model?: string | undefined;
            parent?: string | null | undefined;
        };
        patch: {
            name?: string | undefined;
            visible?: boolean | undefined;
            tags?: string[] | undefined;
            transform?: {
                position?: [import("../kernel-render.js").ScalarValue, import("../kernel-render.js").ScalarValue, import("../kernel-render.js").ScalarValue] | undefined;
                rotation?: [import("../kernel-render.js").ScalarValue, import("../kernel-render.js").ScalarValue, import("../kernel-render.js").ScalarValue] | undefined;
                scale?: [import("../kernel-render.js").ScalarValue, import("../kernel-render.js").ScalarValue, import("../kernel-render.js").ScalarValue] | undefined;
            } | undefined;
            pattern?: {
                type: "path";
                points: [import("../kernel-render.js").ScalarValue, import("../kernel-render.js").ScalarValue, import("../kernel-render.js").ScalarValue][];
                orient: "none" | "yaw";
            } | {
                type: "linear";
                count: import("../kernel-render.js").ScalarValue;
                step: [import("../kernel-render.js").ScalarValue, import("../kernel-render.js").ScalarValue, import("../kernel-render.js").ScalarValue];
            } | {
                type: "radial";
                count: import("../kernel-render.js").ScalarValue;
                radius: import("../kernel-render.js").ScalarValue;
                startAngle: import("../kernel-render.js").ScalarValue;
                sweep: import("../kernel-render.js").ScalarValue;
                orient: boolean;
            } | {
                type: "grid";
                counts: [import("../kernel-render.js").ScalarValue, import("../kernel-render.js").ScalarValue, import("../kernel-render.js").ScalarValue];
                step: [import("../kernel-render.js").ScalarValue, import("../kernel-render.js").ScalarValue, import("../kernel-render.js").ScalarValue];
                centered: boolean;
            } | null | undefined;
            rig?: {
                joints: {
                    id: string;
                    position: [number, number, number];
                    rotation: [number, number, number];
                    parent?: string | undefined;
                }[];
                binding: "rigid" | "smooth";
                bindings: Record<string, string>;
                pose: Record<string, [number, number, number]>;
                clips: {
                    id: string;
                    duration: number;
                    tracks: {
                        joint: string;
                        keyframes: {
                            time: number;
                            rotation: [number, number, number];
                        }[];
                    }[];
                }[];
            } | null | undefined;
            color?: string | undefined;
            intensity?: number | undefined;
            distance?: number | undefined;
            angle?: number | undefined;
            penumbra?: number | undefined;
            castShadow?: boolean | undefined;
            parameters?: Record<string, import("../kernel-render.js").ScalarValue> | undefined;
            materialOverrides?: Record<string, string> | undefined;
        };
    } | {
        op: "removeNode";
        id: string;
        cascade: boolean;
    } | {
        op: "putGeometry";
        id: string;
        geometry: {
            type: "heightfield";
            size: [import("../kernel-render.js").ScalarValue, import("../kernel-render.js").ScalarValue];
            amplitude: import("../kernel-render.js").ScalarValue;
            resolution: [number, number];
            seed: number;
            noise: {
                kind: "value" | "ridged" | "billow";
                octaves: number;
                frequency: number;
                lacunarity: number;
                gain: number;
            };
            falloff: "none" | "island" | "basin";
            terrace: number;
            bands?: {
                below: number;
                color: string;
            }[] | undefined;
        } | {
            type: "box";
            size: [import("../kernel-render.js").ScalarValue, import("../kernel-render.js").ScalarValue, import("../kernel-render.js").ScalarValue];
        } | {
            type: "sphere";
            radius: import("../kernel-render.js").ScalarValue;
            segments?: number | undefined;
        } | {
            type: "organic";
            size: [import("../kernel-render.js").ScalarValue, import("../kernel-render.js").ScalarValue, import("../kernel-render.js").ScalarValue];
            roundness: import("../kernel-render.js").ScalarValue;
            taper: import("../kernel-render.js").ScalarValue;
            bend: import("../kernel-render.js").ScalarValue;
            segments: number;
            profile?: {
                at: import("../kernel-render.js").ScalarValue;
                width: import("../kernel-render.js").ScalarValue;
                depth: import("../kernel-render.js").ScalarValue;
                offset: [import("../kernel-render.js").ScalarValue, import("../kernel-render.js").ScalarValue];
            }[] | undefined;
        } | {
            type: "cylinder";
            radiusTop: import("../kernel-render.js").ScalarValue;
            radiusBottom: import("../kernel-render.js").ScalarValue;
            height: import("../kernel-render.js").ScalarValue;
            segments?: number | undefined;
            openEnded?: boolean | undefined;
        } | {
            type: "cone";
            radius: import("../kernel-render.js").ScalarValue;
            height: import("../kernel-render.js").ScalarValue;
            segments?: number | undefined;
        } | {
            type: "torus";
            radius: import("../kernel-render.js").ScalarValue;
            tube: import("../kernel-render.js").ScalarValue;
            segments?: number | undefined;
        } | {
            type: "capsule";
            radius: import("../kernel-render.js").ScalarValue;
            length: import("../kernel-render.js").ScalarValue;
            segments?: number | undefined;
        } | {
            type: "plane";
            size: [import("../kernel-render.js").ScalarValue, import("../kernel-render.js").ScalarValue];
        } | {
            type: "tube";
            points: [import("../kernel-render.js").ScalarValue, import("../kernel-render.js").ScalarValue, import("../kernel-render.js").ScalarValue][];
            radius: import("../kernel-render.js").ScalarValue;
            tubularSegments: number;
            radialSegments: number;
            closed: boolean;
            capEnds: boolean;
        } | {
            type: "lathe";
            points: [import("../kernel-render.js").ScalarValue, import("../kernel-render.js").ScalarValue][];
            segments?: number | undefined;
        } | {
            type: "extrude";
            points: [import("../kernel-render.js").ScalarValue, import("../kernel-render.js").ScalarValue][];
            depth: import("../kernel-render.js").ScalarValue;
            holes?: [import("../kernel-render.js").ScalarValue, import("../kernel-render.js").ScalarValue][][] | undefined;
            bevel?: import("../kernel-render.js").ScalarValue | undefined;
            bevelSegments?: number | undefined;
        } | {
            type: "mesh";
            positions: [import("../kernel-render.js").ScalarValue, import("../kernel-render.js").ScalarValue, import("../kernel-render.js").ScalarValue][];
            indices: number[];
            normals?: [import("../kernel-render.js").ScalarValue, import("../kernel-render.js").ScalarValue, import("../kernel-render.js").ScalarValue][] | undefined;
            uvs?: [import("../kernel-render.js").ScalarValue, import("../kernel-render.js").ScalarValue][] | undefined;
        } | {
            type: "boolean";
            operation: "union" | "subtract" | "intersect";
            left: string;
            right: string;
            leftTransform?: {
                position?: [import("../kernel-render.js").ScalarValue, import("../kernel-render.js").ScalarValue, import("../kernel-render.js").ScalarValue] | undefined;
                rotation?: [import("../kernel-render.js").ScalarValue, import("../kernel-render.js").ScalarValue, import("../kernel-render.js").ScalarValue] | undefined;
                scale?: [import("../kernel-render.js").ScalarValue, import("../kernel-render.js").ScalarValue, import("../kernel-render.js").ScalarValue] | undefined;
            } | undefined;
            rightTransform?: {
                position?: [import("../kernel-render.js").ScalarValue, import("../kernel-render.js").ScalarValue, import("../kernel-render.js").ScalarValue] | undefined;
                rotation?: [import("../kernel-render.js").ScalarValue, import("../kernel-render.js").ScalarValue, import("../kernel-render.js").ScalarValue] | undefined;
                scale?: [import("../kernel-render.js").ScalarValue, import("../kernel-render.js").ScalarValue, import("../kernel-render.js").ScalarValue] | undefined;
            } | undefined;
        };
    } | {
        op: "removeGeometry";
        id: string;
    } | {
        op: "putMaterial";
        id: string;
        material: {
            color: string;
            metalness: number;
            roughness: number;
            opacity: number;
            doubleSided: boolean;
            flatShading: boolean;
            surface?: {
                kind: "fur" | "cloth" | "leather";
                seed: number;
                scale: number;
                strength: number;
                version?: 1 | 2 | undefined;
            } | undefined;
            sheen?: number | undefined;
            sheenColor?: string | undefined;
            sheenRoughness?: number | undefined;
            clearcoat?: number | undefined;
            clearcoatRoughness?: number | undefined;
            emissive?: string | undefined;
            emissiveIntensity?: number | undefined;
            depthWrite?: boolean | undefined;
            shading?: "standard" | "unlit" | undefined;
            vertexColors?: boolean | undefined;
        };
    } | {
        op: "removeMaterial";
        id: string;
    } | {
        op: "setParameter";
        id: string;
        value: number;
    } | {
        op: "setCamera";
        camera: {
            position: [number, number, number];
            target: [number, number, number];
            fov: number;
        };
    } | {
        op: "setEnvironment";
        environment: {
            background: string;
            ambient: number;
            keyIntensity: number;
            keyPosition: [number, number, number];
            exposure?: number | undefined;
            toneMapping?: "linear" | "filmic" | "neutral" | undefined;
            presentation?: "inspection" | "portrait" | undefined;
        };
    } | {
        op: "patchNode";
        id: string;
        patch: {
            name?: string | undefined;
            visible?: boolean | undefined;
            tags?: string[] | undefined;
            transform?: {
                position?: [import("../kernel-render.js").ScalarValue, import("../kernel-render.js").ScalarValue, import("../kernel-render.js").ScalarValue] | undefined;
                rotation?: [import("../kernel-render.js").ScalarValue, import("../kernel-render.js").ScalarValue, import("../kernel-render.js").ScalarValue] | undefined;
                scale?: [import("../kernel-render.js").ScalarValue, import("../kernel-render.js").ScalarValue, import("../kernel-render.js").ScalarValue] | undefined;
            } | undefined;
            pattern?: {
                type: "path";
                points: [import("../kernel-render.js").ScalarValue, import("../kernel-render.js").ScalarValue, import("../kernel-render.js").ScalarValue][];
                orient: "none" | "yaw";
            } | {
                type: "linear";
                count: import("../kernel-render.js").ScalarValue;
                step: [import("../kernel-render.js").ScalarValue, import("../kernel-render.js").ScalarValue, import("../kernel-render.js").ScalarValue];
            } | {
                type: "radial";
                count: import("../kernel-render.js").ScalarValue;
                radius: import("../kernel-render.js").ScalarValue;
                startAngle: import("../kernel-render.js").ScalarValue;
                sweep: import("../kernel-render.js").ScalarValue;
                orient: boolean;
            } | {
                type: "grid";
                counts: [import("../kernel-render.js").ScalarValue, import("../kernel-render.js").ScalarValue, import("../kernel-render.js").ScalarValue];
                step: [import("../kernel-render.js").ScalarValue, import("../kernel-render.js").ScalarValue, import("../kernel-render.js").ScalarValue];
                centered: boolean;
            } | null | undefined;
            rig?: {
                joints: {
                    id: string;
                    position: [number, number, number];
                    rotation: [number, number, number];
                    parent?: string | undefined;
                }[];
                binding: "rigid" | "smooth";
                bindings: Record<string, string>;
                pose: Record<string, [number, number, number]>;
                clips: {
                    id: string;
                    duration: number;
                    tracks: {
                        joint: string;
                        keyframes: {
                            time: number;
                            rotation: [number, number, number];
                        }[];
                    }[];
                }[];
            } | null | undefined;
            color?: string | undefined;
            intensity?: number | undefined;
            distance?: number | undefined;
            angle?: number | undefined;
            penumbra?: number | undefined;
            castShadow?: boolean | undefined;
            parameters?: Record<string, import("../kernel-render.js").ScalarValue> | undefined;
            materialOverrides?: Record<string, string> | undefined;
        };
    } | {
        op: "duplicateNode";
        id: string;
        newId: string;
        offset: [import("../kernel-render.js").ScalarValue, import("../kernel-render.js").ScalarValue, import("../kernel-render.js").ScalarValue];
    } | {
        op: "reparentNode";
        id: string;
        parent: string | null;
        keepWorld: boolean;
    } | {
        op: "groupNodes";
        id: string;
        nodes: string[];
        name?: string | undefined;
    } | {
        op: "groundNode";
        id: string;
        y: number;
    } | {
        op: "placeNode";
        id: string;
        target: string;
        side: "below" | "left" | "right" | "front" | "back" | "above";
        gap: number;
        center: boolean;
    })[];
    expectedState?: string | undefined;
    scene: string;
    expectedRevision: number;
};
