// Edit transaction contracts: node patches and selectors, the guarded operation
// batch applied by `apply`, and composition files that upsert groups and model
// instances. Revision/state guards are shared by batches and compositions.
import { z } from 'zod';
import { Id, NumberValue, Scalar, Vec3, Color, Transform } from './schema-values.js';
import {
  GeometrySchema,
  MaterialSchema,
  PatternSchema,
  RigSchema,
  NodeSchema,
  nodeBase,
} from './schema-content.js';
import { CameraSchema, EnvironmentSchema } from './schema-documents.js';

export const NodePatchSchema = z
  .object({
    name: z.string().max(120).optional(),
    visible: z.boolean().optional(),
    tags: z.array(z.string().max(64)).max(32).optional(),
    transform: Transform.optional(),
    pattern: PatternSchema.nullable().optional(),
    rig: RigSchema.nullable().optional(),
    color: Color.optional(),
    intensity: z.number().finite().min(0).max(10000).optional(),
    distance: z.number().finite().min(0).max(100000).optional(),
    angle: z.number().min(1).max(89).optional(),
    penumbra: z.number().min(0).max(1).optional(),
    castShadow: z.boolean().optional(),
    parameters: z.record(Id, Scalar).optional(),
    materialOverrides: z.record(Id, Id).optional(),
  })
  .strict();
export const SelectorSchema = z
  .object({
    ids: z.array(Id).min(1).max(1000).optional(),
    tag: z.string().max(64).optional(),
    type: z.enum(['group', 'mesh', 'model', 'light']).optional(),
    model: Id.optional(),
    parent: Id.nullable().optional(),
  })
  .strict();
export const OperationSchema = z.discriminatedUnion('op', [
  z.object({ op: z.literal('putNode'), node: NodeSchema }).strict(),
  z
    .object({ op: z.literal('patchNodes'), selector: SelectorSchema, patch: NodePatchSchema })
    .strict(),
  z.object({ op: z.literal('removeNode'), id: Id, cascade: z.boolean().default(false) }).strict(),
  z.object({ op: z.literal('putGeometry'), id: Id, geometry: GeometrySchema }).strict(),
  z.object({ op: z.literal('removeGeometry'), id: Id }).strict(),
  z.object({ op: z.literal('putMaterial'), id: Id, material: MaterialSchema }).strict(),
  z.object({ op: z.literal('removeMaterial'), id: Id }).strict(),
  z.object({ op: z.literal('setParameter'), id: Id, value: NumberValue }).strict(),
  z.object({ op: z.literal('setCamera'), camera: CameraSchema }).strict(),
  z.object({ op: z.literal('setEnvironment'), environment: EnvironmentSchema }).strict(),
  z.object({ op: z.literal('patchNode'), id: Id, patch: NodePatchSchema }).strict(),
  z
    .object({ op: z.literal('duplicateNode'), id: Id, newId: Id, offset: Vec3.default([0, 0, 0]) })
    .strict(),
  z
    .object({
      op: z.literal('reparentNode'),
      id: Id,
      parent: Id.nullable(),
      keepWorld: z.boolean().default(true),
    })
    .strict(),
  z
    .object({
      op: z.literal('groupNodes'),
      id: Id,
      nodes: z.array(Id).min(1).max(1000),
      name: z.string().max(120).optional(),
    })
    .strict(),
  z.object({ op: z.literal('groundNode'), id: Id, y: NumberValue.default(0) }).strict(),
  z
    .object({
      op: z.literal('placeNode'),
      id: Id,
      target: Id,
      side: z.enum(['right', 'left', 'front', 'back', 'above', 'below']),
      gap: z.number().min(0).max(1e6).default(0),
      center: z.boolean().default(true),
    })
    .strict(),
]);
const guards = {
  scene: Id.optional(),
  expectedRevision: z.number().int().nonnegative().optional(),
  expectedState: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .optional(),
};
export const BatchSchema = z
  .object({ ...guards, operations: z.array(OperationSchema).min(1).max(10000) })
  .strict();
export const CompositionSchema = z
  .object({
    schemaVersion: z.literal(1),
    kind: z.literal('composition'),
    ...guards,
    groups: z
      .array(z.object({ ...nodeBase, type: z.literal('group').default('group') }).strict())
      .default([]),
    instances: z
      .array(
        z
          .object({
            ...nodeBase,
            type: z.literal('model').default('model'),
            model: Id,
            parameters: z.record(Id, Scalar).default({}),
            materialOverrides: z.record(Id, Id).default({}),
          })
          .strict(),
      )
      .min(1)
      .max(10000),
  })
  .strict();
export type NodeSelector = z.infer<typeof SelectorSchema>;
export type Operation = z.infer<typeof OperationSchema>;
