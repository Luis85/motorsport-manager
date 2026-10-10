import { z } from 'zod';
import { Id, NumberValue, Vec3 } from './schema-values.js';
import { GeometrySchema } from './schema-geometry.js';
import { MaterialSchema } from './schema-material.js';
import { NodeSchema, NodePatchSchema, SelectorSchema } from './schema-nodes.js';
import { CameraSchema, EnvironmentSchema } from './schema-documents.js';

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
/** Optimistic-concurrency guards shared by batches and scene-forge compositions. */
export const guards = {
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
export type Operation = z.infer<typeof OperationSchema>;
