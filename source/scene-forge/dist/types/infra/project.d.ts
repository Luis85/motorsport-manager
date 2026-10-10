import { type SceneDocument, type ModelLibrary, type ProjectDocument, type Operation } from '../domain/schema.js';
import { type EditOptions } from '../application/edit.js';
export { readJson, writeJson, atomicWrite, findProject, withLock } from './files.js';
export { stateHash } from './state-hash.js';
export type { EditOptions } from '../application/edit.js';
export interface Snapshot {
    root: string;
    manifest: ProjectDocument;
    scene: SceneDocument;
    models: ModelLibrary;
    stateHash: string;
}
export declare const newScene: (id: string, name?: string) => {
    environment: {
        background: string;
        ambient: number;
        keyIntensity: number;
        keyPosition: [number, number, number];
        exposure?: number | undefined;
        toneMapping?: "linear" | "filmic" | "neutral" | undefined;
        presentation?: "inspection" | "portrait" | undefined;
    };
    geometries: Record<string, {
        type: "box";
        size: [import("../domain/schema.js").ScalarValue, import("../domain/schema.js").ScalarValue, import("../domain/schema.js").ScalarValue];
    } | {
        type: "sphere";
        radius: import("../domain/schema.js").ScalarValue;
        segments?: number | undefined;
    } | {
        type: "organic";
        size: [import("../domain/schema.js").ScalarValue, import("../domain/schema.js").ScalarValue, import("../domain/schema.js").ScalarValue];
        roundness: import("../domain/schema.js").ScalarValue;
        taper: import("../domain/schema.js").ScalarValue;
        bend: import("../domain/schema.js").ScalarValue;
        segments: number;
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
export declare function loadProject(start: string, sceneId?: string): Promise<Snapshot>;
/** Load every scene against one model-library snapshot under the same project lock. */
export declare function loadProjectScenes(start: string): Promise<{
    root: string;
    manifest: {
        schemaVersion: 1;
        name: string;
        activeScene: string;
        scenes: Record<string, string>;
        models: Record<string, string>;
    };
    models: ModelLibrary;
    scenes: {
        environment: {
            background: string;
            ambient: number;
            keyIntensity: number;
            keyPosition: [number, number, number];
            exposure?: number | undefined;
            toneMapping?: "linear" | "filmic" | "neutral" | undefined;
            presentation?: "inspection" | "portrait" | undefined;
        };
        geometries: Record<string, {
            type: "box";
            size: [import("../domain/schema.js").ScalarValue, import("../domain/schema.js").ScalarValue, import("../domain/schema.js").ScalarValue];
        } | {
            type: "sphere";
            radius: import("../domain/schema.js").ScalarValue;
            segments?: number | undefined;
        } | {
            type: "organic";
            size: [import("../domain/schema.js").ScalarValue, import("../domain/schema.js").ScalarValue, import("../domain/schema.js").ScalarValue];
            roundness: import("../domain/schema.js").ScalarValue;
            taper: import("../domain/schema.js").ScalarValue;
            bend: import("../domain/schema.js").ScalarValue;
            segments: number;
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
    }[];
}>;
export declare function initProject(directory: string, name?: string): Promise<{
    project: string;
    manifest: {
        schemaVersion: 1;
        name: string;
        activeScene: string;
        scenes: Record<string, string>;
        models: Record<string, string>;
    };
}>;
export declare function createScene(start: string, id: string, name?: string): Promise<{
    id: string;
    path: string;
}>;
export declare function useScene(start: string, id: string): Promise<{
    activeScene: string;
}>;
export declare function commitOperations(start: string, sceneId: string | undefined, ops: Operation[], options?: EditOptions): Promise<{
    scene: string;
    revision: number;
    stateHash: string;
    proposedStateHash: string;
    proposedRevision: number;
    changes: {
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
    changed: boolean;
    dryRun: boolean;
    operations: number;
    stats: import("../application/compiler.js").SceneStats;
}>;
export declare function importModel(start: string, input: unknown, replace?: boolean, options?: EditOptions): Promise<{
    id: string;
    dryRun: boolean;
    models: string[];
    model: {
        geometries: Record<string, {
            type: "box";
            size: [import("../domain/schema.js").ScalarValue, import("../domain/schema.js").ScalarValue, import("../domain/schema.js").ScalarValue];
        } | {
            type: "sphere";
            radius: import("../domain/schema.js").ScalarValue;
            segments?: number | undefined;
        } | {
            type: "organic";
            size: [import("../domain/schema.js").ScalarValue, import("../domain/schema.js").ScalarValue, import("../domain/schema.js").ScalarValue];
            roundness: import("../domain/schema.js").ScalarValue;
            taper: import("../domain/schema.js").ScalarValue;
            bend: import("../domain/schema.js").ScalarValue;
            segments: number;
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
export declare function captureProjectModel(start: string, sceneId: string | undefined, roots: string[], id: string, name?: string, replace?: boolean, options?: EditOptions): Promise<{
    id: string;
    dryRun: boolean;
    models: string[];
    model: {
        geometries: Record<string, {
            type: "box";
            size: [import("../domain/schema.js").ScalarValue, import("../domain/schema.js").ScalarValue, import("../domain/schema.js").ScalarValue];
        } | {
            type: "sphere";
            radius: import("../domain/schema.js").ScalarValue;
            segments?: number | undefined;
        } | {
            type: "organic";
            size: [import("../domain/schema.js").ScalarValue, import("../domain/schema.js").ScalarValue, import("../domain/schema.js").ScalarValue];
            roundness: import("../domain/schema.js").ScalarValue;
            taper: import("../domain/schema.js").ScalarValue;
            bend: import("../domain/schema.js").ScalarValue;
            segments: number;
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
export declare function cloneScene(start: string, sourceId: string | undefined, id: string, name?: string): Promise<{
    id: string;
    path: string;
}>;
export declare function restoreScene(start: string, sceneId: string | undefined, revision: number, expectedRevision?: number): Promise<{
    scene: string;
    restoredFrom: number;
    revision: number;
}>;
