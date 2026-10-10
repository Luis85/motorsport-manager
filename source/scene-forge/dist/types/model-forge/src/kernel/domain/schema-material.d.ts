import { z } from 'zod';
export declare const SurfaceSchema: z.ZodObject<{
    kind: z.ZodEnum<{
        fur: "fur";
        cloth: "cloth";
        leather: "leather";
    }>;
    version: z.ZodOptional<z.ZodUnion<readonly [z.ZodLiteral<1>, z.ZodLiteral<2>]>>;
    seed: z.ZodNumber;
    scale: z.ZodNumber;
    strength: z.ZodNumber;
}, z.core.$strict>;
export type SurfaceSpec = z.infer<typeof SurfaceSchema>;
export declare const MaterialSchema: z.ZodObject<{
    color: z.ZodString;
    metalness: z.ZodDefault<z.ZodNumber>;
    roughness: z.ZodDefault<z.ZodNumber>;
    surface: z.ZodOptional<z.ZodObject<{
        kind: z.ZodEnum<{
            fur: "fur";
            cloth: "cloth";
            leather: "leather";
        }>;
        version: z.ZodOptional<z.ZodUnion<readonly [z.ZodLiteral<1>, z.ZodLiteral<2>]>>;
        seed: z.ZodNumber;
        scale: z.ZodNumber;
        strength: z.ZodNumber;
    }, z.core.$strict>>;
    sheen: z.ZodOptional<z.ZodNumber>;
    sheenColor: z.ZodOptional<z.ZodString>;
    sheenRoughness: z.ZodOptional<z.ZodNumber>;
    clearcoat: z.ZodOptional<z.ZodNumber>;
    clearcoatRoughness: z.ZodOptional<z.ZodNumber>;
    emissive: z.ZodOptional<z.ZodString>;
    emissiveIntensity: z.ZodOptional<z.ZodNumber>;
    opacity: z.ZodDefault<z.ZodNumber>;
    depthWrite: z.ZodOptional<z.ZodBoolean>;
    doubleSided: z.ZodDefault<z.ZodBoolean>;
    flatShading: z.ZodDefault<z.ZodBoolean>;
    shading: z.ZodOptional<z.ZodEnum<{
        standard: "standard";
        unlit: "unlit";
    }>>;
    vertexColors: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strict>;
export type MaterialSpec = z.infer<typeof MaterialSchema>;
