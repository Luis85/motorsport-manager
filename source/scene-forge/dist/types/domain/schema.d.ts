export { ForgeError, fail } from './errors.js';
import { z } from 'zod';
export { Id, NumberValue, expressionOperators, Scalar, Vec3, Transform, type ScalarValue, type V3, type V2, type TransformSpec, } from './schema-values.js';
export { GeometrySchema, MaterialSchema, PatternSchema, RigSchema, NodeSchema, type Geometry, type RigSpec, type NodeSpec, type MaterialSpec, } from './schema-content.js';
export { CameraSchema, EnvironmentSchema, SceneSchema, ModelSchema, ProjectSchema, ModelBundleSchema, SceneBundleSchema, type SceneBundle, type SceneDocument, type ModelDocument, type ProjectDocument, type ModelLibrary, } from './schema-documents.js';
export { NodePatchSchema, SelectorSchema, OperationSchema, BatchSchema, CompositionSchema, type NodeSelector, type Operation, } from './schema-operations.js';
export { littlewildFamilies, LittlewildId, LittlewildAssetSchema, LittlewildExportSchema, type LittlewildAsset, type LittlewildExport, } from './schema-littlewild.js';
export { viewNames, CameraSnapshotSchema, CameraRequestSchema, ReviewPlanSchema, QualityPolicySchema, type CameraSnapshot, type CameraRequest, type ReviewPlan, type QualityPolicy, } from './schema-capture.js';
export declare function parse<T>(schema: z.ZodType<T>, input: unknown): T;
export declare const schemas: {
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
    model: z.ZodObject<{
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
    project: z.ZodObject<{
        schemaVersion: z.ZodLiteral<1>;
        name: z.ZodString;
        activeScene: z.ZodString;
        scenes: z.ZodRecord<z.ZodString, z.ZodString>;
        models: z.ZodRecord<z.ZodString, z.ZodString>;
    }, z.core.$strict>;
    batch: z.ZodObject<{
        operations: z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
            op: z.ZodLiteral<"putNode">;
            node: z.ZodDiscriminatedUnion<[z.ZodObject<{
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
        }, z.core.$strict>, z.ZodObject<{
            op: z.ZodLiteral<"patchNodes">;
            selector: z.ZodObject<{
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
            patch: z.ZodObject<{
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
        }, z.core.$strict>, z.ZodObject<{
            op: z.ZodLiteral<"removeNode">;
            id: z.ZodString;
            cascade: z.ZodDefault<z.ZodBoolean>;
        }, z.core.$strict>, z.ZodObject<{
            op: z.ZodLiteral<"putGeometry">;
            id: z.ZodString;
            geometry: z.ZodDiscriminatedUnion<[z.ZodObject<{
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
            }, z.core.$strict>], "type">;
        }, z.core.$strict>, z.ZodObject<{
            op: z.ZodLiteral<"removeGeometry">;
            id: z.ZodString;
        }, z.core.$strict>, z.ZodObject<{
            op: z.ZodLiteral<"putMaterial">;
            id: z.ZodString;
            material: z.ZodObject<{
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
            }, z.core.$strict>;
        }, z.core.$strict>, z.ZodObject<{
            op: z.ZodLiteral<"removeMaterial">;
            id: z.ZodString;
        }, z.core.$strict>, z.ZodObject<{
            op: z.ZodLiteral<"setParameter">;
            id: z.ZodString;
            value: z.ZodNumber;
        }, z.core.$strict>, z.ZodObject<{
            op: z.ZodLiteral<"setCamera">;
            camera: z.ZodObject<{
                position: z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>;
                target: z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>;
                fov: z.ZodDefault<z.ZodNumber>;
            }, z.core.$strict>;
        }, z.core.$strict>, z.ZodObject<{
            op: z.ZodLiteral<"setEnvironment">;
            environment: z.ZodObject<{
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
        }, z.core.$strict>, z.ZodObject<{
            op: z.ZodLiteral<"patchNode">;
            id: z.ZodString;
            patch: z.ZodObject<{
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
        }, z.core.$strict>, z.ZodObject<{
            op: z.ZodLiteral<"duplicateNode">;
            id: z.ZodString;
            newId: z.ZodString;
            offset: z.ZodDefault<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
        }, z.core.$strict>, z.ZodObject<{
            op: z.ZodLiteral<"reparentNode">;
            id: z.ZodString;
            parent: z.ZodNullable<z.ZodString>;
            keepWorld: z.ZodDefault<z.ZodBoolean>;
        }, z.core.$strict>, z.ZodObject<{
            op: z.ZodLiteral<"groupNodes">;
            id: z.ZodString;
            nodes: z.ZodArray<z.ZodString>;
            name: z.ZodOptional<z.ZodString>;
        }, z.core.$strict>, z.ZodObject<{
            op: z.ZodLiteral<"groundNode">;
            id: z.ZodString;
            y: z.ZodDefault<z.ZodNumber>;
        }, z.core.$strict>, z.ZodObject<{
            op: z.ZodLiteral<"placeNode">;
            id: z.ZodString;
            target: z.ZodString;
            side: z.ZodEnum<{
                left: "left";
                right: "right";
                front: "front";
                back: "back";
                above: "above";
                below: "below";
            }>;
            gap: z.ZodDefault<z.ZodNumber>;
            center: z.ZodDefault<z.ZodBoolean>;
        }, z.core.$strict>], "op">>;
        scene: z.ZodOptional<z.ZodString>;
        expectedRevision: z.ZodOptional<z.ZodNumber>;
        expectedState: z.ZodOptional<z.ZodString>;
    }, z.core.$strict>;
    node: z.ZodDiscriminatedUnion<[z.ZodObject<{
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
    geometry: z.ZodDiscriminatedUnion<[z.ZodObject<{
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
    }, z.core.$strict>], "type">;
    material: z.ZodObject<{
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
    }, z.core.$strict>;
    composition: z.ZodObject<{
        groups: z.ZodDefault<z.ZodArray<z.ZodObject<{
            type: z.ZodDefault<z.ZodLiteral<"group">>;
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
        }, z.core.$strict>>>;
        instances: z.ZodArray<z.ZodObject<{
            type: z.ZodDefault<z.ZodLiteral<"model">>;
            model: z.ZodString;
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
        }, z.core.$strict>>;
        scene: z.ZodOptional<z.ZodString>;
        expectedRevision: z.ZodOptional<z.ZodNumber>;
        expectedState: z.ZodOptional<z.ZodString>;
        schemaVersion: z.ZodLiteral<1>;
        kind: z.ZodLiteral<"composition">;
    }, z.core.$strict>;
    'model-bundle': z.ZodObject<{
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
    'scene-bundle': z.ZodObject<{
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
    selector: z.ZodObject<{
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
    scalar: z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>;
    review: z.ZodObject<{
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
    'camera-snapshot': z.ZodObject<{
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
    'quality-policy': z.ZodObject<{
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
    pattern: z.ZodDiscriminatedUnion<[z.ZodObject<{
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
    rig: z.ZodObject<{
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
    'littlewild-export': z.ZodObject<{
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
};
export declare const schemaKinds: (keyof typeof schemas)[];
export declare function jsonSchema(kind: string): z.core.ZodStandardJSONSchemaPayload<z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>> | z.ZodDiscriminatedUnion<[z.ZodObject<{
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
}, z.core.$strict>], "type"> | z.ZodObject<{
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
}, z.core.$strict> | z.ZodDiscriminatedUnion<[z.ZodObject<{
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
}, z.core.$strict>], "type"> | z.ZodObject<{
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
}, z.core.$strict> | z.ZodDiscriminatedUnion<[z.ZodObject<{
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
}, z.core.$strict>], "type"> | z.ZodObject<{
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
}, z.core.$strict> | z.ZodObject<{
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
}, z.core.$strict> | z.ZodObject<{
    schemaVersion: z.ZodLiteral<1>;
    name: z.ZodString;
    activeScene: z.ZodString;
    scenes: z.ZodRecord<z.ZodString, z.ZodString>;
    models: z.ZodRecord<z.ZodString, z.ZodString>;
}, z.core.$strict> | z.ZodObject<{
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
}, z.core.$strict> | z.ZodObject<{
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
}, z.core.$strict> | z.ZodObject<{
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
}, z.core.$strict> | z.ZodObject<{
    operations: z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
        op: z.ZodLiteral<"putNode">;
        node: z.ZodDiscriminatedUnion<[z.ZodObject<{
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
    }, z.core.$strict>, z.ZodObject<{
        op: z.ZodLiteral<"patchNodes">;
        selector: z.ZodObject<{
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
        patch: z.ZodObject<{
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
    }, z.core.$strict>, z.ZodObject<{
        op: z.ZodLiteral<"removeNode">;
        id: z.ZodString;
        cascade: z.ZodDefault<z.ZodBoolean>;
    }, z.core.$strict>, z.ZodObject<{
        op: z.ZodLiteral<"putGeometry">;
        id: z.ZodString;
        geometry: z.ZodDiscriminatedUnion<[z.ZodObject<{
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
        }, z.core.$strict>], "type">;
    }, z.core.$strict>, z.ZodObject<{
        op: z.ZodLiteral<"removeGeometry">;
        id: z.ZodString;
    }, z.core.$strict>, z.ZodObject<{
        op: z.ZodLiteral<"putMaterial">;
        id: z.ZodString;
        material: z.ZodObject<{
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
        }, z.core.$strict>;
    }, z.core.$strict>, z.ZodObject<{
        op: z.ZodLiteral<"removeMaterial">;
        id: z.ZodString;
    }, z.core.$strict>, z.ZodObject<{
        op: z.ZodLiteral<"setParameter">;
        id: z.ZodString;
        value: z.ZodNumber;
    }, z.core.$strict>, z.ZodObject<{
        op: z.ZodLiteral<"setCamera">;
        camera: z.ZodObject<{
            position: z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>;
            target: z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>;
            fov: z.ZodDefault<z.ZodNumber>;
        }, z.core.$strict>;
    }, z.core.$strict>, z.ZodObject<{
        op: z.ZodLiteral<"setEnvironment">;
        environment: z.ZodObject<{
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
    }, z.core.$strict>, z.ZodObject<{
        op: z.ZodLiteral<"patchNode">;
        id: z.ZodString;
        patch: z.ZodObject<{
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
    }, z.core.$strict>, z.ZodObject<{
        op: z.ZodLiteral<"duplicateNode">;
        id: z.ZodString;
        newId: z.ZodString;
        offset: z.ZodDefault<z.ZodTuple<[z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>, z.ZodType<import("./schema-values.js").ScalarValue, unknown, z.core.$ZodTypeInternals<import("./schema-values.js").ScalarValue, unknown>>], null>>;
    }, z.core.$strict>, z.ZodObject<{
        op: z.ZodLiteral<"reparentNode">;
        id: z.ZodString;
        parent: z.ZodNullable<z.ZodString>;
        keepWorld: z.ZodDefault<z.ZodBoolean>;
    }, z.core.$strict>, z.ZodObject<{
        op: z.ZodLiteral<"groupNodes">;
        id: z.ZodString;
        nodes: z.ZodArray<z.ZodString>;
        name: z.ZodOptional<z.ZodString>;
    }, z.core.$strict>, z.ZodObject<{
        op: z.ZodLiteral<"groundNode">;
        id: z.ZodString;
        y: z.ZodDefault<z.ZodNumber>;
    }, z.core.$strict>, z.ZodObject<{
        op: z.ZodLiteral<"placeNode">;
        id: z.ZodString;
        target: z.ZodString;
        side: z.ZodEnum<{
            left: "left";
            right: "right";
            front: "front";
            back: "back";
            above: "above";
            below: "below";
        }>;
        gap: z.ZodDefault<z.ZodNumber>;
        center: z.ZodDefault<z.ZodBoolean>;
    }, z.core.$strict>], "op">>;
    scene: z.ZodOptional<z.ZodString>;
    expectedRevision: z.ZodOptional<z.ZodNumber>;
    expectedState: z.ZodOptional<z.ZodString>;
}, z.core.$strict> | z.ZodObject<{
    groups: z.ZodDefault<z.ZodArray<z.ZodObject<{
        type: z.ZodDefault<z.ZodLiteral<"group">>;
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
    }, z.core.$strict>>>;
    instances: z.ZodArray<z.ZodObject<{
        type: z.ZodDefault<z.ZodLiteral<"model">>;
        model: z.ZodString;
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
    }, z.core.$strict>>;
    scene: z.ZodOptional<z.ZodString>;
    expectedRevision: z.ZodOptional<z.ZodNumber>;
    expectedState: z.ZodOptional<z.ZodString>;
    schemaVersion: z.ZodLiteral<1>;
    kind: z.ZodLiteral<"composition">;
}, z.core.$strict> | z.ZodObject<{
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
}, z.core.$strict> | z.ZodObject<{
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
}, z.core.$strict> | z.ZodObject<{
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
}, z.core.$strict> | z.ZodObject<{
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
}, z.core.$strict> | z.ZodObject<{
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
}, z.core.$strict>>;
