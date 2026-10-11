import { z } from 'zod';
export declare const PatternSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
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
}, z.core.$strict>], "type">;
export declare const RigSchema: z.ZodObject<{
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
}, z.core.$strict>;
export type RigSpec = z.infer<typeof RigSchema>;
export declare const nodeBase: {
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
};
export declare const NodeSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
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
}, z.core.$strict>], "type">;
export declare const NodePatchSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    visible: z.ZodOptional<z.ZodBoolean>;
    tags: z.ZodOptional<z.ZodArray<z.ZodString>>;
    transform: z.ZodOptional<z.ZodObject<{
        position: z.ZodOptional<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
        rotation: z.ZodOptional<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
        scale: z.ZodOptional<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
    }, z.core.$strict>>;
    pattern: z.ZodOptional<z.ZodNullable<z.ZodDiscriminatedUnion<[z.ZodObject<{
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
    }, z.core.$strict>], "type">>>;
    rig: z.ZodOptional<z.ZodNullable<z.ZodObject<{
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
    }, z.core.$strict>>>;
    color: z.ZodOptional<z.ZodString>;
    intensity: z.ZodOptional<z.ZodNumber>;
    distance: z.ZodOptional<z.ZodNumber>;
    angle: z.ZodOptional<z.ZodNumber>;
    penumbra: z.ZodOptional<z.ZodNumber>;
    castShadow: z.ZodOptional<z.ZodBoolean>;
    parameters: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>>>;
    materialOverrides: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
}, z.core.$strict>;
export declare const SelectorSchema: z.ZodObject<{
    ids: z.ZodOptional<z.ZodArray<z.ZodString>>;
    tag: z.ZodOptional<z.ZodString>;
    type: z.ZodOptional<z.ZodEnum<{
        mesh: "mesh";
        light: "light";
        group: "group";
        model: "model";
    }>>;
    model: z.ZodOptional<z.ZodString>;
    parent: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, z.core.$strict>;
export type NodeSpec = z.infer<typeof NodeSchema>;
export type NodeSelector = z.infer<typeof SelectorSchema>;
