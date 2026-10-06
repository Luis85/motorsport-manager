import { type SceneDocument, type ModelLibrary } from '../domain/schema.js';
export declare function authoringTarget(scene: SceneDocument, models: ModelLibrary, options?: {
    model?: string;
    node?: string;
    parameters?: Record<string, number>;
}): {
    environment: {
        background: string;
        ambient: number;
        keyIntensity: number;
        keyPosition: [number, number, number];
        exposure?: number | undefined;
        toneMapping?: "linear" | "filmic" | "neutral" | undefined;
    };
    geometries: Record<string, {
        type: "box";
        size: [import("../domain/schema.js").ScalarValue, import("../domain/schema.js").ScalarValue, import("../domain/schema.js").ScalarValue];
    } | {
        type: "sphere";
        radius: import("../domain/schema.js").ScalarValue;
        segments?: number | undefined;
    } | {
        type: "cylinder";
        radiusTop: import("../domain/schema.js").ScalarValue;
        radiusBottom: import("../domain/schema.js").ScalarValue;
        height: import("../domain/schema.js").ScalarValue;
        segments?: number | undefined;
        openEnded?: boolean | undefined;
    } | {
        type: "cone";
        radius: import("../domain/schema.js").ScalarValue;
        height: import("../domain/schema.js").ScalarValue;
        segments?: number | undefined;
    } | {
        type: "torus";
        radius: import("../domain/schema.js").ScalarValue;
        tube: import("../domain/schema.js").ScalarValue;
        segments?: number | undefined;
    } | {
        type: "capsule";
        radius: import("../domain/schema.js").ScalarValue;
        length: import("../domain/schema.js").ScalarValue;
        segments?: number | undefined;
    } | {
        type: "plane";
        size: [import("../domain/schema.js").ScalarValue, import("../domain/schema.js").ScalarValue];
    } | {
        type: "tube";
        points: [import("../domain/schema.js").ScalarValue, import("../domain/schema.js").ScalarValue, import("../domain/schema.js").ScalarValue][];
        radius: import("../domain/schema.js").ScalarValue;
        tubularSegments: number;
        radialSegments: number;
        closed: boolean;
        capEnds: boolean;
    } | {
        type: "lathe";
        points: [import("../domain/schema.js").ScalarValue, import("../domain/schema.js").ScalarValue][];
        segments?: number | undefined;
    } | {
        type: "extrude";
        points: [import("../domain/schema.js").ScalarValue, import("../domain/schema.js").ScalarValue][];
        depth: import("../domain/schema.js").ScalarValue;
        holes?: [import("../domain/schema.js").ScalarValue, import("../domain/schema.js").ScalarValue][][] | undefined;
        bevel?: import("../domain/schema.js").ScalarValue | undefined;
        bevelSegments?: number | undefined;
    } | {
        type: "mesh";
        positions: [import("../domain/schema.js").ScalarValue, import("../domain/schema.js").ScalarValue, import("../domain/schema.js").ScalarValue][];
        indices: number[];
        normals?: [import("../domain/schema.js").ScalarValue, import("../domain/schema.js").ScalarValue, import("../domain/schema.js").ScalarValue][] | undefined;
        uvs?: [import("../domain/schema.js").ScalarValue, import("../domain/schema.js").ScalarValue][] | undefined;
    } | {
        type: "boolean";
        operation: "union" | "subtract" | "intersect";
        left: string;
        right: string;
        leftTransform?: {
            position?: [import("../domain/schema.js").ScalarValue, import("../domain/schema.js").ScalarValue, import("../domain/schema.js").ScalarValue] | undefined;
            rotation?: [import("../domain/schema.js").ScalarValue, import("../domain/schema.js").ScalarValue, import("../domain/schema.js").ScalarValue] | undefined;
            scale?: [import("../domain/schema.js").ScalarValue, import("../domain/schema.js").ScalarValue, import("../domain/schema.js").ScalarValue] | undefined;
        } | undefined;
        rightTransform?: {
            position?: [import("../domain/schema.js").ScalarValue, import("../domain/schema.js").ScalarValue, import("../domain/schema.js").ScalarValue] | undefined;
            rotation?: [import("../domain/schema.js").ScalarValue, import("../domain/schema.js").ScalarValue, import("../domain/schema.js").ScalarValue] | undefined;
            scale?: [import("../domain/schema.js").ScalarValue, import("../domain/schema.js").ScalarValue, import("../domain/schema.js").ScalarValue] | undefined;
        } | undefined;
    }>;
    materials: Record<string, {
        color: string;
        metalness: number;
        roughness: number;
        opacity: number;
        doubleSided: boolean;
        flatShading: boolean;
        emissive?: string | undefined;
        emissiveIntensity?: number | undefined;
        shading?: "standard" | "unlit" | undefined;
    }>;
    nodes: ({
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
    })[];
    schemaVersion: 1;
    kind: "scene";
    id: string;
    name: string;
    revision: number;
    units: "meters";
    parameters: Record<string, number>;
    camera?: {
        position: [number, number, number];
        target: [number, number, number];
        fov: number;
    } | undefined;
};
