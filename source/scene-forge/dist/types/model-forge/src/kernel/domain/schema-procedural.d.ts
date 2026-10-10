import { z } from 'zod';
/**
 * Procedural placement contracts. Coordinates are [x, z] meters in the frame of the
 * scatter group's parent (the document root when no parent is named). Every list and
 * count is bounded; a recipe is plain data, never code.
 */
export declare const PROCEDURAL_MAX_PLACEMENTS = 2000;
/** Candidate points one distribution may generate before filtering (PROCEDURAL_BUDGET). */
export declare const PROCEDURAL_MAX_CANDIDATES = 20000;
export declare const AreaSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    type: z.ZodLiteral<"rect">;
    min: z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>;
    max: z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>;
}, z.core.$strict>, z.ZodObject<{
    type: z.ZodLiteral<"circle">;
    center: z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>;
    radius: z.ZodNumber;
}, z.core.$strict>, z.ZodObject<{
    type: z.ZodLiteral<"polygon">;
    points: z.ZodArray<z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>>;
}, z.core.$strict>, z.ZodObject<{
    type: z.ZodLiteral<"path">;
    points: z.ZodArray<z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>>;
    width: z.ZodNumber;
}, z.core.$strict>], "type">;
export type Area = z.infer<typeof AreaSchema>;
export declare const DistributionSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    type: z.ZodLiteral<"poisson">;
    minDistance: z.ZodNumber;
}, z.core.$strict>, z.ZodObject<{
    type: z.ZodLiteral<"grid">;
    step: z.ZodNumber;
    jitter: z.ZodDefault<z.ZodNumber>;
}, z.core.$strict>, z.ZodObject<{
    type: z.ZodLiteral<"path">;
    points: z.ZodArray<z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>>;
    spacing: z.ZodNumber;
    orient: z.ZodDefault<z.ZodEnum<{
        none: "none";
        yaw: "yaw";
    }>>;
}, z.core.$strict>, z.ZodObject<{
    type: z.ZodLiteral<"random">;
    count: z.ZodNumber;
}, z.core.$strict>], "type">;
export type Distribution = z.infer<typeof DistributionSchema>;
export declare const ScatterItemSchema: z.ZodObject<{
    model: z.ZodOptional<z.ZodString>;
    node: z.ZodOptional<z.ZodString>;
    weight: z.ZodDefault<z.ZodNumber>;
    vary: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>>>;
}, z.core.$strict>;
export type ScatterItem = z.infer<typeof ScatterItemSchema>;
export declare const GroundSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    mode: z.ZodLiteral<"terrain">;
    node: z.ZodString;
    sink: z.ZodDefault<z.ZodNumber>;
    maxSlope: z.ZodDefault<z.ZodNumber>;
}, z.core.$strict>, z.ZodObject<{
    mode: z.ZodLiteral<"plane">;
    y: z.ZodDefault<z.ZodNumber>;
}, z.core.$strict>, z.ZodObject<{
    mode: z.ZodLiteral<"none">;
}, z.core.$strict>], "mode">;
export declare const ScatterRecipeSchema: z.ZodObject<{
    schemaVersion: z.ZodLiteral<1>;
    kind: z.ZodLiteral<"scatter">;
    seed: z.ZodDefault<z.ZodNumber>;
    group: z.ZodString;
    parent: z.ZodOptional<z.ZodString>;
    area: z.ZodOptional<z.ZodDiscriminatedUnion<[z.ZodObject<{
        type: z.ZodLiteral<"rect">;
        min: z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>;
        max: z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"circle">;
        center: z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>;
        radius: z.ZodNumber;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"polygon">;
        points: z.ZodArray<z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>>;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"path">;
        points: z.ZodArray<z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>>;
        width: z.ZodNumber;
    }, z.core.$strict>], "type">>;
    exclude: z.ZodDefault<z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
        type: z.ZodLiteral<"rect">;
        min: z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>;
        max: z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"circle">;
        center: z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>;
        radius: z.ZodNumber;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"polygon">;
        points: z.ZodArray<z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>>;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"path">;
        points: z.ZodArray<z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>>;
        width: z.ZodNumber;
    }, z.core.$strict>], "type">>>;
    avoidNodes: z.ZodOptional<z.ZodObject<{
        ids: z.ZodArray<z.ZodString>;
        margin: z.ZodDefault<z.ZodNumber>;
    }, z.core.$strict>>;
    distribution: z.ZodDiscriminatedUnion<[z.ZodObject<{
        type: z.ZodLiteral<"poisson">;
        minDistance: z.ZodNumber;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"grid">;
        step: z.ZodNumber;
        jitter: z.ZodDefault<z.ZodNumber>;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"path">;
        points: z.ZodArray<z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>>;
        spacing: z.ZodNumber;
        orient: z.ZodDefault<z.ZodEnum<{
            none: "none";
            yaw: "yaw";
        }>>;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"random">;
        count: z.ZodNumber;
    }, z.core.$strict>], "type">;
    maxCount: z.ZodDefault<z.ZodNumber>;
    items: z.ZodArray<z.ZodObject<{
        model: z.ZodOptional<z.ZodString>;
        node: z.ZodOptional<z.ZodString>;
        weight: z.ZodDefault<z.ZodNumber>;
        vary: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>>>;
    }, z.core.$strict>>;
    scale: z.ZodDefault<z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>>;
    rotation: z.ZodDefault<z.ZodObject<{
        yaw: z.ZodOptional<z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>>;
        tilt: z.ZodDefault<z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>>;
    }, z.core.$strict>>;
    ground: z.ZodDefault<z.ZodDiscriminatedUnion<[z.ZodObject<{
        mode: z.ZodLiteral<"terrain">;
        node: z.ZodString;
        sink: z.ZodDefault<z.ZodNumber>;
        maxSlope: z.ZodDefault<z.ZodNumber>;
    }, z.core.$strict>, z.ZodObject<{
        mode: z.ZodLiteral<"plane">;
        y: z.ZodDefault<z.ZodNumber>;
    }, z.core.$strict>, z.ZodObject<{
        mode: z.ZodLiteral<"none">;
    }, z.core.$strict>], "mode">>;
}, z.core.$strict>;
export type ScatterRecipe = z.infer<typeof ScatterRecipeSchema>;
export type ScatterRecipeInput = z.input<typeof ScatterRecipeSchema>;
