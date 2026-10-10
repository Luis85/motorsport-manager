import { z } from 'zod';
/** Littlewild engine families and the asset category each one projects. */
export declare const littlewildFamilies: {
    readonly items: "item";
    readonly buildings: "building";
    readonly creatures: "actor";
    readonly pets: "pet";
};
export declare const LittlewildId: z.ZodString;
export declare const LittlewildAssetSchema: z.ZodObject<{
    id: z.ZodString;
    family: z.ZodEnum<{
        items: "items";
        buildings: "buildings";
        creatures: "creatures";
        pets: "pets";
    }>;
    name: z.ZodString;
    models: z.ZodRecord<z.ZodString, z.ZodObject<{
        model: z.ZodString;
        parameters: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodNumber>>;
        materials: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodObject<{
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
        }, z.core.$strict>>>;
    }, z.core.$strict>>;
    metadata: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>>>;
}, z.core.$strict>;
export type LittlewildAsset = z.infer<typeof LittlewildAssetSchema>;
