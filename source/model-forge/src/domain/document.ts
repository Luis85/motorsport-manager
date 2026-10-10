import { z } from 'zod';
import {
  Id,
  ModelSchema,
  OperationSchema,
  type Operation,
  type ModelDocument,
} from '../kernel/index.js';

/**
 * Model Forge document contracts. One document holds exactly one editable model:
 * `<id>.model.json` (kind `model`) or `<id>.model-bundle.json` (kind `model-bundle`), whose
 * `entry` is the editable model and whose other models are frozen dependencies.
 */
export const documentKinds = ['model', 'model-bundle'] as const;
export type DocumentKind = (typeof documentKinds)[number];
export const documentSuffixes: Record<DocumentKind, string> = {
  model: '.model.json',
  'model-bundle': '.model-bundle.json',
};
/** The kind a path's suffix declares, or undefined for another file name. */
export function kindForPath(file: string): DocumentKind | undefined {
  if (file.endsWith(documentSuffixes['model-bundle'])) return 'model-bundle';
  if (file.endsWith(documentSuffixes.model)) return 'model';
  return undefined;
}

/** A parameter definition exactly as the model schema stores it under `parameters`. */
export const ParameterSpecSchema = ModelSchema.shape.parameters.unwrap().valueType;
export type ParameterSpec = z.infer<typeof ParameterSpecSchema>;

/** Kernel operations that edit the model's own nodes, geometries and materials. */
export const kernelOperations = [
  'putNode',
  'patchNode',
  'patchNodes',
  'removeNode',
  'duplicateNode',
  'reparentNode',
  'groupNodes',
  'groundNode',
  'placeNode',
  'putGeometry',
  'removeGeometry',
  'putMaterial',
  'removeMaterial',
] as const;
/** Scene-wide operations that have no meaning inside a single model document. */
export const sceneOnlyOperations: Record<string, string> = {
  setParameter:
    'Scene parameters belong to Scene Forge scenes; models declare parameters with putParameter {id, default, min?, max?, integer?, description?}.',
  setCamera:
    'Cameras belong to Scene Forge scenes; review a model with review --views/--turntable or a review plan.',
  setEnvironment:
    'Environments belong to Scene Forge scenes; use review --background for a capture background.',
};
export const modelOperations = [
  'putParameter',
  'removeParameter',
  'setMetadata',
  'putDependency',
  'removeDependency',
] as const;
export const operationNames = [...kernelOperations, ...modelOperations] as const;
export type KernelEditOperation = Extract<Operation, { op: (typeof kernelOperations)[number] }>;

const kernelOptions = OperationSchema.options.filter((option) =>
  (kernelOperations as readonly string[]).includes(option.shape.op.value),
);
const PutParameter = z
  .object({ op: z.literal('putParameter'), id: Id, ...ParameterSpecSchema.shape })
  .strict();
const RemoveParameter = z.object({ op: z.literal('removeParameter'), id: Id }).strict();
const SetMetadata = z
  .object({
    op: z.literal('setMetadata'),
    name: ModelSchema.shape.name.optional(),
    category: ModelSchema.shape.category.unwrap().nullable().optional(),
    description: ModelSchema.shape.description.unwrap().nullable().optional(),
  })
  .strict();
const PutDependency = z
  .object({
    op: z.literal('putDependency'),
    model: ModelSchema,
    replace: z.boolean().default(false),
  })
  .strict();
const RemoveDependency = z.object({ op: z.literal('removeDependency'), id: Id }).strict();
export type ModelOnlyOperation =
  | z.infer<typeof PutParameter>
  | z.infer<typeof RemoveParameter>
  | z.infer<typeof SetMetadata>
  | z.infer<typeof PutDependency>
  | z.infer<typeof RemoveDependency>;
export type ModelOperation = KernelEditOperation | ModelOnlyOperation;

/** Every operation a model document accepts, discriminated by `op`. */
export const ModelOperationSchema = z.discriminatedUnion('op', [
  ...(kernelOptions as unknown as [(typeof kernelOptions)[number]]),
  PutParameter,
  RemoveParameter,
  SetMetadata,
  PutDependency,
  RemoveDependency,
]) as unknown as z.ZodType<ModelOperation>;

/** Optimistic-concurrency guards: the document revision and the model-plus-dependencies hash. */
export const documentGuards = {
  expectedRevision: z.number().int().nonnegative().optional(),
  expectedState: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .optional(),
};
export const ModelBatchSchema = z
  .object({
    ...documentGuards,
    operations: z.array(ModelOperationSchema).min(1).max(10000),
  })
  .strict();
export type ModelBatch = z.infer<typeof ModelBatchSchema>;
/** Envelope check before each operation is validated individually with its index. */
export const BatchEnvelopeSchema = z
  .object({ ...documentGuards, operations: z.array(z.unknown()).min(1).max(10000) })
  .strict();

export const MetadataFields = ['name', 'category', 'description'] as const;
export type ModelMetadata = Pick<ModelDocument, (typeof MetadataFields)[number]>;
