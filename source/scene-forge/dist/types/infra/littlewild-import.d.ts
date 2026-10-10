import type { EditOptions } from './project.js';
/** Registers each Littlewild variant as a Scene Forge model through the guarded model import. */
export declare function importLittlewildDefinition(project: string, file: string, options: EditOptions & {
    prefix?: string;
    replace?: boolean;
}): Promise<{
    warnings?: string[] | undefined;
    source: string;
    sourceFormat: unknown;
    importedFacet: string;
    variants: string[];
    variantModels: {
        [k: string]: string;
    };
    id: string;
    dryRun: boolean;
    models: string[];
    model: {
        geometries: Record<string, {
            type: "box";
            size: [import("../index.js").ScalarValue, import("../index.js").ScalarValue, import("../index.js").ScalarValue];
        } | {
            type: "sphere";
            radius: import("../index.js").ScalarValue;
            segments?: number | undefined;
        } | {
            type: "organic";
            size: [import("../index.js").ScalarValue, import("../index.js").ScalarValue, import("../index.js").ScalarValue];
            roundness: import("../index.js").ScalarValue;
            taper: import("../index.js").ScalarValue;
            bend: import("../index.js").ScalarValue;
            segments: number;
        } | {
            type: "cylinder";
            radiusTop: import("../index.js").ScalarValue;
            radiusBottom: import("../index.js").ScalarValue;
            height: import("../index.js").ScalarValue;
            segments?: number | undefined;
            openEnded?: boolean | undefined;
        } | {
            type: "cone";
            radius: import("../index.js").ScalarValue;
            height: import("../index.js").ScalarValue;
            segments?: number | undefined;
        } | {
            type: "torus";
            radius: import("../index.js").ScalarValue;
            tube: import("../index.js").ScalarValue;
            segments?: number | undefined;
        } | {
            type: "capsule";
            radius: import("../index.js").ScalarValue;
            length: import("../index.js").ScalarValue;
            segments?: number | undefined;
        } | {
            type: "plane";
            size: [import("../index.js").ScalarValue, import("../index.js").ScalarValue];
        } | {
            type: "tube";
            points: [import("../index.js").ScalarValue, import("../index.js").ScalarValue, import("../index.js").ScalarValue][];
            radius: import("../index.js").ScalarValue;
            tubularSegments: number;
            radialSegments: number;
            closed: boolean;
            capEnds: boolean;
        } | {
            type: "lathe";
            points: [import("../index.js").ScalarValue, import("../index.js").ScalarValue][];
            segments?: number | undefined;
        } | {
            type: "extrude";
            points: [import("../index.js").ScalarValue, import("../index.js").ScalarValue][];
            depth: import("../index.js").ScalarValue;
            holes?: [import("../index.js").ScalarValue, import("../index.js").ScalarValue][][] | undefined;
            bevel?: import("../index.js").ScalarValue | undefined;
            bevelSegments?: number | undefined;
        } | {
            type: "mesh";
            positions: [import("../index.js").ScalarValue, import("../index.js").ScalarValue, import("../index.js").ScalarValue][];
            indices: number[];
            normals?: [import("../index.js").ScalarValue, import("../index.js").ScalarValue, import("../index.js").ScalarValue][] | undefined;
            uvs?: [import("../index.js").ScalarValue, import("../index.js").ScalarValue][] | undefined;
        } | {
            type: "boolean";
            operation: "union" | "subtract" | "intersect";
            left: string;
            right: string;
            leftTransform?: {
                position?: [import("../index.js").ScalarValue, import("../index.js").ScalarValue, import("../index.js").ScalarValue] | undefined;
                rotation?: [import("../index.js").ScalarValue, import("../index.js").ScalarValue, import("../index.js").ScalarValue] | undefined;
                scale?: [import("../index.js").ScalarValue, import("../index.js").ScalarValue, import("../index.js").ScalarValue] | undefined;
            } | undefined;
            rightTransform?: {
                position?: [import("../index.js").ScalarValue, import("../index.js").ScalarValue, import("../index.js").ScalarValue] | undefined;
                rotation?: [import("../index.js").ScalarValue, import("../index.js").ScalarValue, import("../index.js").ScalarValue] | undefined;
                scale?: [import("../index.js").ScalarValue, import("../index.js").ScalarValue, import("../index.js").ScalarValue] | undefined;
            } | undefined;
        }>;
        materials: Record<string, {
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
                position?: [import("../index.js").ScalarValue, import("../index.js").ScalarValue, import("../index.js").ScalarValue] | undefined;
                rotation?: [import("../index.js").ScalarValue, import("../index.js").ScalarValue, import("../index.js").ScalarValue] | undefined;
                scale?: [import("../index.js").ScalarValue, import("../index.js").ScalarValue, import("../index.js").ScalarValue] | undefined;
            } | undefined;
            pattern?: {
                type: "path";
                points: [import("../index.js").ScalarValue, import("../index.js").ScalarValue, import("../index.js").ScalarValue][];
                orient: "none" | "yaw";
            } | {
                type: "linear";
                count: import("../index.js").ScalarValue;
                step: [import("../index.js").ScalarValue, import("../index.js").ScalarValue, import("../index.js").ScalarValue];
            } | {
                type: "radial";
                count: import("../index.js").ScalarValue;
                radius: import("../index.js").ScalarValue;
                startAngle: import("../index.js").ScalarValue;
                sweep: import("../index.js").ScalarValue;
                orient: boolean;
            } | {
                type: "grid";
                counts: [import("../index.js").ScalarValue, import("../index.js").ScalarValue, import("../index.js").ScalarValue];
                step: [import("../index.js").ScalarValue, import("../index.js").ScalarValue, import("../index.js").ScalarValue];
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
                position?: [import("../index.js").ScalarValue, import("../index.js").ScalarValue, import("../index.js").ScalarValue] | undefined;
                rotation?: [import("../index.js").ScalarValue, import("../index.js").ScalarValue, import("../index.js").ScalarValue] | undefined;
                scale?: [import("../index.js").ScalarValue, import("../index.js").ScalarValue, import("../index.js").ScalarValue] | undefined;
            } | undefined;
            pattern?: {
                type: "path";
                points: [import("../index.js").ScalarValue, import("../index.js").ScalarValue, import("../index.js").ScalarValue][];
                orient: "none" | "yaw";
            } | {
                type: "linear";
                count: import("../index.js").ScalarValue;
                step: [import("../index.js").ScalarValue, import("../index.js").ScalarValue, import("../index.js").ScalarValue];
            } | {
                type: "radial";
                count: import("../index.js").ScalarValue;
                radius: import("../index.js").ScalarValue;
                startAngle: import("../index.js").ScalarValue;
                sweep: import("../index.js").ScalarValue;
                orient: boolean;
            } | {
                type: "grid";
                counts: [import("../index.js").ScalarValue, import("../index.js").ScalarValue, import("../index.js").ScalarValue];
                step: [import("../index.js").ScalarValue, import("../index.js").ScalarValue, import("../index.js").ScalarValue];
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
                position?: [import("../index.js").ScalarValue, import("../index.js").ScalarValue, import("../index.js").ScalarValue] | undefined;
                rotation?: [import("../index.js").ScalarValue, import("../index.js").ScalarValue, import("../index.js").ScalarValue] | undefined;
                scale?: [import("../index.js").ScalarValue, import("../index.js").ScalarValue, import("../index.js").ScalarValue] | undefined;
            } | undefined;
            pattern?: {
                type: "path";
                points: [import("../index.js").ScalarValue, import("../index.js").ScalarValue, import("../index.js").ScalarValue][];
                orient: "none" | "yaw";
            } | {
                type: "linear";
                count: import("../index.js").ScalarValue;
                step: [import("../index.js").ScalarValue, import("../index.js").ScalarValue, import("../index.js").ScalarValue];
            } | {
                type: "radial";
                count: import("../index.js").ScalarValue;
                radius: import("../index.js").ScalarValue;
                startAngle: import("../index.js").ScalarValue;
                sweep: import("../index.js").ScalarValue;
                orient: boolean;
            } | {
                type: "grid";
                counts: [import("../index.js").ScalarValue, import("../index.js").ScalarValue, import("../index.js").ScalarValue];
                step: [import("../index.js").ScalarValue, import("../index.js").ScalarValue, import("../index.js").ScalarValue];
                centered: boolean;
            } | undefined;
        } | {
            type: "model";
            model: string;
            parameters: Record<string, import("../index.js").ScalarValue>;
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
                position?: [import("../index.js").ScalarValue, import("../index.js").ScalarValue, import("../index.js").ScalarValue] | undefined;
                rotation?: [import("../index.js").ScalarValue, import("../index.js").ScalarValue, import("../index.js").ScalarValue] | undefined;
                scale?: [import("../index.js").ScalarValue, import("../index.js").ScalarValue, import("../index.js").ScalarValue] | undefined;
            } | undefined;
            pattern?: {
                type: "path";
                points: [import("../index.js").ScalarValue, import("../index.js").ScalarValue, import("../index.js").ScalarValue][];
                orient: "none" | "yaw";
            } | {
                type: "linear";
                count: import("../index.js").ScalarValue;
                step: [import("../index.js").ScalarValue, import("../index.js").ScalarValue, import("../index.js").ScalarValue];
            } | {
                type: "radial";
                count: import("../index.js").ScalarValue;
                radius: import("../index.js").ScalarValue;
                startAngle: import("../index.js").ScalarValue;
                sweep: import("../index.js").ScalarValue;
                orient: boolean;
            } | {
                type: "grid";
                counts: [import("../index.js").ScalarValue, import("../index.js").ScalarValue, import("../index.js").ScalarValue];
                step: [import("../index.js").ScalarValue, import("../index.js").ScalarValue, import("../index.js").ScalarValue];
                centered: boolean;
            } | undefined;
        })[];
        schemaVersion: 1;
        kind: "model";
        id: string;
        name: string;
        parameters: Record<string, {
            default: number;
            min?: number | undefined;
            max?: number | undefined;
            description?: string | undefined;
            integer?: boolean | undefined;
        }>;
        category?: string | undefined;
        description?: string | undefined;
    };
    path?: undefined;
    parameters?: undefined;
    stateHash?: undefined;
} | {
    warnings?: string[] | undefined;
    source: string;
    sourceFormat: unknown;
    importedFacet: string;
    variants: string[];
    variantModels: {
        [k: string]: string;
    };
    id: string;
    path: string;
    parameters: Record<string, {
        default: number;
        min?: number | undefined;
        max?: number | undefined;
        description?: string | undefined;
        integer?: boolean | undefined;
    }>;
    models: string[];
    stateHash: string;
    dryRun?: undefined;
    model?: undefined;
}>;
