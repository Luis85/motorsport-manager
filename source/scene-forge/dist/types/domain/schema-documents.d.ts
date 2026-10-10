import { z } from 'zod';
export declare const CameraSchema: z.ZodObject<{
    position: z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>;
    target: z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>;
    fov: z.ZodDefault<z.ZodNumber>;
}, z.core.$strict>;
export declare const EnvironmentSchema: z.ZodObject<{
    background: z.ZodDefault<z.ZodString>;
    exposure: z.ZodOptional<z.ZodNumber>;
    toneMapping: z.ZodOptional<z.ZodEnum<{
        linear: "linear";
        filmic: "filmic";
        neutral: "neutral";
    }>>;
    ambient: z.ZodDefault<z.ZodNumber>;
    keyIntensity: z.ZodDefault<z.ZodNumber>;
    keyPosition: z.ZodDefault<z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>>;
}, z.core.$strict>;
export declare const SceneSchema: z.ZodObject<{
    camera: z.ZodOptional<z.ZodObject<{
        position: z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>;
        target: z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>;
        fov: z.ZodDefault<z.ZodNumber>;
    }, z.core.$strict>>;
    environment: z.ZodDefault<z.ZodObject<{
        background: z.ZodDefault<z.ZodString>;
        exposure: z.ZodOptional<z.ZodNumber>;
        toneMapping: z.ZodOptional<z.ZodEnum<{
            linear: "linear";
            filmic: "filmic";
            neutral: "neutral";
        }>>;
        ambient: z.ZodDefault<z.ZodNumber>;
        keyIntensity: z.ZodDefault<z.ZodNumber>;
        keyPosition: z.ZodDefault<z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>>;
    }, z.core.$strict>>;
    geometries: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodDiscriminatedUnion<[z.ZodObject<{
        type: z.ZodLiteral<"box">;
        size: z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"sphere">;
        radius: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
        segments: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"cylinder">;
        radiusTop: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
        radiusBottom: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
        height: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
        segments: z.ZodOptional<z.ZodNumber>;
        openEnded: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"cone">;
        radius: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
        height: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
        segments: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"torus">;
        radius: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
        tube: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
        segments: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"capsule">;
        radius: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
        length: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
        segments: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"plane">;
        size: z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"tube">;
        points: z.ZodArray<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
        radius: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
        tubularSegments: z.ZodDefault<z.ZodNumber>;
        radialSegments: z.ZodDefault<z.ZodNumber>;
        closed: z.ZodDefault<z.ZodBoolean>;
        capEnds: z.ZodDefault<z.ZodBoolean>;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"lathe">;
        points: z.ZodArray<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
        segments: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"extrude">;
        points: z.ZodArray<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
        holes: z.ZodOptional<z.ZodArray<z.ZodArray<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>>>;
        depth: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
        bevel: z.ZodOptional<z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>>;
        bevelSegments: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"mesh">;
        positions: z.ZodArray<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
        indices: z.ZodArray<z.ZodNumber>;
        normals: z.ZodOptional<z.ZodArray<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>>;
        uvs: z.ZodOptional<z.ZodArray<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>>;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"boolean">;
        operation: z.ZodEnum<{
            union: "union";
            subtract: "subtract";
            intersect: "intersect";
        }>;
        left: z.ZodString;
        right: z.ZodString;
        leftTransform: z.ZodOptional<z.ZodObject<{
            position: z.ZodOptional<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
            rotation: z.ZodOptional<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
            scale: z.ZodOptional<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
        }, z.core.$strict>>;
        rightTransform: z.ZodOptional<z.ZodObject<{
            position: z.ZodOptional<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
            rotation: z.ZodOptional<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
            scale: z.ZodOptional<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
        }, z.core.$strict>>;
    }, z.core.$strict>], "type">>>;
    materials: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodObject<{
        color: z.ZodString;
        metalness: z.ZodDefault<z.ZodNumber>;
        roughness: z.ZodDefault<z.ZodNumber>;
        emissive: z.ZodOptional<z.ZodString>;
        emissiveIntensity: z.ZodOptional<z.ZodNumber>;
        opacity: z.ZodDefault<z.ZodNumber>;
        doubleSided: z.ZodDefault<z.ZodBoolean>;
        flatShading: z.ZodDefault<z.ZodBoolean>;
        shading: z.ZodOptional<z.ZodEnum<{
            standard: "standard";
            unlit: "unlit";
        }>>;
    }, z.core.$strict>>>;
    nodes: z.ZodDefault<z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
        type: z.ZodLiteral<"light">;
        light: z.ZodEnum<{
            point: "point";
            spot: "spot";
            directional: "directional";
        }>;
        color: z.ZodDefault<z.ZodString>;
        intensity: z.ZodDefault<z.ZodNumber>;
        distance: z.ZodDefault<z.ZodNumber>;
        angle: z.ZodDefault<z.ZodNumber>;
        penumbra: z.ZodDefault<z.ZodNumber>;
        castShadow: z.ZodDefault<z.ZodBoolean>;
        id: z.ZodString;
        name: z.ZodOptional<z.ZodString>;
        parent: z.ZodOptional<z.ZodString>;
        transform: z.ZodOptional<z.ZodObject<{
            position: z.ZodOptional<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
            rotation: z.ZodOptional<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
            scale: z.ZodOptional<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
        }, z.core.$strict>>;
        visible: z.ZodDefault<z.ZodBoolean>;
        tags: z.ZodDefault<z.ZodArray<z.ZodString>>;
        pattern: z.ZodOptional<z.ZodDiscriminatedUnion<[z.ZodObject<{
            type: z.ZodLiteral<"path">;
            points: z.ZodArray<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
            orient: z.ZodDefault<z.ZodEnum<{
                none: "none";
                yaw: "yaw";
            }>>;
        }, z.core.$strict>, z.ZodObject<{
            type: z.ZodLiteral<"linear">;
            count: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
            step: z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>;
        }, z.core.$strict>, z.ZodObject<{
            type: z.ZodLiteral<"radial">;
            count: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
            radius: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
            startAngle: z.ZodDefault<z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>>;
            sweep: z.ZodDefault<z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>>;
            orient: z.ZodDefault<z.ZodBoolean>;
        }, z.core.$strict>, z.ZodObject<{
            type: z.ZodLiteral<"grid">;
            counts: z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>;
            step: z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>;
            centered: z.ZodDefault<z.ZodBoolean>;
        }, z.core.$strict>], "type">>;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"group">;
        id: z.ZodString;
        name: z.ZodOptional<z.ZodString>;
        parent: z.ZodOptional<z.ZodString>;
        transform: z.ZodOptional<z.ZodObject<{
            position: z.ZodOptional<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
            rotation: z.ZodOptional<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
            scale: z.ZodOptional<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
        }, z.core.$strict>>;
        visible: z.ZodDefault<z.ZodBoolean>;
        tags: z.ZodDefault<z.ZodArray<z.ZodString>>;
        pattern: z.ZodOptional<z.ZodDiscriminatedUnion<[z.ZodObject<{
            type: z.ZodLiteral<"path">;
            points: z.ZodArray<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
            orient: z.ZodDefault<z.ZodEnum<{
                none: "none";
                yaw: "yaw";
            }>>;
        }, z.core.$strict>, z.ZodObject<{
            type: z.ZodLiteral<"linear">;
            count: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
            step: z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>;
        }, z.core.$strict>, z.ZodObject<{
            type: z.ZodLiteral<"radial">;
            count: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
            radius: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
            startAngle: z.ZodDefault<z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>>;
            sweep: z.ZodDefault<z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>>;
            orient: z.ZodDefault<z.ZodBoolean>;
        }, z.core.$strict>, z.ZodObject<{
            type: z.ZodLiteral<"grid">;
            counts: z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>;
            step: z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>;
            centered: z.ZodDefault<z.ZodBoolean>;
        }, z.core.$strict>], "type">>;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"mesh">;
        geometry: z.ZodString;
        material: z.ZodString;
        id: z.ZodString;
        name: z.ZodOptional<z.ZodString>;
        parent: z.ZodOptional<z.ZodString>;
        transform: z.ZodOptional<z.ZodObject<{
            position: z.ZodOptional<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
            rotation: z.ZodOptional<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
            scale: z.ZodOptional<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
        }, z.core.$strict>>;
        visible: z.ZodDefault<z.ZodBoolean>;
        tags: z.ZodDefault<z.ZodArray<z.ZodString>>;
        pattern: z.ZodOptional<z.ZodDiscriminatedUnion<[z.ZodObject<{
            type: z.ZodLiteral<"path">;
            points: z.ZodArray<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
            orient: z.ZodDefault<z.ZodEnum<{
                none: "none";
                yaw: "yaw";
            }>>;
        }, z.core.$strict>, z.ZodObject<{
            type: z.ZodLiteral<"linear">;
            count: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
            step: z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>;
        }, z.core.$strict>, z.ZodObject<{
            type: z.ZodLiteral<"radial">;
            count: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
            radius: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
            startAngle: z.ZodDefault<z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>>;
            sweep: z.ZodDefault<z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>>;
            orient: z.ZodDefault<z.ZodBoolean>;
        }, z.core.$strict>, z.ZodObject<{
            type: z.ZodLiteral<"grid">;
            counts: z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>;
            step: z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>;
            centered: z.ZodDefault<z.ZodBoolean>;
        }, z.core.$strict>], "type">>;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"model">;
        model: z.ZodString;
        rig: z.ZodOptional<z.ZodObject<{
            joints: z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                parent: z.ZodOptional<z.ZodString>;
                position: z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>;
                rotation: z.ZodDefault<z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>>;
            }, z.core.$strict>>;
            binding: z.ZodDefault<z.ZodEnum<{
                rigid: "rigid";
                smooth: "smooth";
            }>>;
            bindings: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodString>>;
            pose: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>>>;
            clips: z.ZodDefault<z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                duration: z.ZodNumber;
                tracks: z.ZodArray<z.ZodObject<{
                    joint: z.ZodString;
                    keyframes: z.ZodArray<z.ZodObject<{
                        time: z.ZodNumber;
                        rotation: z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>;
                    }, z.core.$strict>>;
                }, z.core.$strict>>;
            }, z.core.$strict>>>;
        }, z.core.$strict>>;
        parameters: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>>>;
        materialOverrides: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodString>>;
        id: z.ZodString;
        name: z.ZodOptional<z.ZodString>;
        parent: z.ZodOptional<z.ZodString>;
        transform: z.ZodOptional<z.ZodObject<{
            position: z.ZodOptional<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
            rotation: z.ZodOptional<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
            scale: z.ZodOptional<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
        }, z.core.$strict>>;
        visible: z.ZodDefault<z.ZodBoolean>;
        tags: z.ZodDefault<z.ZodArray<z.ZodString>>;
        pattern: z.ZodOptional<z.ZodDiscriminatedUnion<[z.ZodObject<{
            type: z.ZodLiteral<"path">;
            points: z.ZodArray<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
            orient: z.ZodDefault<z.ZodEnum<{
                none: "none";
                yaw: "yaw";
            }>>;
        }, z.core.$strict>, z.ZodObject<{
            type: z.ZodLiteral<"linear">;
            count: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
            step: z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>;
        }, z.core.$strict>, z.ZodObject<{
            type: z.ZodLiteral<"radial">;
            count: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
            radius: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
            startAngle: z.ZodDefault<z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>>;
            sweep: z.ZodDefault<z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>>;
            orient: z.ZodDefault<z.ZodBoolean>;
        }, z.core.$strict>, z.ZodObject<{
            type: z.ZodLiteral<"grid">;
            counts: z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>;
            step: z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>;
            centered: z.ZodDefault<z.ZodBoolean>;
        }, z.core.$strict>], "type">>;
    }, z.core.$strict>], "type">>>;
    schemaVersion: z.ZodLiteral<1>;
    kind: z.ZodLiteral<"scene">;
    id: z.ZodString;
    name: z.ZodString;
    revision: z.ZodDefault<z.ZodNumber>;
    units: z.ZodDefault<z.ZodLiteral<"meters">>;
    parameters: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodNumber>>;
}, z.core.$strict>;
export declare const ModelSchema: z.ZodObject<{
    geometries: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodDiscriminatedUnion<[z.ZodObject<{
        type: z.ZodLiteral<"box">;
        size: z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"sphere">;
        radius: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
        segments: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"cylinder">;
        radiusTop: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
        radiusBottom: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
        height: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
        segments: z.ZodOptional<z.ZodNumber>;
        openEnded: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"cone">;
        radius: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
        height: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
        segments: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"torus">;
        radius: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
        tube: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
        segments: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"capsule">;
        radius: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
        length: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
        segments: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"plane">;
        size: z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"tube">;
        points: z.ZodArray<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
        radius: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
        tubularSegments: z.ZodDefault<z.ZodNumber>;
        radialSegments: z.ZodDefault<z.ZodNumber>;
        closed: z.ZodDefault<z.ZodBoolean>;
        capEnds: z.ZodDefault<z.ZodBoolean>;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"lathe">;
        points: z.ZodArray<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
        segments: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"extrude">;
        points: z.ZodArray<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
        holes: z.ZodOptional<z.ZodArray<z.ZodArray<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>>>;
        depth: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
        bevel: z.ZodOptional<z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>>;
        bevelSegments: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"mesh">;
        positions: z.ZodArray<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
        indices: z.ZodArray<z.ZodNumber>;
        normals: z.ZodOptional<z.ZodArray<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>>;
        uvs: z.ZodOptional<z.ZodArray<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>>;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"boolean">;
        operation: z.ZodEnum<{
            union: "union";
            subtract: "subtract";
            intersect: "intersect";
        }>;
        left: z.ZodString;
        right: z.ZodString;
        leftTransform: z.ZodOptional<z.ZodObject<{
            position: z.ZodOptional<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
            rotation: z.ZodOptional<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
            scale: z.ZodOptional<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
        }, z.core.$strict>>;
        rightTransform: z.ZodOptional<z.ZodObject<{
            position: z.ZodOptional<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
            rotation: z.ZodOptional<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
            scale: z.ZodOptional<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
        }, z.core.$strict>>;
    }, z.core.$strict>], "type">>>;
    materials: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodObject<{
        color: z.ZodString;
        metalness: z.ZodDefault<z.ZodNumber>;
        roughness: z.ZodDefault<z.ZodNumber>;
        emissive: z.ZodOptional<z.ZodString>;
        emissiveIntensity: z.ZodOptional<z.ZodNumber>;
        opacity: z.ZodDefault<z.ZodNumber>;
        doubleSided: z.ZodDefault<z.ZodBoolean>;
        flatShading: z.ZodDefault<z.ZodBoolean>;
        shading: z.ZodOptional<z.ZodEnum<{
            standard: "standard";
            unlit: "unlit";
        }>>;
    }, z.core.$strict>>>;
    nodes: z.ZodDefault<z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
        type: z.ZodLiteral<"light">;
        light: z.ZodEnum<{
            point: "point";
            spot: "spot";
            directional: "directional";
        }>;
        color: z.ZodDefault<z.ZodString>;
        intensity: z.ZodDefault<z.ZodNumber>;
        distance: z.ZodDefault<z.ZodNumber>;
        angle: z.ZodDefault<z.ZodNumber>;
        penumbra: z.ZodDefault<z.ZodNumber>;
        castShadow: z.ZodDefault<z.ZodBoolean>;
        id: z.ZodString;
        name: z.ZodOptional<z.ZodString>;
        parent: z.ZodOptional<z.ZodString>;
        transform: z.ZodOptional<z.ZodObject<{
            position: z.ZodOptional<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
            rotation: z.ZodOptional<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
            scale: z.ZodOptional<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
        }, z.core.$strict>>;
        visible: z.ZodDefault<z.ZodBoolean>;
        tags: z.ZodDefault<z.ZodArray<z.ZodString>>;
        pattern: z.ZodOptional<z.ZodDiscriminatedUnion<[z.ZodObject<{
            type: z.ZodLiteral<"path">;
            points: z.ZodArray<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
            orient: z.ZodDefault<z.ZodEnum<{
                none: "none";
                yaw: "yaw";
            }>>;
        }, z.core.$strict>, z.ZodObject<{
            type: z.ZodLiteral<"linear">;
            count: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
            step: z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>;
        }, z.core.$strict>, z.ZodObject<{
            type: z.ZodLiteral<"radial">;
            count: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
            radius: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
            startAngle: z.ZodDefault<z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>>;
            sweep: z.ZodDefault<z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>>;
            orient: z.ZodDefault<z.ZodBoolean>;
        }, z.core.$strict>, z.ZodObject<{
            type: z.ZodLiteral<"grid">;
            counts: z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>;
            step: z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>;
            centered: z.ZodDefault<z.ZodBoolean>;
        }, z.core.$strict>], "type">>;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"group">;
        id: z.ZodString;
        name: z.ZodOptional<z.ZodString>;
        parent: z.ZodOptional<z.ZodString>;
        transform: z.ZodOptional<z.ZodObject<{
            position: z.ZodOptional<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
            rotation: z.ZodOptional<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
            scale: z.ZodOptional<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
        }, z.core.$strict>>;
        visible: z.ZodDefault<z.ZodBoolean>;
        tags: z.ZodDefault<z.ZodArray<z.ZodString>>;
        pattern: z.ZodOptional<z.ZodDiscriminatedUnion<[z.ZodObject<{
            type: z.ZodLiteral<"path">;
            points: z.ZodArray<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
            orient: z.ZodDefault<z.ZodEnum<{
                none: "none";
                yaw: "yaw";
            }>>;
        }, z.core.$strict>, z.ZodObject<{
            type: z.ZodLiteral<"linear">;
            count: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
            step: z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>;
        }, z.core.$strict>, z.ZodObject<{
            type: z.ZodLiteral<"radial">;
            count: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
            radius: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
            startAngle: z.ZodDefault<z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>>;
            sweep: z.ZodDefault<z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>>;
            orient: z.ZodDefault<z.ZodBoolean>;
        }, z.core.$strict>, z.ZodObject<{
            type: z.ZodLiteral<"grid">;
            counts: z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>;
            step: z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>;
            centered: z.ZodDefault<z.ZodBoolean>;
        }, z.core.$strict>], "type">>;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"mesh">;
        geometry: z.ZodString;
        material: z.ZodString;
        id: z.ZodString;
        name: z.ZodOptional<z.ZodString>;
        parent: z.ZodOptional<z.ZodString>;
        transform: z.ZodOptional<z.ZodObject<{
            position: z.ZodOptional<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
            rotation: z.ZodOptional<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
            scale: z.ZodOptional<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
        }, z.core.$strict>>;
        visible: z.ZodDefault<z.ZodBoolean>;
        tags: z.ZodDefault<z.ZodArray<z.ZodString>>;
        pattern: z.ZodOptional<z.ZodDiscriminatedUnion<[z.ZodObject<{
            type: z.ZodLiteral<"path">;
            points: z.ZodArray<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
            orient: z.ZodDefault<z.ZodEnum<{
                none: "none";
                yaw: "yaw";
            }>>;
        }, z.core.$strict>, z.ZodObject<{
            type: z.ZodLiteral<"linear">;
            count: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
            step: z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>;
        }, z.core.$strict>, z.ZodObject<{
            type: z.ZodLiteral<"radial">;
            count: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
            radius: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
            startAngle: z.ZodDefault<z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>>;
            sweep: z.ZodDefault<z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>>;
            orient: z.ZodDefault<z.ZodBoolean>;
        }, z.core.$strict>, z.ZodObject<{
            type: z.ZodLiteral<"grid">;
            counts: z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>;
            step: z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>;
            centered: z.ZodDefault<z.ZodBoolean>;
        }, z.core.$strict>], "type">>;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"model">;
        model: z.ZodString;
        rig: z.ZodOptional<z.ZodObject<{
            joints: z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                parent: z.ZodOptional<z.ZodString>;
                position: z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>;
                rotation: z.ZodDefault<z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>>;
            }, z.core.$strict>>;
            binding: z.ZodDefault<z.ZodEnum<{
                rigid: "rigid";
                smooth: "smooth";
            }>>;
            bindings: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodString>>;
            pose: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>>>;
            clips: z.ZodDefault<z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                duration: z.ZodNumber;
                tracks: z.ZodArray<z.ZodObject<{
                    joint: z.ZodString;
                    keyframes: z.ZodArray<z.ZodObject<{
                        time: z.ZodNumber;
                        rotation: z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>;
                    }, z.core.$strict>>;
                }, z.core.$strict>>;
            }, z.core.$strict>>>;
        }, z.core.$strict>>;
        parameters: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>>>;
        materialOverrides: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodString>>;
        id: z.ZodString;
        name: z.ZodOptional<z.ZodString>;
        parent: z.ZodOptional<z.ZodString>;
        transform: z.ZodOptional<z.ZodObject<{
            position: z.ZodOptional<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
            rotation: z.ZodOptional<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
            scale: z.ZodOptional<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
        }, z.core.$strict>>;
        visible: z.ZodDefault<z.ZodBoolean>;
        tags: z.ZodDefault<z.ZodArray<z.ZodString>>;
        pattern: z.ZodOptional<z.ZodDiscriminatedUnion<[z.ZodObject<{
            type: z.ZodLiteral<"path">;
            points: z.ZodArray<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
            orient: z.ZodDefault<z.ZodEnum<{
                none: "none";
                yaw: "yaw";
            }>>;
        }, z.core.$strict>, z.ZodObject<{
            type: z.ZodLiteral<"linear">;
            count: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
            step: z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>;
        }, z.core.$strict>, z.ZodObject<{
            type: z.ZodLiteral<"radial">;
            count: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
            radius: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
            startAngle: z.ZodDefault<z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>>;
            sweep: z.ZodDefault<z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>>;
            orient: z.ZodDefault<z.ZodBoolean>;
        }, z.core.$strict>, z.ZodObject<{
            type: z.ZodLiteral<"grid">;
            counts: z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>;
            step: z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>;
            centered: z.ZodDefault<z.ZodBoolean>;
        }, z.core.$strict>], "type">>;
    }, z.core.$strict>], "type">>>;
    schemaVersion: z.ZodLiteral<1>;
    kind: z.ZodLiteral<"model">;
    id: z.ZodString;
    category: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    name: z.ZodString;
    parameters: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodObject<{
        default: z.ZodNumber;
        min: z.ZodOptional<z.ZodNumber>;
        max: z.ZodOptional<z.ZodNumber>;
        description: z.ZodOptional<z.ZodString>;
        integer: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strict>>>;
}, z.core.$strict>;
export declare const ProjectSchema: z.ZodObject<{
    schemaVersion: z.ZodLiteral<1>;
    name: z.ZodString;
    activeScene: z.ZodString;
    scenes: z.ZodRecord<z.ZodString, z.ZodString>;
    models: z.ZodRecord<z.ZodString, z.ZodString>;
}, z.core.$strict>;
export declare const ModelBundleSchema: z.ZodObject<{
    schemaVersion: z.ZodLiteral<1>;
    kind: z.ZodLiteral<"model-bundle">;
    entry: z.ZodString;
    models: z.ZodRecord<z.ZodString, z.ZodObject<{
        geometries: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodDiscriminatedUnion<[z.ZodObject<{
            type: z.ZodLiteral<"box">;
            size: z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>;
        }, z.core.$strict>, z.ZodObject<{
            type: z.ZodLiteral<"sphere">;
            radius: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
            segments: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strict>, z.ZodObject<{
            type: z.ZodLiteral<"cylinder">;
            radiusTop: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
            radiusBottom: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
            height: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
            segments: z.ZodOptional<z.ZodNumber>;
            openEnded: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strict>, z.ZodObject<{
            type: z.ZodLiteral<"cone">;
            radius: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
            height: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
            segments: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strict>, z.ZodObject<{
            type: z.ZodLiteral<"torus">;
            radius: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
            tube: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
            segments: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strict>, z.ZodObject<{
            type: z.ZodLiteral<"capsule">;
            radius: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
            length: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
            segments: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strict>, z.ZodObject<{
            type: z.ZodLiteral<"plane">;
            size: z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>;
        }, z.core.$strict>, z.ZodObject<{
            type: z.ZodLiteral<"tube">;
            points: z.ZodArray<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
            radius: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
            tubularSegments: z.ZodDefault<z.ZodNumber>;
            radialSegments: z.ZodDefault<z.ZodNumber>;
            closed: z.ZodDefault<z.ZodBoolean>;
            capEnds: z.ZodDefault<z.ZodBoolean>;
        }, z.core.$strict>, z.ZodObject<{
            type: z.ZodLiteral<"lathe">;
            points: z.ZodArray<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
            segments: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strict>, z.ZodObject<{
            type: z.ZodLiteral<"extrude">;
            points: z.ZodArray<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
            holes: z.ZodOptional<z.ZodArray<z.ZodArray<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>>>;
            depth: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
            bevel: z.ZodOptional<z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>>;
            bevelSegments: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strict>, z.ZodObject<{
            type: z.ZodLiteral<"mesh">;
            positions: z.ZodArray<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
            indices: z.ZodArray<z.ZodNumber>;
            normals: z.ZodOptional<z.ZodArray<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>>;
            uvs: z.ZodOptional<z.ZodArray<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>>;
        }, z.core.$strict>, z.ZodObject<{
            type: z.ZodLiteral<"boolean">;
            operation: z.ZodEnum<{
                union: "union";
                subtract: "subtract";
                intersect: "intersect";
            }>;
            left: z.ZodString;
            right: z.ZodString;
            leftTransform: z.ZodOptional<z.ZodObject<{
                position: z.ZodOptional<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
                rotation: z.ZodOptional<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
                scale: z.ZodOptional<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
            }, z.core.$strict>>;
            rightTransform: z.ZodOptional<z.ZodObject<{
                position: z.ZodOptional<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
                rotation: z.ZodOptional<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
                scale: z.ZodOptional<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
            }, z.core.$strict>>;
        }, z.core.$strict>], "type">>>;
        materials: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodObject<{
            color: z.ZodString;
            metalness: z.ZodDefault<z.ZodNumber>;
            roughness: z.ZodDefault<z.ZodNumber>;
            emissive: z.ZodOptional<z.ZodString>;
            emissiveIntensity: z.ZodOptional<z.ZodNumber>;
            opacity: z.ZodDefault<z.ZodNumber>;
            doubleSided: z.ZodDefault<z.ZodBoolean>;
            flatShading: z.ZodDefault<z.ZodBoolean>;
            shading: z.ZodOptional<z.ZodEnum<{
                standard: "standard";
                unlit: "unlit";
            }>>;
        }, z.core.$strict>>>;
        nodes: z.ZodDefault<z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
            type: z.ZodLiteral<"light">;
            light: z.ZodEnum<{
                point: "point";
                spot: "spot";
                directional: "directional";
            }>;
            color: z.ZodDefault<z.ZodString>;
            intensity: z.ZodDefault<z.ZodNumber>;
            distance: z.ZodDefault<z.ZodNumber>;
            angle: z.ZodDefault<z.ZodNumber>;
            penumbra: z.ZodDefault<z.ZodNumber>;
            castShadow: z.ZodDefault<z.ZodBoolean>;
            id: z.ZodString;
            name: z.ZodOptional<z.ZodString>;
            parent: z.ZodOptional<z.ZodString>;
            transform: z.ZodOptional<z.ZodObject<{
                position: z.ZodOptional<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
                rotation: z.ZodOptional<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
                scale: z.ZodOptional<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
            }, z.core.$strict>>;
            visible: z.ZodDefault<z.ZodBoolean>;
            tags: z.ZodDefault<z.ZodArray<z.ZodString>>;
            pattern: z.ZodOptional<z.ZodDiscriminatedUnion<[z.ZodObject<{
                type: z.ZodLiteral<"path">;
                points: z.ZodArray<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
                orient: z.ZodDefault<z.ZodEnum<{
                    none: "none";
                    yaw: "yaw";
                }>>;
            }, z.core.$strict>, z.ZodObject<{
                type: z.ZodLiteral<"linear">;
                count: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
                step: z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>;
            }, z.core.$strict>, z.ZodObject<{
                type: z.ZodLiteral<"radial">;
                count: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
                radius: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
                startAngle: z.ZodDefault<z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>>;
                sweep: z.ZodDefault<z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>>;
                orient: z.ZodDefault<z.ZodBoolean>;
            }, z.core.$strict>, z.ZodObject<{
                type: z.ZodLiteral<"grid">;
                counts: z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>;
                step: z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>;
                centered: z.ZodDefault<z.ZodBoolean>;
            }, z.core.$strict>], "type">>;
        }, z.core.$strict>, z.ZodObject<{
            type: z.ZodLiteral<"group">;
            id: z.ZodString;
            name: z.ZodOptional<z.ZodString>;
            parent: z.ZodOptional<z.ZodString>;
            transform: z.ZodOptional<z.ZodObject<{
                position: z.ZodOptional<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
                rotation: z.ZodOptional<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
                scale: z.ZodOptional<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
            }, z.core.$strict>>;
            visible: z.ZodDefault<z.ZodBoolean>;
            tags: z.ZodDefault<z.ZodArray<z.ZodString>>;
            pattern: z.ZodOptional<z.ZodDiscriminatedUnion<[z.ZodObject<{
                type: z.ZodLiteral<"path">;
                points: z.ZodArray<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
                orient: z.ZodDefault<z.ZodEnum<{
                    none: "none";
                    yaw: "yaw";
                }>>;
            }, z.core.$strict>, z.ZodObject<{
                type: z.ZodLiteral<"linear">;
                count: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
                step: z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>;
            }, z.core.$strict>, z.ZodObject<{
                type: z.ZodLiteral<"radial">;
                count: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
                radius: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
                startAngle: z.ZodDefault<z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>>;
                sweep: z.ZodDefault<z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>>;
                orient: z.ZodDefault<z.ZodBoolean>;
            }, z.core.$strict>, z.ZodObject<{
                type: z.ZodLiteral<"grid">;
                counts: z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>;
                step: z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>;
                centered: z.ZodDefault<z.ZodBoolean>;
            }, z.core.$strict>], "type">>;
        }, z.core.$strict>, z.ZodObject<{
            type: z.ZodLiteral<"mesh">;
            geometry: z.ZodString;
            material: z.ZodString;
            id: z.ZodString;
            name: z.ZodOptional<z.ZodString>;
            parent: z.ZodOptional<z.ZodString>;
            transform: z.ZodOptional<z.ZodObject<{
                position: z.ZodOptional<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
                rotation: z.ZodOptional<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
                scale: z.ZodOptional<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
            }, z.core.$strict>>;
            visible: z.ZodDefault<z.ZodBoolean>;
            tags: z.ZodDefault<z.ZodArray<z.ZodString>>;
            pattern: z.ZodOptional<z.ZodDiscriminatedUnion<[z.ZodObject<{
                type: z.ZodLiteral<"path">;
                points: z.ZodArray<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
                orient: z.ZodDefault<z.ZodEnum<{
                    none: "none";
                    yaw: "yaw";
                }>>;
            }, z.core.$strict>, z.ZodObject<{
                type: z.ZodLiteral<"linear">;
                count: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
                step: z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>;
            }, z.core.$strict>, z.ZodObject<{
                type: z.ZodLiteral<"radial">;
                count: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
                radius: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
                startAngle: z.ZodDefault<z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>>;
                sweep: z.ZodDefault<z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>>;
                orient: z.ZodDefault<z.ZodBoolean>;
            }, z.core.$strict>, z.ZodObject<{
                type: z.ZodLiteral<"grid">;
                counts: z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>;
                step: z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>;
                centered: z.ZodDefault<z.ZodBoolean>;
            }, z.core.$strict>], "type">>;
        }, z.core.$strict>, z.ZodObject<{
            type: z.ZodLiteral<"model">;
            model: z.ZodString;
            rig: z.ZodOptional<z.ZodObject<{
                joints: z.ZodArray<z.ZodObject<{
                    id: z.ZodString;
                    parent: z.ZodOptional<z.ZodString>;
                    position: z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>;
                    rotation: z.ZodDefault<z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>>;
                }, z.core.$strict>>;
                binding: z.ZodDefault<z.ZodEnum<{
                    rigid: "rigid";
                    smooth: "smooth";
                }>>;
                bindings: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodString>>;
                pose: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>>>;
                clips: z.ZodDefault<z.ZodArray<z.ZodObject<{
                    id: z.ZodString;
                    duration: z.ZodNumber;
                    tracks: z.ZodArray<z.ZodObject<{
                        joint: z.ZodString;
                        keyframes: z.ZodArray<z.ZodObject<{
                            time: z.ZodNumber;
                            rotation: z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>;
                        }, z.core.$strict>>;
                    }, z.core.$strict>>;
                }, z.core.$strict>>>;
            }, z.core.$strict>>;
            parameters: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>>>;
            materialOverrides: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodString>>;
            id: z.ZodString;
            name: z.ZodOptional<z.ZodString>;
            parent: z.ZodOptional<z.ZodString>;
            transform: z.ZodOptional<z.ZodObject<{
                position: z.ZodOptional<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
                rotation: z.ZodOptional<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
                scale: z.ZodOptional<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
            }, z.core.$strict>>;
            visible: z.ZodDefault<z.ZodBoolean>;
            tags: z.ZodDefault<z.ZodArray<z.ZodString>>;
            pattern: z.ZodOptional<z.ZodDiscriminatedUnion<[z.ZodObject<{
                type: z.ZodLiteral<"path">;
                points: z.ZodArray<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
                orient: z.ZodDefault<z.ZodEnum<{
                    none: "none";
                    yaw: "yaw";
                }>>;
            }, z.core.$strict>, z.ZodObject<{
                type: z.ZodLiteral<"linear">;
                count: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
                step: z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>;
            }, z.core.$strict>, z.ZodObject<{
                type: z.ZodLiteral<"radial">;
                count: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
                radius: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
                startAngle: z.ZodDefault<z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>>;
                sweep: z.ZodDefault<z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>>;
                orient: z.ZodDefault<z.ZodBoolean>;
            }, z.core.$strict>, z.ZodObject<{
                type: z.ZodLiteral<"grid">;
                counts: z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>;
                step: z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>;
                centered: z.ZodDefault<z.ZodBoolean>;
            }, z.core.$strict>], "type">>;
        }, z.core.$strict>], "type">>>;
        schemaVersion: z.ZodLiteral<1>;
        kind: z.ZodLiteral<"model">;
        id: z.ZodString;
        category: z.ZodOptional<z.ZodString>;
        description: z.ZodOptional<z.ZodString>;
        name: z.ZodString;
        parameters: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodObject<{
            default: z.ZodNumber;
            min: z.ZodOptional<z.ZodNumber>;
            max: z.ZodOptional<z.ZodNumber>;
            description: z.ZodOptional<z.ZodString>;
            integer: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strict>>>;
    }, z.core.$strict>>;
}, z.core.$strict>;
export declare const SceneBundleSchema: z.ZodObject<{
    schemaVersion: z.ZodLiteral<1>;
    kind: z.ZodLiteral<"scene-bundle">;
    scene: z.ZodObject<{
        camera: z.ZodOptional<z.ZodObject<{
            position: z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>;
            target: z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>;
            fov: z.ZodDefault<z.ZodNumber>;
        }, z.core.$strict>>;
        environment: z.ZodDefault<z.ZodObject<{
            background: z.ZodDefault<z.ZodString>;
            exposure: z.ZodOptional<z.ZodNumber>;
            toneMapping: z.ZodOptional<z.ZodEnum<{
                linear: "linear";
                filmic: "filmic";
                neutral: "neutral";
            }>>;
            ambient: z.ZodDefault<z.ZodNumber>;
            keyIntensity: z.ZodDefault<z.ZodNumber>;
            keyPosition: z.ZodDefault<z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>>;
        }, z.core.$strict>>;
        geometries: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodDiscriminatedUnion<[z.ZodObject<{
            type: z.ZodLiteral<"box">;
            size: z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>;
        }, z.core.$strict>, z.ZodObject<{
            type: z.ZodLiteral<"sphere">;
            radius: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
            segments: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strict>, z.ZodObject<{
            type: z.ZodLiteral<"cylinder">;
            radiusTop: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
            radiusBottom: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
            height: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
            segments: z.ZodOptional<z.ZodNumber>;
            openEnded: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strict>, z.ZodObject<{
            type: z.ZodLiteral<"cone">;
            radius: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
            height: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
            segments: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strict>, z.ZodObject<{
            type: z.ZodLiteral<"torus">;
            radius: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
            tube: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
            segments: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strict>, z.ZodObject<{
            type: z.ZodLiteral<"capsule">;
            radius: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
            length: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
            segments: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strict>, z.ZodObject<{
            type: z.ZodLiteral<"plane">;
            size: z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>;
        }, z.core.$strict>, z.ZodObject<{
            type: z.ZodLiteral<"tube">;
            points: z.ZodArray<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
            radius: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
            tubularSegments: z.ZodDefault<z.ZodNumber>;
            radialSegments: z.ZodDefault<z.ZodNumber>;
            closed: z.ZodDefault<z.ZodBoolean>;
            capEnds: z.ZodDefault<z.ZodBoolean>;
        }, z.core.$strict>, z.ZodObject<{
            type: z.ZodLiteral<"lathe">;
            points: z.ZodArray<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
            segments: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strict>, z.ZodObject<{
            type: z.ZodLiteral<"extrude">;
            points: z.ZodArray<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
            holes: z.ZodOptional<z.ZodArray<z.ZodArray<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>>>;
            depth: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
            bevel: z.ZodOptional<z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>>;
            bevelSegments: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strict>, z.ZodObject<{
            type: z.ZodLiteral<"mesh">;
            positions: z.ZodArray<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
            indices: z.ZodArray<z.ZodNumber>;
            normals: z.ZodOptional<z.ZodArray<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>>;
            uvs: z.ZodOptional<z.ZodArray<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>>;
        }, z.core.$strict>, z.ZodObject<{
            type: z.ZodLiteral<"boolean">;
            operation: z.ZodEnum<{
                union: "union";
                subtract: "subtract";
                intersect: "intersect";
            }>;
            left: z.ZodString;
            right: z.ZodString;
            leftTransform: z.ZodOptional<z.ZodObject<{
                position: z.ZodOptional<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
                rotation: z.ZodOptional<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
                scale: z.ZodOptional<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
            }, z.core.$strict>>;
            rightTransform: z.ZodOptional<z.ZodObject<{
                position: z.ZodOptional<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
                rotation: z.ZodOptional<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
                scale: z.ZodOptional<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
            }, z.core.$strict>>;
        }, z.core.$strict>], "type">>>;
        materials: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodObject<{
            color: z.ZodString;
            metalness: z.ZodDefault<z.ZodNumber>;
            roughness: z.ZodDefault<z.ZodNumber>;
            emissive: z.ZodOptional<z.ZodString>;
            emissiveIntensity: z.ZodOptional<z.ZodNumber>;
            opacity: z.ZodDefault<z.ZodNumber>;
            doubleSided: z.ZodDefault<z.ZodBoolean>;
            flatShading: z.ZodDefault<z.ZodBoolean>;
            shading: z.ZodOptional<z.ZodEnum<{
                standard: "standard";
                unlit: "unlit";
            }>>;
        }, z.core.$strict>>>;
        nodes: z.ZodDefault<z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
            type: z.ZodLiteral<"light">;
            light: z.ZodEnum<{
                point: "point";
                spot: "spot";
                directional: "directional";
            }>;
            color: z.ZodDefault<z.ZodString>;
            intensity: z.ZodDefault<z.ZodNumber>;
            distance: z.ZodDefault<z.ZodNumber>;
            angle: z.ZodDefault<z.ZodNumber>;
            penumbra: z.ZodDefault<z.ZodNumber>;
            castShadow: z.ZodDefault<z.ZodBoolean>;
            id: z.ZodString;
            name: z.ZodOptional<z.ZodString>;
            parent: z.ZodOptional<z.ZodString>;
            transform: z.ZodOptional<z.ZodObject<{
                position: z.ZodOptional<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
                rotation: z.ZodOptional<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
                scale: z.ZodOptional<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
            }, z.core.$strict>>;
            visible: z.ZodDefault<z.ZodBoolean>;
            tags: z.ZodDefault<z.ZodArray<z.ZodString>>;
            pattern: z.ZodOptional<z.ZodDiscriminatedUnion<[z.ZodObject<{
                type: z.ZodLiteral<"path">;
                points: z.ZodArray<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
                orient: z.ZodDefault<z.ZodEnum<{
                    none: "none";
                    yaw: "yaw";
                }>>;
            }, z.core.$strict>, z.ZodObject<{
                type: z.ZodLiteral<"linear">;
                count: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
                step: z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>;
            }, z.core.$strict>, z.ZodObject<{
                type: z.ZodLiteral<"radial">;
                count: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
                radius: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
                startAngle: z.ZodDefault<z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>>;
                sweep: z.ZodDefault<z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>>;
                orient: z.ZodDefault<z.ZodBoolean>;
            }, z.core.$strict>, z.ZodObject<{
                type: z.ZodLiteral<"grid">;
                counts: z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>;
                step: z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>;
                centered: z.ZodDefault<z.ZodBoolean>;
            }, z.core.$strict>], "type">>;
        }, z.core.$strict>, z.ZodObject<{
            type: z.ZodLiteral<"group">;
            id: z.ZodString;
            name: z.ZodOptional<z.ZodString>;
            parent: z.ZodOptional<z.ZodString>;
            transform: z.ZodOptional<z.ZodObject<{
                position: z.ZodOptional<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
                rotation: z.ZodOptional<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
                scale: z.ZodOptional<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
            }, z.core.$strict>>;
            visible: z.ZodDefault<z.ZodBoolean>;
            tags: z.ZodDefault<z.ZodArray<z.ZodString>>;
            pattern: z.ZodOptional<z.ZodDiscriminatedUnion<[z.ZodObject<{
                type: z.ZodLiteral<"path">;
                points: z.ZodArray<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
                orient: z.ZodDefault<z.ZodEnum<{
                    none: "none";
                    yaw: "yaw";
                }>>;
            }, z.core.$strict>, z.ZodObject<{
                type: z.ZodLiteral<"linear">;
                count: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
                step: z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>;
            }, z.core.$strict>, z.ZodObject<{
                type: z.ZodLiteral<"radial">;
                count: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
                radius: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
                startAngle: z.ZodDefault<z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>>;
                sweep: z.ZodDefault<z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>>;
                orient: z.ZodDefault<z.ZodBoolean>;
            }, z.core.$strict>, z.ZodObject<{
                type: z.ZodLiteral<"grid">;
                counts: z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>;
                step: z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>;
                centered: z.ZodDefault<z.ZodBoolean>;
            }, z.core.$strict>], "type">>;
        }, z.core.$strict>, z.ZodObject<{
            type: z.ZodLiteral<"mesh">;
            geometry: z.ZodString;
            material: z.ZodString;
            id: z.ZodString;
            name: z.ZodOptional<z.ZodString>;
            parent: z.ZodOptional<z.ZodString>;
            transform: z.ZodOptional<z.ZodObject<{
                position: z.ZodOptional<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
                rotation: z.ZodOptional<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
                scale: z.ZodOptional<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
            }, z.core.$strict>>;
            visible: z.ZodDefault<z.ZodBoolean>;
            tags: z.ZodDefault<z.ZodArray<z.ZodString>>;
            pattern: z.ZodOptional<z.ZodDiscriminatedUnion<[z.ZodObject<{
                type: z.ZodLiteral<"path">;
                points: z.ZodArray<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
                orient: z.ZodDefault<z.ZodEnum<{
                    none: "none";
                    yaw: "yaw";
                }>>;
            }, z.core.$strict>, z.ZodObject<{
                type: z.ZodLiteral<"linear">;
                count: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
                step: z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>;
            }, z.core.$strict>, z.ZodObject<{
                type: z.ZodLiteral<"radial">;
                count: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
                radius: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
                startAngle: z.ZodDefault<z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>>;
                sweep: z.ZodDefault<z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>>;
                orient: z.ZodDefault<z.ZodBoolean>;
            }, z.core.$strict>, z.ZodObject<{
                type: z.ZodLiteral<"grid">;
                counts: z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>;
                step: z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>;
                centered: z.ZodDefault<z.ZodBoolean>;
            }, z.core.$strict>], "type">>;
        }, z.core.$strict>, z.ZodObject<{
            type: z.ZodLiteral<"model">;
            model: z.ZodString;
            rig: z.ZodOptional<z.ZodObject<{
                joints: z.ZodArray<z.ZodObject<{
                    id: z.ZodString;
                    parent: z.ZodOptional<z.ZodString>;
                    position: z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>;
                    rotation: z.ZodDefault<z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>>;
                }, z.core.$strict>>;
                binding: z.ZodDefault<z.ZodEnum<{
                    rigid: "rigid";
                    smooth: "smooth";
                }>>;
                bindings: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodString>>;
                pose: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>>>;
                clips: z.ZodDefault<z.ZodArray<z.ZodObject<{
                    id: z.ZodString;
                    duration: z.ZodNumber;
                    tracks: z.ZodArray<z.ZodObject<{
                        joint: z.ZodString;
                        keyframes: z.ZodArray<z.ZodObject<{
                            time: z.ZodNumber;
                            rotation: z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>;
                        }, z.core.$strict>>;
                    }, z.core.$strict>>;
                }, z.core.$strict>>>;
            }, z.core.$strict>>;
            parameters: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>>>;
            materialOverrides: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodString>>;
            id: z.ZodString;
            name: z.ZodOptional<z.ZodString>;
            parent: z.ZodOptional<z.ZodString>;
            transform: z.ZodOptional<z.ZodObject<{
                position: z.ZodOptional<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
                rotation: z.ZodOptional<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
                scale: z.ZodOptional<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
            }, z.core.$strict>>;
            visible: z.ZodDefault<z.ZodBoolean>;
            tags: z.ZodDefault<z.ZodArray<z.ZodString>>;
            pattern: z.ZodOptional<z.ZodDiscriminatedUnion<[z.ZodObject<{
                type: z.ZodLiteral<"path">;
                points: z.ZodArray<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
                orient: z.ZodDefault<z.ZodEnum<{
                    none: "none";
                    yaw: "yaw";
                }>>;
            }, z.core.$strict>, z.ZodObject<{
                type: z.ZodLiteral<"linear">;
                count: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
                step: z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>;
            }, z.core.$strict>, z.ZodObject<{
                type: z.ZodLiteral<"radial">;
                count: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
                radius: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
                startAngle: z.ZodDefault<z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>>;
                sweep: z.ZodDefault<z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>>;
                orient: z.ZodDefault<z.ZodBoolean>;
            }, z.core.$strict>, z.ZodObject<{
                type: z.ZodLiteral<"grid">;
                counts: z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>;
                step: z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>;
                centered: z.ZodDefault<z.ZodBoolean>;
            }, z.core.$strict>], "type">>;
        }, z.core.$strict>], "type">>>;
        schemaVersion: z.ZodLiteral<1>;
        kind: z.ZodLiteral<"scene">;
        id: z.ZodString;
        name: z.ZodString;
        revision: z.ZodDefault<z.ZodNumber>;
        units: z.ZodDefault<z.ZodLiteral<"meters">>;
        parameters: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodNumber>>;
    }, z.core.$strict>;
    models: z.ZodRecord<z.ZodString, z.ZodObject<{
        geometries: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodDiscriminatedUnion<[z.ZodObject<{
            type: z.ZodLiteral<"box">;
            size: z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>;
        }, z.core.$strict>, z.ZodObject<{
            type: z.ZodLiteral<"sphere">;
            radius: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
            segments: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strict>, z.ZodObject<{
            type: z.ZodLiteral<"cylinder">;
            radiusTop: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
            radiusBottom: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
            height: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
            segments: z.ZodOptional<z.ZodNumber>;
            openEnded: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strict>, z.ZodObject<{
            type: z.ZodLiteral<"cone">;
            radius: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
            height: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
            segments: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strict>, z.ZodObject<{
            type: z.ZodLiteral<"torus">;
            radius: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
            tube: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
            segments: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strict>, z.ZodObject<{
            type: z.ZodLiteral<"capsule">;
            radius: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
            length: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
            segments: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strict>, z.ZodObject<{
            type: z.ZodLiteral<"plane">;
            size: z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>;
        }, z.core.$strict>, z.ZodObject<{
            type: z.ZodLiteral<"tube">;
            points: z.ZodArray<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
            radius: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
            tubularSegments: z.ZodDefault<z.ZodNumber>;
            radialSegments: z.ZodDefault<z.ZodNumber>;
            closed: z.ZodDefault<z.ZodBoolean>;
            capEnds: z.ZodDefault<z.ZodBoolean>;
        }, z.core.$strict>, z.ZodObject<{
            type: z.ZodLiteral<"lathe">;
            points: z.ZodArray<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
            segments: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strict>, z.ZodObject<{
            type: z.ZodLiteral<"extrude">;
            points: z.ZodArray<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
            holes: z.ZodOptional<z.ZodArray<z.ZodArray<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>>>;
            depth: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
            bevel: z.ZodOptional<z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>>;
            bevelSegments: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strict>, z.ZodObject<{
            type: z.ZodLiteral<"mesh">;
            positions: z.ZodArray<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
            indices: z.ZodArray<z.ZodNumber>;
            normals: z.ZodOptional<z.ZodArray<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>>;
            uvs: z.ZodOptional<z.ZodArray<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>>;
        }, z.core.$strict>, z.ZodObject<{
            type: z.ZodLiteral<"boolean">;
            operation: z.ZodEnum<{
                union: "union";
                subtract: "subtract";
                intersect: "intersect";
            }>;
            left: z.ZodString;
            right: z.ZodString;
            leftTransform: z.ZodOptional<z.ZodObject<{
                position: z.ZodOptional<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
                rotation: z.ZodOptional<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
                scale: z.ZodOptional<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
            }, z.core.$strict>>;
            rightTransform: z.ZodOptional<z.ZodObject<{
                position: z.ZodOptional<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
                rotation: z.ZodOptional<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
                scale: z.ZodOptional<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
            }, z.core.$strict>>;
        }, z.core.$strict>], "type">>>;
        materials: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodObject<{
            color: z.ZodString;
            metalness: z.ZodDefault<z.ZodNumber>;
            roughness: z.ZodDefault<z.ZodNumber>;
            emissive: z.ZodOptional<z.ZodString>;
            emissiveIntensity: z.ZodOptional<z.ZodNumber>;
            opacity: z.ZodDefault<z.ZodNumber>;
            doubleSided: z.ZodDefault<z.ZodBoolean>;
            flatShading: z.ZodDefault<z.ZodBoolean>;
            shading: z.ZodOptional<z.ZodEnum<{
                standard: "standard";
                unlit: "unlit";
            }>>;
        }, z.core.$strict>>>;
        nodes: z.ZodDefault<z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
            type: z.ZodLiteral<"light">;
            light: z.ZodEnum<{
                point: "point";
                spot: "spot";
                directional: "directional";
            }>;
            color: z.ZodDefault<z.ZodString>;
            intensity: z.ZodDefault<z.ZodNumber>;
            distance: z.ZodDefault<z.ZodNumber>;
            angle: z.ZodDefault<z.ZodNumber>;
            penumbra: z.ZodDefault<z.ZodNumber>;
            castShadow: z.ZodDefault<z.ZodBoolean>;
            id: z.ZodString;
            name: z.ZodOptional<z.ZodString>;
            parent: z.ZodOptional<z.ZodString>;
            transform: z.ZodOptional<z.ZodObject<{
                position: z.ZodOptional<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
                rotation: z.ZodOptional<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
                scale: z.ZodOptional<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
            }, z.core.$strict>>;
            visible: z.ZodDefault<z.ZodBoolean>;
            tags: z.ZodDefault<z.ZodArray<z.ZodString>>;
            pattern: z.ZodOptional<z.ZodDiscriminatedUnion<[z.ZodObject<{
                type: z.ZodLiteral<"path">;
                points: z.ZodArray<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
                orient: z.ZodDefault<z.ZodEnum<{
                    none: "none";
                    yaw: "yaw";
                }>>;
            }, z.core.$strict>, z.ZodObject<{
                type: z.ZodLiteral<"linear">;
                count: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
                step: z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>;
            }, z.core.$strict>, z.ZodObject<{
                type: z.ZodLiteral<"radial">;
                count: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
                radius: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
                startAngle: z.ZodDefault<z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>>;
                sweep: z.ZodDefault<z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>>;
                orient: z.ZodDefault<z.ZodBoolean>;
            }, z.core.$strict>, z.ZodObject<{
                type: z.ZodLiteral<"grid">;
                counts: z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>;
                step: z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>;
                centered: z.ZodDefault<z.ZodBoolean>;
            }, z.core.$strict>], "type">>;
        }, z.core.$strict>, z.ZodObject<{
            type: z.ZodLiteral<"group">;
            id: z.ZodString;
            name: z.ZodOptional<z.ZodString>;
            parent: z.ZodOptional<z.ZodString>;
            transform: z.ZodOptional<z.ZodObject<{
                position: z.ZodOptional<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
                rotation: z.ZodOptional<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
                scale: z.ZodOptional<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
            }, z.core.$strict>>;
            visible: z.ZodDefault<z.ZodBoolean>;
            tags: z.ZodDefault<z.ZodArray<z.ZodString>>;
            pattern: z.ZodOptional<z.ZodDiscriminatedUnion<[z.ZodObject<{
                type: z.ZodLiteral<"path">;
                points: z.ZodArray<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
                orient: z.ZodDefault<z.ZodEnum<{
                    none: "none";
                    yaw: "yaw";
                }>>;
            }, z.core.$strict>, z.ZodObject<{
                type: z.ZodLiteral<"linear">;
                count: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
                step: z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>;
            }, z.core.$strict>, z.ZodObject<{
                type: z.ZodLiteral<"radial">;
                count: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
                radius: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
                startAngle: z.ZodDefault<z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>>;
                sweep: z.ZodDefault<z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>>;
                orient: z.ZodDefault<z.ZodBoolean>;
            }, z.core.$strict>, z.ZodObject<{
                type: z.ZodLiteral<"grid">;
                counts: z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>;
                step: z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>;
                centered: z.ZodDefault<z.ZodBoolean>;
            }, z.core.$strict>], "type">>;
        }, z.core.$strict>, z.ZodObject<{
            type: z.ZodLiteral<"mesh">;
            geometry: z.ZodString;
            material: z.ZodString;
            id: z.ZodString;
            name: z.ZodOptional<z.ZodString>;
            parent: z.ZodOptional<z.ZodString>;
            transform: z.ZodOptional<z.ZodObject<{
                position: z.ZodOptional<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
                rotation: z.ZodOptional<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
                scale: z.ZodOptional<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
            }, z.core.$strict>>;
            visible: z.ZodDefault<z.ZodBoolean>;
            tags: z.ZodDefault<z.ZodArray<z.ZodString>>;
            pattern: z.ZodOptional<z.ZodDiscriminatedUnion<[z.ZodObject<{
                type: z.ZodLiteral<"path">;
                points: z.ZodArray<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
                orient: z.ZodDefault<z.ZodEnum<{
                    none: "none";
                    yaw: "yaw";
                }>>;
            }, z.core.$strict>, z.ZodObject<{
                type: z.ZodLiteral<"linear">;
                count: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
                step: z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>;
            }, z.core.$strict>, z.ZodObject<{
                type: z.ZodLiteral<"radial">;
                count: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
                radius: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
                startAngle: z.ZodDefault<z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>>;
                sweep: z.ZodDefault<z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>>;
                orient: z.ZodDefault<z.ZodBoolean>;
            }, z.core.$strict>, z.ZodObject<{
                type: z.ZodLiteral<"grid">;
                counts: z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>;
                step: z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>;
                centered: z.ZodDefault<z.ZodBoolean>;
            }, z.core.$strict>], "type">>;
        }, z.core.$strict>, z.ZodObject<{
            type: z.ZodLiteral<"model">;
            model: z.ZodString;
            rig: z.ZodOptional<z.ZodObject<{
                joints: z.ZodArray<z.ZodObject<{
                    id: z.ZodString;
                    parent: z.ZodOptional<z.ZodString>;
                    position: z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>;
                    rotation: z.ZodDefault<z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>>;
                }, z.core.$strict>>;
                binding: z.ZodDefault<z.ZodEnum<{
                    rigid: "rigid";
                    smooth: "smooth";
                }>>;
                bindings: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodString>>;
                pose: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>>>;
                clips: z.ZodDefault<z.ZodArray<z.ZodObject<{
                    id: z.ZodString;
                    duration: z.ZodNumber;
                    tracks: z.ZodArray<z.ZodObject<{
                        joint: z.ZodString;
                        keyframes: z.ZodArray<z.ZodObject<{
                            time: z.ZodNumber;
                            rotation: z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>;
                        }, z.core.$strict>>;
                    }, z.core.$strict>>;
                }, z.core.$strict>>>;
            }, z.core.$strict>>;
            parameters: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>>>;
            materialOverrides: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodString>>;
            id: z.ZodString;
            name: z.ZodOptional<z.ZodString>;
            parent: z.ZodOptional<z.ZodString>;
            transform: z.ZodOptional<z.ZodObject<{
                position: z.ZodOptional<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
                rotation: z.ZodOptional<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
                scale: z.ZodOptional<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
            }, z.core.$strict>>;
            visible: z.ZodDefault<z.ZodBoolean>;
            tags: z.ZodDefault<z.ZodArray<z.ZodString>>;
            pattern: z.ZodOptional<z.ZodDiscriminatedUnion<[z.ZodObject<{
                type: z.ZodLiteral<"path">;
                points: z.ZodArray<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
                orient: z.ZodDefault<z.ZodEnum<{
                    none: "none";
                    yaw: "yaw";
                }>>;
            }, z.core.$strict>, z.ZodObject<{
                type: z.ZodLiteral<"linear">;
                count: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
                step: z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>;
            }, z.core.$strict>, z.ZodObject<{
                type: z.ZodLiteral<"radial">;
                count: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
                radius: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
                startAngle: z.ZodDefault<z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>>;
                sweep: z.ZodDefault<z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>>;
                orient: z.ZodDefault<z.ZodBoolean>;
            }, z.core.$strict>, z.ZodObject<{
                type: z.ZodLiteral<"grid">;
                counts: z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>;
                step: z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>;
                centered: z.ZodDefault<z.ZodBoolean>;
            }, z.core.$strict>], "type">>;
        }, z.core.$strict>], "type">>>;
        schemaVersion: z.ZodLiteral<1>;
        kind: z.ZodLiteral<"model">;
        id: z.ZodString;
        category: z.ZodOptional<z.ZodString>;
        description: z.ZodOptional<z.ZodString>;
        name: z.ZodString;
        parameters: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodObject<{
            default: z.ZodNumber;
            min: z.ZodOptional<z.ZodNumber>;
            max: z.ZodOptional<z.ZodNumber>;
            description: z.ZodOptional<z.ZodString>;
            integer: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strict>>>;
    }, z.core.$strict>>;
}, z.core.$strict>;
export type SceneBundle = z.infer<typeof SceneBundleSchema>;
export type SceneDocument = z.infer<typeof SceneSchema>;
export type ModelDocument = z.infer<typeof ModelSchema>;
export type ProjectDocument = z.infer<typeof ProjectSchema>;
export type ModelLibrary = Record<string, ModelDocument>;
