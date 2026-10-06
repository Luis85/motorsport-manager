import { Matrix4 } from 'three';
import { type ModelDocument, type ModelLibrary, type SceneDocument, type TransformSpec, type Operation } from '../domain/schema.js';
export declare function nodeById(scene: SceneDocument, id: string): {
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
        position?: [import("../domain/schema.js").ScalarValue, import("../domain/schema.js").ScalarValue, import("../domain/schema.js").ScalarValue] | undefined;
        rotation?: [import("../domain/schema.js").ScalarValue, import("../domain/schema.js").ScalarValue, import("../domain/schema.js").ScalarValue] | undefined;
        scale?: [import("../domain/schema.js").ScalarValue, import("../domain/schema.js").ScalarValue, import("../domain/schema.js").ScalarValue] | undefined;
    } | undefined;
    pattern?: {
        type: "path";
        points: [import("../domain/schema.js").ScalarValue, import("../domain/schema.js").ScalarValue, import("../domain/schema.js").ScalarValue][];
        orient: "none" | "yaw";
    } | {
        type: "linear";
        count: import("../domain/schema.js").ScalarValue;
        step: [import("../domain/schema.js").ScalarValue, import("../domain/schema.js").ScalarValue, import("../domain/schema.js").ScalarValue];
    } | {
        type: "radial";
        count: import("../domain/schema.js").ScalarValue;
        radius: import("../domain/schema.js").ScalarValue;
        startAngle: import("../domain/schema.js").ScalarValue;
        sweep: import("../domain/schema.js").ScalarValue;
        orient: boolean;
    } | {
        type: "grid";
        counts: [import("../domain/schema.js").ScalarValue, import("../domain/schema.js").ScalarValue, import("../domain/schema.js").ScalarValue];
        step: [import("../domain/schema.js").ScalarValue, import("../domain/schema.js").ScalarValue, import("../domain/schema.js").ScalarValue];
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
        position?: [import("../domain/schema.js").ScalarValue, import("../domain/schema.js").ScalarValue, import("../domain/schema.js").ScalarValue] | undefined;
        rotation?: [import("../domain/schema.js").ScalarValue, import("../domain/schema.js").ScalarValue, import("../domain/schema.js").ScalarValue] | undefined;
        scale?: [import("../domain/schema.js").ScalarValue, import("../domain/schema.js").ScalarValue, import("../domain/schema.js").ScalarValue] | undefined;
    } | undefined;
    pattern?: {
        type: "path";
        points: [import("../domain/schema.js").ScalarValue, import("../domain/schema.js").ScalarValue, import("../domain/schema.js").ScalarValue][];
        orient: "none" | "yaw";
    } | {
        type: "linear";
        count: import("../domain/schema.js").ScalarValue;
        step: [import("../domain/schema.js").ScalarValue, import("../domain/schema.js").ScalarValue, import("../domain/schema.js").ScalarValue];
    } | {
        type: "radial";
        count: import("../domain/schema.js").ScalarValue;
        radius: import("../domain/schema.js").ScalarValue;
        startAngle: import("../domain/schema.js").ScalarValue;
        sweep: import("../domain/schema.js").ScalarValue;
        orient: boolean;
    } | {
        type: "grid";
        counts: [import("../domain/schema.js").ScalarValue, import("../domain/schema.js").ScalarValue, import("../domain/schema.js").ScalarValue];
        step: [import("../domain/schema.js").ScalarValue, import("../domain/schema.js").ScalarValue, import("../domain/schema.js").ScalarValue];
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
        position?: [import("../domain/schema.js").ScalarValue, import("../domain/schema.js").ScalarValue, import("../domain/schema.js").ScalarValue] | undefined;
        rotation?: [import("../domain/schema.js").ScalarValue, import("../domain/schema.js").ScalarValue, import("../domain/schema.js").ScalarValue] | undefined;
        scale?: [import("../domain/schema.js").ScalarValue, import("../domain/schema.js").ScalarValue, import("../domain/schema.js").ScalarValue] | undefined;
    } | undefined;
    pattern?: {
        type: "path";
        points: [import("../domain/schema.js").ScalarValue, import("../domain/schema.js").ScalarValue, import("../domain/schema.js").ScalarValue][];
        orient: "none" | "yaw";
    } | {
        type: "linear";
        count: import("../domain/schema.js").ScalarValue;
        step: [import("../domain/schema.js").ScalarValue, import("../domain/schema.js").ScalarValue, import("../domain/schema.js").ScalarValue];
    } | {
        type: "radial";
        count: import("../domain/schema.js").ScalarValue;
        radius: import("../domain/schema.js").ScalarValue;
        startAngle: import("../domain/schema.js").ScalarValue;
        sweep: import("../domain/schema.js").ScalarValue;
        orient: boolean;
    } | {
        type: "grid";
        counts: [import("../domain/schema.js").ScalarValue, import("../domain/schema.js").ScalarValue, import("../domain/schema.js").ScalarValue];
        step: [import("../domain/schema.js").ScalarValue, import("../domain/schema.js").ScalarValue, import("../domain/schema.js").ScalarValue];
        centered: boolean;
    } | undefined;
} | {
    type: "model";
    model: string;
    parameters: Record<string, import("../domain/schema.js").ScalarValue>;
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
        position?: [import("../domain/schema.js").ScalarValue, import("../domain/schema.js").ScalarValue, import("../domain/schema.js").ScalarValue] | undefined;
        rotation?: [import("../domain/schema.js").ScalarValue, import("../domain/schema.js").ScalarValue, import("../domain/schema.js").ScalarValue] | undefined;
        scale?: [import("../domain/schema.js").ScalarValue, import("../domain/schema.js").ScalarValue, import("../domain/schema.js").ScalarValue] | undefined;
    } | undefined;
    pattern?: {
        type: "path";
        points: [import("../domain/schema.js").ScalarValue, import("../domain/schema.js").ScalarValue, import("../domain/schema.js").ScalarValue][];
        orient: "none" | "yaw";
    } | {
        type: "linear";
        count: import("../domain/schema.js").ScalarValue;
        step: [import("../domain/schema.js").ScalarValue, import("../domain/schema.js").ScalarValue, import("../domain/schema.js").ScalarValue];
    } | {
        type: "radial";
        count: import("../domain/schema.js").ScalarValue;
        radius: import("../domain/schema.js").ScalarValue;
        startAngle: import("../domain/schema.js").ScalarValue;
        sweep: import("../domain/schema.js").ScalarValue;
        orient: boolean;
    } | {
        type: "grid";
        counts: [import("../domain/schema.js").ScalarValue, import("../domain/schema.js").ScalarValue, import("../domain/schema.js").ScalarValue];
        step: [import("../domain/schema.js").ScalarValue, import("../domain/schema.js").ScalarValue, import("../domain/schema.js").ScalarValue];
        centered: boolean;
    } | undefined;
};
export declare function subtreeIds(scene: SceneDocument, id: string): Set<string>;
export declare function matrixTransform(matrix: Matrix4): TransformSpec;
export declare function applySpatialOperation(scene: SceneDocument, op: Operation, models: ModelLibrary): void;
/** Capture a local assembly with only its referenced geometry/material dependencies. */
export declare function captureModel(scene: SceneDocument, rootIds: string[], id: string, name?: string): ModelDocument;
export declare function modelDependencies(library: ModelLibrary, id: string): ModelLibrary;
