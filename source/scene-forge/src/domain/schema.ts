import { fail } from './errors.js';
export { ForgeError, fail } from './errors.js';
import { z } from 'zod';

export const Id = z.string().regex(/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/);
export const NumberValue = z.number().finite().min(-1e6).max(1e6);
export const expressionOperators = [
  'add',
  'sub',
  'mul',
  'div',
  'min',
  'max',
  'abs',
  'neg',
  'sin',
  'cos',
  'clamp',
] as const;
export type ScalarValue =
  | number
  | { $param: string }
  | { $expr: (typeof expressionOperators)[number]; args: ScalarValue[] };
export const Scalar: z.ZodType<ScalarValue> = z.lazy(() =>
  z.union([
    NumberValue,
    z.object({ $param: Id }).strict(),
    z.object({ $expr: z.enum(expressionOperators), args: z.array(Scalar).min(1).max(16) }).strict(),
  ]),
);
export const Vec3 = z.tuple([Scalar, Scalar, Scalar]);
const Vec2 = z.tuple([Scalar, Scalar]);
const Color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
export const Transform = z
  .object({ position: Vec3.optional(), rotation: Vec3.optional(), scale: Vec3.optional() })
  .strict();
const segments = z.number().int().min(3).max(128);
export const GeometrySchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('box'), size: Vec3 }),
  z.strictObject({ type: z.literal('sphere'), radius: Scalar, segments: segments.optional() }),
  z.strictObject({
    type: z.literal('cylinder'),
    radiusTop: Scalar,
    radiusBottom: Scalar,
    height: Scalar,
    segments: segments.optional(),
    openEnded: z.boolean().optional(),
  }),
  z.strictObject({
    type: z.literal('cone'),
    radius: Scalar,
    height: Scalar,
    segments: segments.optional(),
  }),
  z.strictObject({
    type: z.literal('torus'),
    radius: Scalar,
    tube: Scalar,
    segments: segments.optional(),
  }),
  z.strictObject({
    type: z.literal('capsule'),
    radius: Scalar,
    length: Scalar,
    segments: segments.optional(),
  }),
  z.strictObject({ type: z.literal('plane'), size: Vec2 }),
  z.strictObject({
    type: z.literal('tube'),
    points: z.array(Vec3).min(2).max(256),
    radius: Scalar,
    tubularSegments: z.number().int().min(4).max(512).default(64),
    radialSegments: z.number().int().min(3).max(32).default(8),
    closed: z.boolean().default(false),
    capEnds: z.boolean().default(true),
  }),
  z.strictObject({
    type: z.literal('lathe'),
    points: z.array(Vec2).min(2).max(512),
    segments: segments.optional(),
  }),
  z.strictObject({
    type: z.literal('extrude'),
    points: z.array(Vec2).min(3).max(512),
    holes: z.array(z.array(Vec2).min(3).max(512)).max(32).optional(),
    depth: Scalar,
    bevel: Scalar.optional(),
    bevelSegments: segments.optional(),
  }),
  z.strictObject({
    type: z.literal('mesh'),
    positions: z.array(Vec3).min(3).max(100000),
    indices: z.array(z.number().int().nonnegative()).min(3).max(600000),
    normals: z.array(Vec3).min(3).max(100000).optional(),
    uvs: z.array(Vec2).min(3).max(100000).optional(),
  }),
  z.strictObject({
    type: z.literal('boolean'),
    operation: z.enum(['union', 'subtract', 'intersect']),
    left: Id,
    right: Id,
    leftTransform: Transform.optional(),
    rightTransform: Transform.optional(),
  }),
]);

export type V3 = [ScalarValue, ScalarValue, ScalarValue];
export type V2 = [ScalarValue, ScalarValue];
export type TransformSpec = z.infer<typeof Transform>;
export type Geometry = z.infer<typeof GeometrySchema>;

export const MaterialSchema = z
  .object({
    color: Color,
    metalness: z.number().min(0).max(1).default(0),
    roughness: z.number().min(0).max(1).default(0.65),
    sheen: z.number().min(0).max(1).optional(),
    sheenColor: Color.optional(),
    sheenRoughness: z.number().min(0).max(1).optional(),
    clearcoat: z.number().min(0).max(1).optional(),
    clearcoatRoughness: z.number().min(0).max(1).optional(),
    emissive: Color.optional(),
    emissiveIntensity: z.number().min(0).max(20).optional(),
    opacity: z.number().min(0).max(1).default(1),
    depthWrite: z.boolean().optional(),
    doubleSided: z.boolean().default(false),
    flatShading: z.boolean().default(false),
    shading: z.enum(['standard', 'unlit']).optional(),
  })
  .strict();
export const PatternSchema = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('path'),
    points: z.array(Vec3).min(1).max(256),
    orient: z.enum(['none', 'yaw']).default('none'),
  }),
  z.object({ type: z.literal('linear'), count: Scalar, step: Vec3 }).strict(),
  z
    .object({
      type: z.literal('radial'),
      count: Scalar,
      radius: Scalar,
      startAngle: Scalar.default(0),
      sweep: Scalar.default(360),
      orient: z.boolean().default(true),
    })
    .strict(),
  z
    .object({
      type: z.literal('grid'),
      counts: Vec3,
      step: Vec3,
      centered: z.boolean().default(false),
    })
    .strict(),
]);
const JointVector = z.tuple([NumberValue, NumberValue, NumberValue]);
export const RigSchema = z.strictObject({
  joints: z
    .array(
      z.strictObject({
        id: Id,
        parent: Id.optional(),
        position: JointVector,
        rotation: JointVector.default([0, 0, 0]),
      }),
    )
    .min(1)
    .max(64),
  binding: z.enum(['rigid', 'smooth']).default('rigid'),
  bindings: z.record(z.string().min(1).max(512), Id).default({}),
  pose: z.record(Id, JointVector).default({}),
  clips: z
    .array(
      z.strictObject({
        id: Id,
        duration: z.number().positive().max(600),
        tracks: z
          .array(
            z.strictObject({
              joint: Id,
              keyframes: z
                .array(
                  z.strictObject({
                    time: z.number().min(0).max(600),
                    rotation: JointVector,
                  }),
                )
                .min(2)
                .max(256),
            }),
          )
          .min(1)
          .max(64),
      }),
    )
    .max(16)
    .default([]),
});
export type RigSpec = z.infer<typeof RigSchema>;
const nodeBase = {
  id: Id,
  name: z.string().max(120).optional(),
  parent: Id.optional(),
  transform: Transform.optional(),
  visible: z.boolean().default(true),
  tags: z.array(z.string().max(64)).max(32).default([]),
  pattern: PatternSchema.optional(),
};
export const NodeSchema = z.discriminatedUnion('type', [
  z
    .object({
      ...nodeBase,
      type: z.literal('light'),
      light: z.enum(['point', 'spot', 'directional']),
      color: Color.default('#ffffff'),
      intensity: z.number().finite().min(0).max(10000).default(50),
      distance: z.number().finite().min(0).max(100000).default(0),
      angle: z.number().min(1).max(89).default(35),
      penumbra: z.number().min(0).max(1).default(0.25),
      castShadow: z.boolean().default(false),
    })
    .strict(),
  z.object({ ...nodeBase, type: z.literal('group') }).strict(),
  z.object({ ...nodeBase, type: z.literal('mesh'), geometry: Id, material: Id }).strict(),
  z
    .object({
      ...nodeBase,
      type: z.literal('model'),
      model: Id,
      rig: RigSchema.optional(),
      parameters: z.record(Id, Scalar).default({}),
      materialOverrides: z.record(Id, Id).default({}),
    })
    .strict(),
]);
const content = {
  geometries: z.record(Id, GeometrySchema).default({}),
  materials: z.record(Id, MaterialSchema).default({}),
  nodes: z.array(NodeSchema).max(10000).default([]),
};
export const CameraSchema = z
  .object({
    position: z.tuple([NumberValue, NumberValue, NumberValue]),
    target: z.tuple([NumberValue, NumberValue, NumberValue]),
    fov: z.number().min(5).max(120).default(40),
  })
  .strict();
export const EnvironmentSchema = z
  .object({
    background: Color.default('#171d25'),
    exposure: z.number().min(0.1).max(4).optional(),
    toneMapping: z.enum(['filmic', 'neutral', 'linear']).optional(),
    presentation: z.enum(['inspection', 'portrait']).optional(),
    ambient: z.number().min(0).max(5).default(1.8),
    keyIntensity: z.number().min(0).max(10).default(3.5),
    keyPosition: z.tuple([NumberValue, NumberValue, NumberValue]).default([5, 10, 7]),
  })
  .strict();
export const SceneSchema = z
  .object({
    schemaVersion: z.literal(1),
    kind: z.literal('scene'),
    id: Id,
    name: z.string().min(1).max(120),
    revision: z.number().int().nonnegative().default(0),
    units: z.literal('meters').default('meters'),
    parameters: z.record(Id, NumberValue).default({}),
    ...content,
    camera: CameraSchema.optional(),
    environment: EnvironmentSchema.default({
      background: '#171d25',
      ambient: 1.8,
      keyIntensity: 3.5,
      keyPosition: [5, 10, 7],
    }),
  })
  .strict();
export const ModelSchema = z
  .object({
    schemaVersion: z.literal(1),
    kind: z.literal('model'),
    id: Id,
    category: z.string().max(64).optional(),
    description: z.string().max(600).optional(),
    name: z.string().min(1).max(120),
    parameters: z
      .record(
        Id,
        z
          .object({
            default: NumberValue,
            min: NumberValue.optional(),
            max: NumberValue.optional(),
            description: z.string().max(300).optional(),
            integer: z.boolean().optional(),
          })
          .strict(),
      )
      .default({}),
    ...content,
  })
  .strict();
export const ProjectSchema = z
  .object({
    schemaVersion: z.literal(1),
    name: z.string().min(1).max(120),
    activeScene: Id,
    scenes: z.record(Id, z.string()),
    models: z.record(Id, z.string()),
  })
  .strict();
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
export const ModelBundleSchema = z
  .object({
    schemaVersion: z.literal(1),
    kind: z.literal('model-bundle'),
    entry: Id,
    models: z.record(Id, ModelSchema),
  })
  .strict();
export const SceneBundleSchema = z
  .object({
    schemaVersion: z.literal(1),
    kind: z.literal('scene-bundle'),
    scene: SceneSchema,
    models: z.record(Id, ModelSchema),
  })
  .strict();
/** Littlewild engine families and the asset category each one projects. */
export const littlewildFamilies = {
  items: 'item',
  buildings: 'building',
  creatures: 'actor',
  pets: 'pet',
} as const;
export const LittlewildId = z.string().regex(/^[a-z0-9][a-z0-9_-]{0,60}$/);
const LittlewildVariantSchema = z
  .object({
    model: Id,
    parameters: z.record(Id, NumberValue).default({}),
    /** Replace a model material with an inline specification for this variant. */
    materials: z.record(Id, MaterialSchema).default({}),
  })
  .strict();
export const LittlewildAssetSchema = z
  .object({
    id: LittlewildId,
    family: z.enum(['items', 'buildings', 'creatures', 'pets']),
    name: z.string().min(1).max(120),
    models: z.record(LittlewildId, LittlewildVariantSchema).refine((v) => Object.keys(v).length, {
      message: 'At least one Littlewild model variant is required.',
    }),
    metadata: z.record(z.string().max(64), z.union([z.number(), z.string().max(120)])).default({}),
  })
  .strict();
export const LittlewildExportSchema = z
  .object({
    schemaVersion: z.literal(1),
    kind: z.literal('littlewild-export'),
    target: z.string().min(1).max(512),
    assets: z.array(LittlewildAssetSchema).min(1).max(128),
  })
  .strict();
export type LittlewildAsset = z.infer<typeof LittlewildAssetSchema>;
export type LittlewildExport = z.infer<typeof LittlewildExportSchema>;
export const viewNames = [
  'iso',
  'front',
  'back',
  'right',
  'left',
  'side',
  'top',
  'bottom',
  'authored',
  'orbit',
] as const;
// Fitted cameras can exceed authored scalar limits after hierarchy scaling.
const CameraNumber = z.number().finite();
const NumericVec3 = z.tuple([CameraNumber, CameraNumber, CameraNumber]);
export const CameraSnapshotSchema = z
  .object({
    projection: z.enum(['perspective', 'orthographic']),
    position: NumericVec3,
    target: NumericVec3,
    up: NumericVec3,
    near: z.number().positive().finite(),
    far: z.number().positive().finite(),
    zoom: z.number().positive().finite().default(1),
    fov: z.number().min(5).max(120).optional(),
    aspect: z.number().positive().finite().optional(),
    left: CameraNumber.optional(),
    right: CameraNumber.optional(),
    top: CameraNumber.optional(),
    bottom: CameraNumber.optional(),
  })
  .strict()
  .superRefine((c, ctx) => {
    const issue = (message: string) => ctx.addIssue({ code: 'custom', message });
    if (c.far <= c.near) issue('far must exceed near');
    const d = c.target.map((v, i) => v - c.position[i]);
    const cross = [
      d[1] * c.up[2] - d[2] * c.up[1],
      d[2] * c.up[0] - d[0] * c.up[2],
      d[0] * c.up[1] - d[1] * c.up[0],
    ];
    if (Math.hypot(...d) === 0 || Math.hypot(...cross) < 1e-12)
      issue('Camera direction and up must be nonzero and nonparallel');
    if (c.projection === 'perspective' && (c.fov === undefined || c.aspect === undefined))
      issue('Perspective cameras need fov and aspect');
    if (c.projection === 'orthographic' && !(c.right! > c.left! && c.top! > c.bottom!))
      issue('Orthographic cameras need ordered left/right and bottom/top planes');
  });
export type CameraSnapshot = z.infer<typeof CameraSnapshotSchema>;
export const CameraRequestSchema = z
  .object({
    view: z.enum(viewNames).default('iso'),
    projection: z.enum(['auto', 'perspective', 'orthographic']).default('auto'),
    azimuth: NumberValue.default(45),
    elevation: z.number().min(-89.9).max(89.9).default(30),
    padding: z.number().min(1.02).max(3).default(1.12),
    fov: z.number().min(5).max(120).default(40),
    fixed: CameraSnapshotSchema.optional(),
  })
  .strict();
export const ReviewPlanSchema = z
  .object({
    schemaVersion: z.literal(1),
    kind: z.literal('review'),
    width: z.number().int().min(64).max(2048).default(800),
    height: z.number().int().min(64).max(2048).default(600),
    grid: z.boolean().default(false),
    wireframe: z.boolean().default(false),
    contactSheet: z.boolean().default(true),
    background: Color.optional(),
    frames: z
      .array(z.object({ id: Id, camera: CameraRequestSchema }).strict())
      .min(1)
      .max(36),
  })
  .strict();
export type CameraRequest = z.infer<typeof CameraRequestSchema>;
export type ReviewPlan = z.infer<typeof ReviewPlanSchema>;
export const QualityPolicySchema = z
  .object({
    schemaVersion: z.literal(1),
    kind: z.literal('quality-policy'),
    maxTriangles: z.number().int().nonnegative().optional(),
    maxMeshes: z.number().int().nonnegative().optional(),
    maxMaterials: z.number().int().nonnegative().optional(),
    maxGeometries: z.number().int().nonnegative().optional(),
    maxExtent: z.number().positive().finite().optional(),
    allowTransparency: z.boolean().default(true),
    allowDoubleSided: z.boolean().default(true),
    requireUVs: z.boolean().default(false),
  })
  .strict();
export type QualityPolicy = z.infer<typeof QualityPolicySchema>;
export type SceneBundle = z.infer<typeof SceneBundleSchema>;
export type NodeSelector = z.infer<typeof SelectorSchema>;
export type SceneDocument = z.infer<typeof SceneSchema>;
export type ModelDocument = z.infer<typeof ModelSchema>;
export type ProjectDocument = z.infer<typeof ProjectSchema>;
export type NodeSpec = z.infer<typeof NodeSchema>;
export type MaterialSpec = z.infer<typeof MaterialSchema>;
export type Operation = z.infer<typeof OperationSchema>;
export type ModelLibrary = Record<string, ModelDocument>;

export function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const pending: [unknown, number, boolean][] = [[input, 0, false]];
  const visited = new WeakSet<object>(),
    active = new WeakSet<object>();
  while (pending.length) {
    const [value, depth, leaving] = pending.pop()!;
    if (value && typeof value === 'object') {
      if (leaving) {
        active.delete(value);
        continue;
      }
      if (active.has(value)) fail('CYCLE', 'Input must be acyclic JSON data.');
      if (depth > 128) fail('DEPTH_LIMIT', 'Input nesting exceeds 128 levels.');
      if (visited.has(value)) continue;
      visited.add(value);
      active.add(value);
      pending.push([value, depth, true]);
      for (const child of Object.values(value)) pending.push([child, depth + 1, false]);
    }
  }
  const result = schema.safeParse(input);
  if (!result.success)
    fail(
      'SCHEMA_INVALID',
      'Input does not match the schema. Use the schema command to inspect the contract.',
      result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    );
  return result.data;
}
export const schemas = {
  scene: SceneSchema,
  model: ModelSchema,
  project: ProjectSchema,
  batch: BatchSchema,
  node: NodeSchema,
  geometry: GeometrySchema,
  material: MaterialSchema,
  composition: CompositionSchema,
  'model-bundle': ModelBundleSchema,
  'scene-bundle': SceneBundleSchema,
  selector: SelectorSchema,
  scalar: Scalar,
  review: ReviewPlanSchema,
  camera: CameraRequestSchema,
  'camera-snapshot': CameraSnapshotSchema,
  'quality-policy': QualityPolicySchema,
  pattern: PatternSchema,
  rig: RigSchema,
  'littlewild-export': LittlewildExportSchema,
} satisfies Record<string, z.ZodType>;

export const schemaKinds = Object.keys(schemas) as (keyof typeof schemas)[];
export function jsonSchema(kind: string) {
  if (!Object.hasOwn(schemas, kind))
    fail('UNKNOWN_SCHEMA', `Unknown schema ${kind}.`, { available: Object.keys(schemas) });
  return z.toJSONSchema(schemas[kind as keyof typeof schemas], {
    target: 'draft-2020-12',
    io: 'input',
  });
}
