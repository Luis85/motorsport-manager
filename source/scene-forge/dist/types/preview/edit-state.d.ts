import type { NodeSpec, SceneDocument } from '../domain/schema.js';
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
                position?: [import("../domain/schema-values.js").ScalarValue, import("../domain/schema-values.js").ScalarValue, import("../domain/schema-values.js").ScalarValue] | undefined;
                rotation?: [import("../domain/schema-values.js").ScalarValue, import("../domain/schema-values.js").ScalarValue, import("../domain/schema-values.js").ScalarValue] | undefined;
                scale?: [import("../domain/schema-values.js").ScalarValue, import("../domain/schema-values.js").ScalarValue, import("../domain/schema-values.js").ScalarValue] | undefined;
            } | undefined;
            pattern?: {
                type: "path";
                points: [import("../domain/schema-values.js").ScalarValue, import("../domain/schema-values.js").ScalarValue, import("../domain/schema-values.js").ScalarValue][];
                orient: "none" | "yaw";
            } | {
                type: "linear";
                count: import("../domain/schema-values.js").ScalarValue;
                step: [import("../domain/schema-values.js").ScalarValue, import("../domain/schema-values.js").ScalarValue, import("../domain/schema-values.js").ScalarValue];
            } | {
                type: "radial";
                count: import("../domain/schema-values.js").ScalarValue;
                radius: import("../domain/schema-values.js").ScalarValue;
                startAngle: import("../domain/schema-values.js").ScalarValue;
                sweep: import("../domain/schema-values.js").ScalarValue;
                orient: boolean;
            } | {
                type: "grid";
                counts: [import("../domain/schema-values.js").ScalarValue, import("../domain/schema-values.js").ScalarValue, import("../domain/schema-values.js").ScalarValue];
                step: [import("../domain/schema-values.js").ScalarValue, import("../domain/schema-values.js").ScalarValue, import("../domain/schema-values.js").ScalarValue];
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
                position?: [import("../domain/schema-values.js").ScalarValue, import("../domain/schema-values.js").ScalarValue, import("../domain/schema-values.js").ScalarValue] | undefined;
                rotation?: [import("../domain/schema-values.js").ScalarValue, import("../domain/schema-values.js").ScalarValue, import("../domain/schema-values.js").ScalarValue] | undefined;
                scale?: [import("../domain/schema-values.js").ScalarValue, import("../domain/schema-values.js").ScalarValue, import("../domain/schema-values.js").ScalarValue] | undefined;
            } | undefined;
            pattern?: {
                type: "path";
                points: [import("../domain/schema-values.js").ScalarValue, import("../domain/schema-values.js").ScalarValue, import("../domain/schema-values.js").ScalarValue][];
                orient: "none" | "yaw";
            } | {
                type: "linear";
                count: import("../domain/schema-values.js").ScalarValue;
                step: [import("../domain/schema-values.js").ScalarValue, import("../domain/schema-values.js").ScalarValue, import("../domain/schema-values.js").ScalarValue];
            } | {
                type: "radial";
                count: import("../domain/schema-values.js").ScalarValue;
                radius: import("../domain/schema-values.js").ScalarValue;
                startAngle: import("../domain/schema-values.js").ScalarValue;
                sweep: import("../domain/schema-values.js").ScalarValue;
                orient: boolean;
            } | {
                type: "grid";
                counts: [import("../domain/schema-values.js").ScalarValue, import("../domain/schema-values.js").ScalarValue, import("../domain/schema-values.js").ScalarValue];
                step: [import("../domain/schema-values.js").ScalarValue, import("../domain/schema-values.js").ScalarValue, import("../domain/schema-values.js").ScalarValue];
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
                position?: [import("../domain/schema-values.js").ScalarValue, import("../domain/schema-values.js").ScalarValue, import("../domain/schema-values.js").ScalarValue] | undefined;
                rotation?: [import("../domain/schema-values.js").ScalarValue, import("../domain/schema-values.js").ScalarValue, import("../domain/schema-values.js").ScalarValue] | undefined;
                scale?: [import("../domain/schema-values.js").ScalarValue, import("../domain/schema-values.js").ScalarValue, import("../domain/schema-values.js").ScalarValue] | undefined;
            } | undefined;
            pattern?: {
                type: "path";
                points: [import("../domain/schema-values.js").ScalarValue, import("../domain/schema-values.js").ScalarValue, import("../domain/schema-values.js").ScalarValue][];
                orient: "none" | "yaw";
            } | {
                type: "linear";
                count: import("../domain/schema-values.js").ScalarValue;
                step: [import("../domain/schema-values.js").ScalarValue, import("../domain/schema-values.js").ScalarValue, import("../domain/schema-values.js").ScalarValue];
            } | {
                type: "radial";
                count: import("../domain/schema-values.js").ScalarValue;
                radius: import("../domain/schema-values.js").ScalarValue;
                startAngle: import("../domain/schema-values.js").ScalarValue;
                sweep: import("../domain/schema-values.js").ScalarValue;
                orient: boolean;
            } | {
                type: "grid";
                counts: [import("../domain/schema-values.js").ScalarValue, import("../domain/schema-values.js").ScalarValue, import("../domain/schema-values.js").ScalarValue];
                step: [import("../domain/schema-values.js").ScalarValue, import("../domain/schema-values.js").ScalarValue, import("../domain/schema-values.js").ScalarValue];
                centered: boolean;
            } | undefined;
        } | {
            type: "model";
            model: string;
            parameters: Record<string, import("../domain/schema-values.js").ScalarValue>;
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
                position?: [import("../domain/schema-values.js").ScalarValue, import("../domain/schema-values.js").ScalarValue, import("../domain/schema-values.js").ScalarValue] | undefined;
                rotation?: [import("../domain/schema-values.js").ScalarValue, import("../domain/schema-values.js").ScalarValue, import("../domain/schema-values.js").ScalarValue] | undefined;
                scale?: [import("../domain/schema-values.js").ScalarValue, import("../domain/schema-values.js").ScalarValue, import("../domain/schema-values.js").ScalarValue] | undefined;
            } | undefined;
            pattern?: {
                type: "path";
                points: [import("../domain/schema-values.js").ScalarValue, import("../domain/schema-values.js").ScalarValue, import("../domain/schema-values.js").ScalarValue][];
                orient: "none" | "yaw";
            } | {
                type: "linear";
                count: import("../domain/schema-values.js").ScalarValue;
                step: [import("../domain/schema-values.js").ScalarValue, import("../domain/schema-values.js").ScalarValue, import("../domain/schema-values.js").ScalarValue];
            } | {
                type: "radial";
                count: import("../domain/schema-values.js").ScalarValue;
                radius: import("../domain/schema-values.js").ScalarValue;
                startAngle: import("../domain/schema-values.js").ScalarValue;
                sweep: import("../domain/schema-values.js").ScalarValue;
                orient: boolean;
            } | {
                type: "grid";
                counts: [import("../domain/schema-values.js").ScalarValue, import("../domain/schema-values.js").ScalarValue, import("../domain/schema-values.js").ScalarValue];
                step: [import("../domain/schema-values.js").ScalarValue, import("../domain/schema-values.js").ScalarValue, import("../domain/schema-values.js").ScalarValue];
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
                position?: [import("../domain/schema-values.js").ScalarValue, import("../domain/schema-values.js").ScalarValue, import("../domain/schema-values.js").ScalarValue] | undefined;
                rotation?: [import("../domain/schema-values.js").ScalarValue, import("../domain/schema-values.js").ScalarValue, import("../domain/schema-values.js").ScalarValue] | undefined;
                scale?: [import("../domain/schema-values.js").ScalarValue, import("../domain/schema-values.js").ScalarValue, import("../domain/schema-values.js").ScalarValue] | undefined;
            } | undefined;
            pattern?: {
                type: "path";
                points: [import("../domain/schema-values.js").ScalarValue, import("../domain/schema-values.js").ScalarValue, import("../domain/schema-values.js").ScalarValue][];
                orient: "none" | "yaw";
            } | {
                type: "linear";
                count: import("../domain/schema-values.js").ScalarValue;
                step: [import("../domain/schema-values.js").ScalarValue, import("../domain/schema-values.js").ScalarValue, import("../domain/schema-values.js").ScalarValue];
            } | {
                type: "radial";
                count: import("../domain/schema-values.js").ScalarValue;
                radius: import("../domain/schema-values.js").ScalarValue;
                startAngle: import("../domain/schema-values.js").ScalarValue;
                sweep: import("../domain/schema-values.js").ScalarValue;
                orient: boolean;
            } | {
                type: "grid";
                counts: [import("../domain/schema-values.js").ScalarValue, import("../domain/schema-values.js").ScalarValue, import("../domain/schema-values.js").ScalarValue];
                step: [import("../domain/schema-values.js").ScalarValue, import("../domain/schema-values.js").ScalarValue, import("../domain/schema-values.js").ScalarValue];
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
            parameters?: Record<string, import("../domain/schema-values.js").ScalarValue> | undefined;
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
            type: "box";
            size: [import("../domain/schema-values.js").ScalarValue, import("../domain/schema-values.js").ScalarValue, import("../domain/schema-values.js").ScalarValue];
        } | {
            type: "sphere";
            radius: import("../domain/schema-values.js").ScalarValue;
            segments?: number | undefined;
        } | {
            type: "cylinder";
            radiusTop: import("../domain/schema-values.js").ScalarValue;
            radiusBottom: import("../domain/schema-values.js").ScalarValue;
            height: import("../domain/schema-values.js").ScalarValue;
            segments?: number | undefined;
            openEnded?: boolean | undefined;
        } | {
            type: "cone";
            radius: import("../domain/schema-values.js").ScalarValue;
            height: import("../domain/schema-values.js").ScalarValue;
            segments?: number | undefined;
        } | {
            type: "torus";
            radius: import("../domain/schema-values.js").ScalarValue;
            tube: import("../domain/schema-values.js").ScalarValue;
            segments?: number | undefined;
        } | {
            type: "capsule";
            radius: import("../domain/schema-values.js").ScalarValue;
            length: import("../domain/schema-values.js").ScalarValue;
            segments?: number | undefined;
        } | {
            type: "plane";
            size: [import("../domain/schema-values.js").ScalarValue, import("../domain/schema-values.js").ScalarValue];
        } | {
            type: "tube";
            points: [import("../domain/schema-values.js").ScalarValue, import("../domain/schema-values.js").ScalarValue, import("../domain/schema-values.js").ScalarValue][];
            radius: import("../domain/schema-values.js").ScalarValue;
            tubularSegments: number;
            radialSegments: number;
            closed: boolean;
            capEnds: boolean;
        } | {
            type: "lathe";
            points: [import("../domain/schema-values.js").ScalarValue, import("../domain/schema-values.js").ScalarValue][];
            segments?: number | undefined;
        } | {
            type: "extrude";
            points: [import("../domain/schema-values.js").ScalarValue, import("../domain/schema-values.js").ScalarValue][];
            depth: import("../domain/schema-values.js").ScalarValue;
            holes?: [import("../domain/schema-values.js").ScalarValue, import("../domain/schema-values.js").ScalarValue][][] | undefined;
            bevel?: import("../domain/schema-values.js").ScalarValue | undefined;
            bevelSegments?: number | undefined;
        } | {
            type: "mesh";
            positions: [import("../domain/schema-values.js").ScalarValue, import("../domain/schema-values.js").ScalarValue, import("../domain/schema-values.js").ScalarValue][];
            indices: number[];
            normals?: [import("../domain/schema-values.js").ScalarValue, import("../domain/schema-values.js").ScalarValue, import("../domain/schema-values.js").ScalarValue][] | undefined;
            uvs?: [import("../domain/schema-values.js").ScalarValue, import("../domain/schema-values.js").ScalarValue][] | undefined;
        } | {
            type: "boolean";
            operation: "union" | "subtract" | "intersect";
            left: string;
            right: string;
            leftTransform?: {
                position?: [import("../domain/schema-values.js").ScalarValue, import("../domain/schema-values.js").ScalarValue, import("../domain/schema-values.js").ScalarValue] | undefined;
                rotation?: [import("../domain/schema-values.js").ScalarValue, import("../domain/schema-values.js").ScalarValue, import("../domain/schema-values.js").ScalarValue] | undefined;
                scale?: [import("../domain/schema-values.js").ScalarValue, import("../domain/schema-values.js").ScalarValue, import("../domain/schema-values.js").ScalarValue] | undefined;
            } | undefined;
            rightTransform?: {
                position?: [import("../domain/schema-values.js").ScalarValue, import("../domain/schema-values.js").ScalarValue, import("../domain/schema-values.js").ScalarValue] | undefined;
                rotation?: [import("../domain/schema-values.js").ScalarValue, import("../domain/schema-values.js").ScalarValue, import("../domain/schema-values.js").ScalarValue] | undefined;
                scale?: [import("../domain/schema-values.js").ScalarValue, import("../domain/schema-values.js").ScalarValue, import("../domain/schema-values.js").ScalarValue] | undefined;
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
            emissive?: string | undefined;
            emissiveIntensity?: number | undefined;
            shading?: "standard" | "unlit" | undefined;
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
        };
    } | {
        op: "patchNode";
        id: string;
        patch: {
            name?: string | undefined;
            visible?: boolean | undefined;
            tags?: string[] | undefined;
            transform?: {
                position?: [import("../domain/schema-values.js").ScalarValue, import("../domain/schema-values.js").ScalarValue, import("../domain/schema-values.js").ScalarValue] | undefined;
                rotation?: [import("../domain/schema-values.js").ScalarValue, import("../domain/schema-values.js").ScalarValue, import("../domain/schema-values.js").ScalarValue] | undefined;
                scale?: [import("../domain/schema-values.js").ScalarValue, import("../domain/schema-values.js").ScalarValue, import("../domain/schema-values.js").ScalarValue] | undefined;
            } | undefined;
            pattern?: {
                type: "path";
                points: [import("../domain/schema-values.js").ScalarValue, import("../domain/schema-values.js").ScalarValue, import("../domain/schema-values.js").ScalarValue][];
                orient: "none" | "yaw";
            } | {
                type: "linear";
                count: import("../domain/schema-values.js").ScalarValue;
                step: [import("../domain/schema-values.js").ScalarValue, import("../domain/schema-values.js").ScalarValue, import("../domain/schema-values.js").ScalarValue];
            } | {
                type: "radial";
                count: import("../domain/schema-values.js").ScalarValue;
                radius: import("../domain/schema-values.js").ScalarValue;
                startAngle: import("../domain/schema-values.js").ScalarValue;
                sweep: import("../domain/schema-values.js").ScalarValue;
                orient: boolean;
            } | {
                type: "grid";
                counts: [import("../domain/schema-values.js").ScalarValue, import("../domain/schema-values.js").ScalarValue, import("../domain/schema-values.js").ScalarValue];
                step: [import("../domain/schema-values.js").ScalarValue, import("../domain/schema-values.js").ScalarValue, import("../domain/schema-values.js").ScalarValue];
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
            parameters?: Record<string, import("../domain/schema-values.js").ScalarValue> | undefined;
            materialOverrides?: Record<string, string> | undefined;
        };
    } | {
        op: "duplicateNode";
        id: string;
        newId: string;
        offset: [import("../domain/schema-values.js").ScalarValue, import("../domain/schema-values.js").ScalarValue, import("../domain/schema-values.js").ScalarValue];
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
        side: "left" | "right" | "front" | "back" | "above" | "below";
        gap: number;
        center: boolean;
    })[];
    expectedState?: string | undefined;
    scene: string;
    expectedRevision: number;
};
