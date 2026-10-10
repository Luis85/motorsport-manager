import { z } from 'zod';
export declare const viewNames: readonly ["iso", "front", "back", "right", "left", "side", "top", "bottom", "authored", "orbit"];
export declare const CameraSnapshotSchema: z.ZodObject<{
    projection: z.ZodEnum<{
        perspective: "perspective";
        orthographic: "orthographic";
    }>;
    position: z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>;
    target: z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>;
    up: z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>;
    near: z.ZodNumber;
    far: z.ZodNumber;
    zoom: z.ZodDefault<z.ZodNumber>;
    fov: z.ZodOptional<z.ZodNumber>;
    aspect: z.ZodOptional<z.ZodNumber>;
    left: z.ZodOptional<z.ZodNumber>;
    right: z.ZodOptional<z.ZodNumber>;
    top: z.ZodOptional<z.ZodNumber>;
    bottom: z.ZodOptional<z.ZodNumber>;
}, z.core.$strict>;
export type CameraSnapshot = z.infer<typeof CameraSnapshotSchema>;
export declare const CameraRequestSchema: z.ZodObject<{
    view: z.ZodDefault<z.ZodEnum<{
        left: "left";
        right: "right";
        side: "side";
        front: "front";
        back: "back";
        iso: "iso";
        top: "top";
        bottom: "bottom";
        authored: "authored";
        orbit: "orbit";
    }>>;
    projection: z.ZodDefault<z.ZodEnum<{
        perspective: "perspective";
        orthographic: "orthographic";
        auto: "auto";
    }>>;
    azimuth: z.ZodDefault<z.ZodNumber>;
    elevation: z.ZodDefault<z.ZodNumber>;
    padding: z.ZodDefault<z.ZodNumber>;
    fov: z.ZodDefault<z.ZodNumber>;
    fixed: z.ZodOptional<z.ZodObject<{
        projection: z.ZodEnum<{
            perspective: "perspective";
            orthographic: "orthographic";
        }>;
        position: z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>;
        target: z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>;
        up: z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>;
        near: z.ZodNumber;
        far: z.ZodNumber;
        zoom: z.ZodDefault<z.ZodNumber>;
        fov: z.ZodOptional<z.ZodNumber>;
        aspect: z.ZodOptional<z.ZodNumber>;
        left: z.ZodOptional<z.ZodNumber>;
        right: z.ZodOptional<z.ZodNumber>;
        top: z.ZodOptional<z.ZodNumber>;
        bottom: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strict>>;
}, z.core.$strict>;
export declare const ReviewPlanSchema: z.ZodObject<{
    schemaVersion: z.ZodLiteral<1>;
    kind: z.ZodLiteral<"review">;
    width: z.ZodDefault<z.ZodNumber>;
    height: z.ZodDefault<z.ZodNumber>;
    grid: z.ZodDefault<z.ZodBoolean>;
    wireframe: z.ZodDefault<z.ZodBoolean>;
    contactSheet: z.ZodDefault<z.ZodBoolean>;
    background: z.ZodOptional<z.ZodString>;
    frames: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        camera: z.ZodObject<{
            view: z.ZodDefault<z.ZodEnum<{
                left: "left";
                right: "right";
                side: "side";
                front: "front";
                back: "back";
                iso: "iso";
                top: "top";
                bottom: "bottom";
                authored: "authored";
                orbit: "orbit";
            }>>;
            projection: z.ZodDefault<z.ZodEnum<{
                perspective: "perspective";
                orthographic: "orthographic";
                auto: "auto";
            }>>;
            azimuth: z.ZodDefault<z.ZodNumber>;
            elevation: z.ZodDefault<z.ZodNumber>;
            padding: z.ZodDefault<z.ZodNumber>;
            fov: z.ZodDefault<z.ZodNumber>;
            fixed: z.ZodOptional<z.ZodObject<{
                projection: z.ZodEnum<{
                    perspective: "perspective";
                    orthographic: "orthographic";
                }>;
                position: z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>;
                target: z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>;
                up: z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>;
                near: z.ZodNumber;
                far: z.ZodNumber;
                zoom: z.ZodDefault<z.ZodNumber>;
                fov: z.ZodOptional<z.ZodNumber>;
                aspect: z.ZodOptional<z.ZodNumber>;
                left: z.ZodOptional<z.ZodNumber>;
                right: z.ZodOptional<z.ZodNumber>;
                top: z.ZodOptional<z.ZodNumber>;
                bottom: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strict>>;
        }, z.core.$strict>;
    }, z.core.$strict>>;
}, z.core.$strict>;
export type CameraRequest = z.infer<typeof CameraRequestSchema>;
export type ReviewPlan = z.infer<typeof ReviewPlanSchema>;
export declare const QualityPolicySchema: z.ZodObject<{
    schemaVersion: z.ZodLiteral<1>;
    kind: z.ZodLiteral<"quality-policy">;
    maxTriangles: z.ZodOptional<z.ZodNumber>;
    maxMeshes: z.ZodOptional<z.ZodNumber>;
    maxMaterials: z.ZodOptional<z.ZodNumber>;
    maxGeometries: z.ZodOptional<z.ZodNumber>;
    maxExtent: z.ZodOptional<z.ZodNumber>;
    allowTransparency: z.ZodDefault<z.ZodBoolean>;
    allowDoubleSided: z.ZodDefault<z.ZodBoolean>;
    requireUVs: z.ZodDefault<z.ZodBoolean>;
}, z.core.$strict>;
export type QualityPolicy = z.infer<typeof QualityPolicySchema>;
