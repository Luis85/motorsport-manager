import { z } from 'zod';
export declare const GeometrySchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    type: z.ZodLiteral<"box">;
    size: z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>;
}, z.core.$strict>, z.ZodObject<{
    type: z.ZodLiteral<"sphere">;
    radius: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
    segments: z.ZodOptional<z.ZodNumber>;
}, z.core.$strict>, z.ZodObject<{
    type: z.ZodLiteral<"organic">;
    size: z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>;
    roundness: z.ZodDefault<z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>>;
    taper: z.ZodDefault<z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>>;
    bend: z.ZodDefault<z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>>;
    segments: z.ZodDefault<z.ZodNumber>;
    profile: z.ZodOptional<z.ZodArray<z.ZodObject<{
        at: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
        width: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
        depth: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
        offset: z.ZodDefault<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
    }, z.core.$strict>>>;
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
}, z.core.$strict>], "type">;
export type Geometry = z.infer<typeof GeometrySchema>;
