import type { EditOptions } from './project.js';
/**
 * Registers each Littlewild variant as a Scene Forge model through the guarded model import.
 * `input` is the parsed JSON of `file`, which names the source in messages.
 */
export declare function importLittlewildDefinition(project: string, file: string, input: unknown, options: EditOptions & {
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
            type: "heightfield";
            size: [import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue];
            amplitude: import("../kernel.js").ScalarValue;
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
            size: [import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue];
        } | {
            type: "sphere";
            radius: import("../kernel.js").ScalarValue;
            segments?: number | undefined;
        } | {
            type: "organic";
            size: [import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue];
            roundness: import("../kernel.js").ScalarValue;
            taper: import("../kernel.js").ScalarValue;
            bend: import("../kernel.js").ScalarValue;
            segments: number;
            profile?: {
                at: import("../kernel.js").ScalarValue;
                width: import("../kernel.js").ScalarValue;
                depth: import("../kernel.js").ScalarValue;
                offset: [import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue];
            }[] | undefined;
        } | {
            type: "cylinder";
            radiusTop: import("../kernel.js").ScalarValue;
            radiusBottom: import("../kernel.js").ScalarValue;
            height: import("../kernel.js").ScalarValue;
            segments?: number | undefined;
            openEnded?: boolean | undefined;
        } | {
            type: "cone";
            radius: import("../kernel.js").ScalarValue;
            height: import("../kernel.js").ScalarValue;
            segments?: number | undefined;
        } | {
            type: "torus";
            radius: import("../kernel.js").ScalarValue;
            tube: import("../kernel.js").ScalarValue;
            segments?: number | undefined;
        } | {
            type: "capsule";
            radius: import("../kernel.js").ScalarValue;
            length: import("../kernel.js").ScalarValue;
            segments?: number | undefined;
        } | {
            type: "plane";
            size: [import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue];
        } | {
            type: "tube";
            points: [import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue][];
            radius: import("../kernel.js").ScalarValue;
            tubularSegments: number;
            radialSegments: number;
            closed: boolean;
            capEnds: boolean;
        } | {
            type: "lathe";
            points: [import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue][];
            segments?: number | undefined;
        } | {
            type: "extrude";
            points: [import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue][];
            depth: import("../kernel.js").ScalarValue;
            holes?: [import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue][][] | undefined;
            bevel?: import("../kernel.js").ScalarValue | undefined;
            bevelSegments?: number | undefined;
        } | {
            type: "mesh";
            positions: [import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue][];
            indices: number[];
            normals?: [import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue][] | undefined;
            uvs?: [import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue][] | undefined;
        } | {
            type: "boolean";
            operation: "union" | "subtract" | "intersect";
            left: string;
            right: string;
            leftTransform?: {
                position?: [import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue] | undefined;
                rotation?: [import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue] | undefined;
                scale?: [import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue] | undefined;
            } | undefined;
            rightTransform?: {
                position?: [import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue] | undefined;
                rotation?: [import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue] | undefined;
                scale?: [import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue] | undefined;
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
                position?: [import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue] | undefined;
                rotation?: [import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue] | undefined;
                scale?: [import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue] | undefined;
            } | undefined;
            pattern?: {
                type: "path";
                points: [import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue][];
                orient: "none" | "yaw";
            } | {
                type: "linear";
                count: import("../kernel.js").ScalarValue;
                step: [import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue];
            } | {
                type: "radial";
                count: import("../kernel.js").ScalarValue;
                radius: import("../kernel.js").ScalarValue;
                startAngle: import("../kernel.js").ScalarValue;
                sweep: import("../kernel.js").ScalarValue;
                orient: boolean;
            } | {
                type: "grid";
                counts: [import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue];
                step: [import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue];
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
                position?: [import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue] | undefined;
                rotation?: [import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue] | undefined;
                scale?: [import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue] | undefined;
            } | undefined;
            pattern?: {
                type: "path";
                points: [import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue][];
                orient: "none" | "yaw";
            } | {
                type: "linear";
                count: import("../kernel.js").ScalarValue;
                step: [import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue];
            } | {
                type: "radial";
                count: import("../kernel.js").ScalarValue;
                radius: import("../kernel.js").ScalarValue;
                startAngle: import("../kernel.js").ScalarValue;
                sweep: import("../kernel.js").ScalarValue;
                orient: boolean;
            } | {
                type: "grid";
                counts: [import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue];
                step: [import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue];
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
                position?: [import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue] | undefined;
                rotation?: [import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue] | undefined;
                scale?: [import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue] | undefined;
            } | undefined;
            pattern?: {
                type: "path";
                points: [import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue][];
                orient: "none" | "yaw";
            } | {
                type: "linear";
                count: import("../kernel.js").ScalarValue;
                step: [import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue];
            } | {
                type: "radial";
                count: import("../kernel.js").ScalarValue;
                radius: import("../kernel.js").ScalarValue;
                startAngle: import("../kernel.js").ScalarValue;
                sweep: import("../kernel.js").ScalarValue;
                orient: boolean;
            } | {
                type: "grid";
                counts: [import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue];
                step: [import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue];
                centered: boolean;
            } | undefined;
        } | {
            type: "model";
            model: string;
            parameters: Record<string, import("../kernel.js").ScalarValue>;
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
                position?: [import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue] | undefined;
                rotation?: [import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue] | undefined;
                scale?: [import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue] | undefined;
            } | undefined;
            pattern?: {
                type: "path";
                points: [import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue][];
                orient: "none" | "yaw";
            } | {
                type: "linear";
                count: import("../kernel.js").ScalarValue;
                step: [import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue];
            } | {
                type: "radial";
                count: import("../kernel.js").ScalarValue;
                radius: import("../kernel.js").ScalarValue;
                startAngle: import("../kernel.js").ScalarValue;
                sweep: import("../kernel.js").ScalarValue;
                orient: boolean;
            } | {
                type: "grid";
                counts: [import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue];
                step: [import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue];
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
        revision?: number | undefined;
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
} | {
    warnings: string[];
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
            type: "heightfield";
            size: [import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue];
            amplitude: import("../kernel.js").ScalarValue;
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
            size: [import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue];
        } | {
            type: "sphere";
            radius: import("../kernel.js").ScalarValue;
            segments?: number | undefined;
        } | {
            type: "organic";
            size: [import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue];
            roundness: import("../kernel.js").ScalarValue;
            taper: import("../kernel.js").ScalarValue;
            bend: import("../kernel.js").ScalarValue;
            segments: number;
            profile?: {
                at: import("../kernel.js").ScalarValue;
                width: import("../kernel.js").ScalarValue;
                depth: import("../kernel.js").ScalarValue;
                offset: [import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue];
            }[] | undefined;
        } | {
            type: "cylinder";
            radiusTop: import("../kernel.js").ScalarValue;
            radiusBottom: import("../kernel.js").ScalarValue;
            height: import("../kernel.js").ScalarValue;
            segments?: number | undefined;
            openEnded?: boolean | undefined;
        } | {
            type: "cone";
            radius: import("../kernel.js").ScalarValue;
            height: import("../kernel.js").ScalarValue;
            segments?: number | undefined;
        } | {
            type: "torus";
            radius: import("../kernel.js").ScalarValue;
            tube: import("../kernel.js").ScalarValue;
            segments?: number | undefined;
        } | {
            type: "capsule";
            radius: import("../kernel.js").ScalarValue;
            length: import("../kernel.js").ScalarValue;
            segments?: number | undefined;
        } | {
            type: "plane";
            size: [import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue];
        } | {
            type: "tube";
            points: [import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue][];
            radius: import("../kernel.js").ScalarValue;
            tubularSegments: number;
            radialSegments: number;
            closed: boolean;
            capEnds: boolean;
        } | {
            type: "lathe";
            points: [import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue][];
            segments?: number | undefined;
        } | {
            type: "extrude";
            points: [import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue][];
            depth: import("../kernel.js").ScalarValue;
            holes?: [import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue][][] | undefined;
            bevel?: import("../kernel.js").ScalarValue | undefined;
            bevelSegments?: number | undefined;
        } | {
            type: "mesh";
            positions: [import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue][];
            indices: number[];
            normals?: [import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue][] | undefined;
            uvs?: [import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue][] | undefined;
        } | {
            type: "boolean";
            operation: "union" | "subtract" | "intersect";
            left: string;
            right: string;
            leftTransform?: {
                position?: [import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue] | undefined;
                rotation?: [import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue] | undefined;
                scale?: [import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue] | undefined;
            } | undefined;
            rightTransform?: {
                position?: [import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue] | undefined;
                rotation?: [import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue] | undefined;
                scale?: [import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue] | undefined;
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
                position?: [import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue] | undefined;
                rotation?: [import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue] | undefined;
                scale?: [import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue] | undefined;
            } | undefined;
            pattern?: {
                type: "path";
                points: [import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue][];
                orient: "none" | "yaw";
            } | {
                type: "linear";
                count: import("../kernel.js").ScalarValue;
                step: [import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue];
            } | {
                type: "radial";
                count: import("../kernel.js").ScalarValue;
                radius: import("../kernel.js").ScalarValue;
                startAngle: import("../kernel.js").ScalarValue;
                sweep: import("../kernel.js").ScalarValue;
                orient: boolean;
            } | {
                type: "grid";
                counts: [import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue];
                step: [import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue];
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
                position?: [import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue] | undefined;
                rotation?: [import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue] | undefined;
                scale?: [import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue] | undefined;
            } | undefined;
            pattern?: {
                type: "path";
                points: [import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue][];
                orient: "none" | "yaw";
            } | {
                type: "linear";
                count: import("../kernel.js").ScalarValue;
                step: [import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue];
            } | {
                type: "radial";
                count: import("../kernel.js").ScalarValue;
                radius: import("../kernel.js").ScalarValue;
                startAngle: import("../kernel.js").ScalarValue;
                sweep: import("../kernel.js").ScalarValue;
                orient: boolean;
            } | {
                type: "grid";
                counts: [import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue];
                step: [import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue];
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
                position?: [import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue] | undefined;
                rotation?: [import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue] | undefined;
                scale?: [import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue] | undefined;
            } | undefined;
            pattern?: {
                type: "path";
                points: [import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue][];
                orient: "none" | "yaw";
            } | {
                type: "linear";
                count: import("../kernel.js").ScalarValue;
                step: [import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue];
            } | {
                type: "radial";
                count: import("../kernel.js").ScalarValue;
                radius: import("../kernel.js").ScalarValue;
                startAngle: import("../kernel.js").ScalarValue;
                sweep: import("../kernel.js").ScalarValue;
                orient: boolean;
            } | {
                type: "grid";
                counts: [import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue];
                step: [import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue];
                centered: boolean;
            } | undefined;
        } | {
            type: "model";
            model: string;
            parameters: Record<string, import("../kernel.js").ScalarValue>;
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
                position?: [import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue] | undefined;
                rotation?: [import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue] | undefined;
                scale?: [import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue] | undefined;
            } | undefined;
            pattern?: {
                type: "path";
                points: [import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue][];
                orient: "none" | "yaw";
            } | {
                type: "linear";
                count: import("../kernel.js").ScalarValue;
                step: [import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue];
            } | {
                type: "radial";
                count: import("../kernel.js").ScalarValue;
                radius: import("../kernel.js").ScalarValue;
                startAngle: import("../kernel.js").ScalarValue;
                sweep: import("../kernel.js").ScalarValue;
                orient: boolean;
            } | {
                type: "grid";
                counts: [import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue];
                step: [import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue, import("../kernel.js").ScalarValue];
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
        revision?: number | undefined;
    };
    path?: undefined;
    parameters?: undefined;
    stateHash?: undefined;
} | {
    warnings: string[];
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
