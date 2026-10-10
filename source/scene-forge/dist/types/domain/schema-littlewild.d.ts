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
    }, z.core.$strict>>;
    metadata: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>>>;
}, z.core.$strict>;
export declare const LittlewildExportSchema: z.ZodObject<{
    schemaVersion: z.ZodLiteral<1>;
    kind: z.ZodLiteral<"littlewild-export">;
    target: z.ZodString;
    assets: z.ZodArray<z.ZodObject<{
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
        }, z.core.$strict>>;
        metadata: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>>>;
    }, z.core.$strict>>;
}, z.core.$strict>;
export type LittlewildAsset = z.infer<typeof LittlewildAssetSchema>;
export type LittlewildExport = z.infer<typeof LittlewildExportSchema>;
