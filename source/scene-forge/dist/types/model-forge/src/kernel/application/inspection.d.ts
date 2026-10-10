import { type SceneDocument, type ModelLibrary, type NodeSelector } from '../domain/schema.js';
/** Filters intersect; an empty selector intentionally selects all authored nodes. */
export declare function selectNodes(scene: SceneDocument, selector: NodeSelector): ({
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
})[];
export declare function inspectNodes(scene: SceneDocument, models: ModelLibrary, selector?: NodeSelector, detailed?: boolean): {
    transform: {
        position?: [import("../domain/schema-values.js").ScalarValue, import("../domain/schema-values.js").ScalarValue, import("../domain/schema-values.js").ScalarValue] | undefined;
        rotation?: [import("../domain/schema-values.js").ScalarValue, import("../domain/schema-values.js").ScalarValue, import("../domain/schema-values.js").ScalarValue] | undefined;
        scale?: [import("../domain/schema-values.js").ScalarValue, import("../domain/schema-values.js").ScalarValue, import("../domain/schema-values.js").ScalarValue] | undefined;
    } | undefined;
    model?: string | undefined;
    id: string;
    name: string | undefined;
    type: "mesh" | "light" | "group" | "model";
    parent: string | null;
    visible: boolean;
    tags: string[];
}[] | {
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
    worldPosition: import("three").Vector3Tuple;
    worldMatrix: import("three").Matrix4Tuple;
    bounds: {
        min: import("three").Vector3Tuple;
        max: import("three").Vector3Tuple;
        size: import("three").Vector3Tuple;
    } | null;
    meshes: number;
    triangles: number;
}[];
export declare function sceneChanges(before: SceneDocument, after: SceneDocument): {
    nodes: {
        added: string[];
        updated: string[];
        removed: string[];
    };
    geometries: {
        added: string[];
        updated: string[];
        removed: string[];
    };
    materials: {
        added: string[];
        updated: string[];
        removed: string[];
    };
    parameters: {
        added: string[];
        updated: string[];
        removed: string[];
    };
    settings: ("name" | "camera" | "environment")[];
};
