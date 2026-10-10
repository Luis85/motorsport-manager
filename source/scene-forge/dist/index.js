// ../model-forge/src/kernel/domain/errors.ts
var ForgeError = class extends Error {
  constructor(code, message, details) {
    super(message);
    this.code = code;
    this.details = details;
    this.name = "ForgeError";
  }
};
function fail(code, message, details) {
  throw new ForgeError(code, message, details);
}
function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
function errorCode(error) {
  return error !== null && typeof error === "object" && "code" in error && typeof error.code === "string" ? error.code : void 0;
}

// ../model-forge/src/kernel/domain/schema-values.ts
import { z } from "zod";
var Id = z.string().regex(/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/);
var NumberValue = z.number().finite().min(-1e6).max(1e6);
var expressionOperators = [
  "add",
  "sub",
  "mul",
  "div",
  "min",
  "max",
  "abs",
  "neg",
  "sin",
  "cos",
  "clamp"
];
var Scalar = z.lazy(
  () => z.union([
    NumberValue,
    z.object({ $param: Id }).strict(),
    z.object({ $expr: z.enum(expressionOperators), args: z.array(Scalar).min(1).max(16) }).strict()
  ])
);
var Vec3 = z.tuple([Scalar, Scalar, Scalar]);
var Vec2 = z.tuple([Scalar, Scalar]);
var Color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
var Transform = z.object({ position: Vec3.optional(), rotation: Vec3.optional(), scale: Vec3.optional() }).strict();

// ../model-forge/src/kernel/domain/schema-geometry.ts
import { z as z2 } from "zod";
var segments = z2.number().int().min(3).max(128);
var HEIGHTFIELD_MAX_RESOLUTION = 256;
var gridAxis = z2.number().int().min(2).max(HEIGHTFIELD_MAX_RESOLUTION);
var HeightfieldNoiseSchema = z2.strictObject({
  kind: z2.enum(["value", "ridged", "billow"]).default("value"),
  octaves: z2.number().int().min(1).max(8).default(4),
  frequency: z2.number().min(0.1).max(64).default(3),
  lacunarity: z2.number().min(1).max(4).default(2),
  gain: z2.number().min(0).max(1).default(0.5)
});
var HeightfieldGeometrySchema = z2.strictObject({
  type: z2.literal("heightfield"),
  size: Vec2,
  amplitude: Scalar,
  resolution: z2.tuple([gridAxis, gridAxis]).default([64, 64]),
  seed: z2.number().int().min(0).max(4294967295).default(1),
  noise: HeightfieldNoiseSchema.default({
    kind: "value",
    octaves: 4,
    frequency: 3,
    lacunarity: 2,
    gain: 0.5
  }),
  falloff: z2.enum(["none", "island", "basin"]).default("none"),
  terrace: z2.number().int().min(0).max(32).default(0),
  /** Vertex colors by normalized height (0..1 of amplitude); the first band at or above wins. */
  bands: z2.array(z2.strictObject({ below: z2.number().min(0).max(1), color: Color })).min(1).max(8).optional()
});
var GeometrySchema = z2.discriminatedUnion("type", [
  z2.strictObject({ type: z2.literal("box"), size: Vec3 }),
  z2.strictObject({ type: z2.literal("sphere"), radius: Scalar, segments: segments.optional() }),
  z2.strictObject({
    type: z2.literal("organic"),
    size: Vec3,
    roundness: Scalar.default(1),
    taper: Scalar.default(0),
    bend: Scalar.default(0),
    segments: z2.number().int().min(12).max(96).default(32),
    profile: z2.array(
      z2.strictObject({
        at: Scalar,
        width: Scalar,
        depth: Scalar,
        offset: Vec2.default([0, 0])
      })
    ).min(2).max(12).optional()
  }),
  z2.strictObject({
    type: z2.literal("cylinder"),
    radiusTop: Scalar,
    radiusBottom: Scalar,
    height: Scalar,
    segments: segments.optional(),
    openEnded: z2.boolean().optional()
  }),
  z2.strictObject({
    type: z2.literal("cone"),
    radius: Scalar,
    height: Scalar,
    segments: segments.optional()
  }),
  z2.strictObject({
    type: z2.literal("torus"),
    radius: Scalar,
    tube: Scalar,
    segments: segments.optional()
  }),
  z2.strictObject({
    type: z2.literal("capsule"),
    radius: Scalar,
    length: Scalar,
    segments: segments.optional()
  }),
  z2.strictObject({ type: z2.literal("plane"), size: Vec2 }),
  z2.strictObject({
    type: z2.literal("tube"),
    points: z2.array(Vec3).min(2).max(256),
    radius: Scalar,
    tubularSegments: z2.number().int().min(4).max(512).default(64),
    radialSegments: z2.number().int().min(3).max(32).default(8),
    closed: z2.boolean().default(false),
    capEnds: z2.boolean().default(true)
  }),
  z2.strictObject({
    type: z2.literal("lathe"),
    points: z2.array(Vec2).min(2).max(512),
    segments: segments.optional()
  }),
  z2.strictObject({
    type: z2.literal("extrude"),
    points: z2.array(Vec2).min(3).max(512),
    holes: z2.array(z2.array(Vec2).min(3).max(512)).max(32).optional(),
    depth: Scalar,
    bevel: Scalar.optional(),
    bevelSegments: segments.optional()
  }),
  z2.strictObject({
    type: z2.literal("mesh"),
    positions: z2.array(Vec3).min(3).max(1e5),
    indices: z2.array(z2.number().int().nonnegative()).min(3).max(6e5),
    normals: z2.array(Vec3).min(3).max(1e5).optional(),
    uvs: z2.array(Vec2).min(3).max(1e5).optional()
  }),
  z2.strictObject({
    type: z2.literal("boolean"),
    operation: z2.enum(["union", "subtract", "intersect"]),
    left: Id,
    right: Id,
    leftTransform: Transform.optional(),
    rightTransform: Transform.optional()
  }),
  HeightfieldGeometrySchema
]);

// ../model-forge/src/kernel/domain/schema-material.ts
import { z as z3 } from "zod";
var SurfaceSchema = z3.strictObject({
  kind: z3.enum(["fur", "cloth", "leather"]),
  version: z3.union([z3.literal(1), z3.literal(2)]).optional(),
  seed: z3.number().int().min(0).max(65535),
  scale: z3.number().min(1).max(16),
  strength: z3.number().min(0).max(1)
});
var MaterialSchema = z3.object({
  color: Color,
  metalness: z3.number().min(0).max(1).default(0),
  roughness: z3.number().min(0).max(1).default(0.65),
  surface: SurfaceSchema.optional(),
  sheen: z3.number().min(0).max(1).optional(),
  sheenColor: Color.optional(),
  sheenRoughness: z3.number().min(0).max(1).optional(),
  clearcoat: z3.number().min(0).max(1).optional(),
  clearcoatRoughness: z3.number().min(0).max(1).optional(),
  emissive: Color.optional(),
  emissiveIntensity: z3.number().min(0).max(20).optional(),
  opacity: z3.number().min(0).max(1).default(1),
  depthWrite: z3.boolean().optional(),
  doubleSided: z3.boolean().default(false),
  flatShading: z3.boolean().default(false),
  shading: z3.enum(["standard", "unlit"]).optional(),
  /** Multiply the base color by the geometry's vertex colors (heightfield bands). */
  vertexColors: z3.boolean().optional()
}).strict();

// ../model-forge/src/kernel/domain/schema-nodes.ts
import { z as z4 } from "zod";
var PatternSchema = z4.discriminatedUnion("type", [
  z4.strictObject({
    type: z4.literal("path"),
    points: z4.array(Vec3).min(1).max(256),
    orient: z4.enum(["none", "yaw"]).default("none")
  }),
  z4.object({ type: z4.literal("linear"), count: Scalar, step: Vec3 }).strict(),
  z4.object({
    type: z4.literal("radial"),
    count: Scalar,
    radius: Scalar,
    startAngle: Scalar.default(0),
    sweep: Scalar.default(360),
    orient: z4.boolean().default(true)
  }).strict(),
  z4.object({
    type: z4.literal("grid"),
    counts: Vec3,
    step: Vec3,
    centered: z4.boolean().default(false)
  }).strict()
]);
var JointVector = z4.tuple([NumberValue, NumberValue, NumberValue]);
var RigSchema = z4.strictObject({
  joints: z4.array(
    z4.strictObject({
      id: Id,
      parent: Id.optional(),
      position: JointVector,
      rotation: JointVector.default([0, 0, 0])
    })
  ).min(1).max(64),
  binding: z4.enum(["rigid", "smooth"]).default("rigid"),
  bindings: z4.record(z4.string().min(1).max(512), Id).default({}),
  pose: z4.record(Id, JointVector).default({}),
  clips: z4.array(
    z4.strictObject({
      id: Id,
      duration: z4.number().positive().max(600),
      tracks: z4.array(
        z4.strictObject({
          joint: Id,
          keyframes: z4.array(
            z4.strictObject({
              time: z4.number().min(0).max(600),
              rotation: JointVector
            })
          ).min(2).max(256)
        })
      ).min(1).max(64)
    })
  ).max(16).default([])
});
var nodeBase = {
  id: Id,
  name: z4.string().max(120).optional(),
  parent: Id.optional(),
  transform: Transform.optional(),
  visible: z4.boolean().default(true),
  tags: z4.array(z4.string().max(64)).max(32).default([]),
  pattern: PatternSchema.optional()
};
var NodeSchema = z4.discriminatedUnion("type", [
  z4.object({
    ...nodeBase,
    type: z4.literal("light"),
    light: z4.enum(["point", "spot", "directional"]),
    color: Color.default("#ffffff"),
    intensity: z4.number().finite().min(0).max(1e4).default(50),
    distance: z4.number().finite().min(0).max(1e5).default(0),
    angle: z4.number().min(1).max(89).default(35),
    penumbra: z4.number().min(0).max(1).default(0.25),
    castShadow: z4.boolean().default(false)
  }).strict(),
  z4.object({ ...nodeBase, type: z4.literal("group") }).strict(),
  z4.object({ ...nodeBase, type: z4.literal("mesh"), geometry: Id, material: Id }).strict(),
  z4.object({
    ...nodeBase,
    type: z4.literal("model"),
    model: Id,
    rig: RigSchema.optional(),
    parameters: z4.record(Id, Scalar).default({}),
    materialOverrides: z4.record(Id, Id).default({})
  }).strict()
]);
var NodePatchSchema = z4.object({
  name: z4.string().max(120).optional(),
  visible: z4.boolean().optional(),
  tags: z4.array(z4.string().max(64)).max(32).optional(),
  transform: Transform.optional(),
  pattern: PatternSchema.nullable().optional(),
  rig: RigSchema.nullable().optional(),
  color: Color.optional(),
  intensity: z4.number().finite().min(0).max(1e4).optional(),
  distance: z4.number().finite().min(0).max(1e5).optional(),
  angle: z4.number().min(1).max(89).optional(),
  penumbra: z4.number().min(0).max(1).optional(),
  castShadow: z4.boolean().optional(),
  parameters: z4.record(Id, Scalar).optional(),
  materialOverrides: z4.record(Id, Id).optional()
}).strict();
var SelectorSchema = z4.object({
  ids: z4.array(Id).min(1).max(1e3).optional(),
  tag: z4.string().max(64).optional(),
  type: z4.enum(["group", "mesh", "model", "light"]).optional(),
  model: Id.optional(),
  parent: Id.nullable().optional()
}).strict();

// ../model-forge/src/kernel/domain/schema-documents.ts
import { z as z5 } from "zod";
var content = {
  geometries: z5.record(Id, GeometrySchema).default({}),
  materials: z5.record(Id, MaterialSchema).default({}),
  nodes: z5.array(NodeSchema).max(1e4).default([])
};
var CameraSchema = z5.object({
  position: z5.tuple([NumberValue, NumberValue, NumberValue]),
  target: z5.tuple([NumberValue, NumberValue, NumberValue]),
  fov: z5.number().min(5).max(120).default(40)
}).strict();
var EnvironmentSchema = z5.object({
  background: Color.default("#171d25"),
  exposure: z5.number().min(0.1).max(4).optional(),
  toneMapping: z5.enum(["filmic", "neutral", "linear"]).optional(),
  presentation: z5.enum(["inspection", "portrait"]).optional(),
  ambient: z5.number().min(0).max(5).default(1.8),
  keyIntensity: z5.number().min(0).max(10).default(3.5),
  keyPosition: z5.tuple([NumberValue, NumberValue, NumberValue]).default([5, 10, 7])
}).strict();
var SceneSchema = z5.object({
  schemaVersion: z5.literal(1),
  kind: z5.literal("scene"),
  id: Id,
  name: z5.string().min(1).max(120),
  revision: z5.number().int().nonnegative().default(0),
  units: z5.literal("meters").default("meters"),
  parameters: z5.record(Id, NumberValue).default({}),
  ...content,
  camera: CameraSchema.optional(),
  environment: EnvironmentSchema.default({
    background: "#171d25",
    ambient: 1.8,
    keyIntensity: 3.5,
    keyPosition: [5, 10, 7]
  })
}).strict();
var ModelSchema = z5.object({
  schemaVersion: z5.literal(1),
  kind: z5.literal("model"),
  id: Id,
  category: z5.string().max(64).optional(),
  description: z5.string().max(600).optional(),
  name: z5.string().min(1).max(120),
  /** Optional editor document revision. Absent means 0 and keeps legacy bytes and hashes. */
  revision: z5.number().int().nonnegative().optional(),
  parameters: z5.record(
    Id,
    z5.object({
      default: NumberValue,
      min: NumberValue.optional(),
      max: NumberValue.optional(),
      description: z5.string().max(300).optional(),
      integer: z5.boolean().optional()
    }).strict()
  ).default({}),
  ...content
}).strict();
var ModelBundleSchema = z5.object({
  schemaVersion: z5.literal(1),
  kind: z5.literal("model-bundle"),
  entry: Id,
  models: z5.record(Id, ModelSchema)
}).strict();

// ../model-forge/src/kernel/domain/schema-operations.ts
import { z as z6 } from "zod";
var OperationSchema = z6.discriminatedUnion("op", [
  z6.object({ op: z6.literal("putNode"), node: NodeSchema }).strict(),
  z6.object({ op: z6.literal("patchNodes"), selector: SelectorSchema, patch: NodePatchSchema }).strict(),
  z6.object({ op: z6.literal("removeNode"), id: Id, cascade: z6.boolean().default(false) }).strict(),
  z6.object({ op: z6.literal("putGeometry"), id: Id, geometry: GeometrySchema }).strict(),
  z6.object({ op: z6.literal("removeGeometry"), id: Id }).strict(),
  z6.object({ op: z6.literal("putMaterial"), id: Id, material: MaterialSchema }).strict(),
  z6.object({ op: z6.literal("removeMaterial"), id: Id }).strict(),
  z6.object({ op: z6.literal("setParameter"), id: Id, value: NumberValue }).strict(),
  z6.object({ op: z6.literal("setCamera"), camera: CameraSchema }).strict(),
  z6.object({ op: z6.literal("setEnvironment"), environment: EnvironmentSchema }).strict(),
  z6.object({ op: z6.literal("patchNode"), id: Id, patch: NodePatchSchema }).strict(),
  z6.object({ op: z6.literal("duplicateNode"), id: Id, newId: Id, offset: Vec3.default([0, 0, 0]) }).strict(),
  z6.object({
    op: z6.literal("reparentNode"),
    id: Id,
    parent: Id.nullable(),
    keepWorld: z6.boolean().default(true)
  }).strict(),
  z6.object({
    op: z6.literal("groupNodes"),
    id: Id,
    nodes: z6.array(Id).min(1).max(1e3),
    name: z6.string().max(120).optional()
  }).strict(),
  z6.object({ op: z6.literal("groundNode"), id: Id, y: NumberValue.default(0) }).strict(),
  z6.object({
    op: z6.literal("placeNode"),
    id: Id,
    target: Id,
    side: z6.enum(["right", "left", "front", "back", "above", "below"]),
    gap: z6.number().min(0).max(1e6).default(0),
    center: z6.boolean().default(true)
  }).strict()
]);
var guards = {
  scene: Id.optional(),
  expectedRevision: z6.number().int().nonnegative().optional(),
  expectedState: z6.string().regex(/^[a-f0-9]{64}$/).optional()
};
var BatchSchema = z6.object({ ...guards, operations: z6.array(OperationSchema).min(1).max(1e4) }).strict();

// ../model-forge/src/kernel/domain/schema-review.ts
import { z as z7 } from "zod";
var viewNames = [
  "iso",
  "front",
  "back",
  "right",
  "left",
  "side",
  "top",
  "bottom",
  "authored",
  "orbit"
];
var CameraNumber = z7.number().finite();
var NumericVec3 = z7.tuple([CameraNumber, CameraNumber, CameraNumber]);
var CameraSnapshotSchema = z7.object({
  projection: z7.enum(["perspective", "orthographic"]),
  position: NumericVec3,
  target: NumericVec3,
  up: NumericVec3,
  near: z7.number().positive().finite(),
  far: z7.number().positive().finite(),
  zoom: z7.number().positive().finite().default(1),
  fov: z7.number().min(5).max(120).optional(),
  aspect: z7.number().positive().finite().optional(),
  left: CameraNumber.optional(),
  right: CameraNumber.optional(),
  top: CameraNumber.optional(),
  bottom: CameraNumber.optional()
}).strict().superRefine((c, ctx) => {
  const issue = (message) => ctx.addIssue({ code: "custom", message });
  if (c.far <= c.near) issue("far must exceed near");
  const d = c.target.map((v, i) => v - c.position[i]);
  const cross = [
    d[1] * c.up[2] - d[2] * c.up[1],
    d[2] * c.up[0] - d[0] * c.up[2],
    d[0] * c.up[1] - d[1] * c.up[0]
  ];
  if (Math.hypot(...d) === 0 || Math.hypot(...cross) < 1e-12)
    issue("Camera direction and up must be nonzero and nonparallel");
  if (c.projection === "perspective" && (c.fov === void 0 || c.aspect === void 0))
    issue("Perspective cameras need fov and aspect");
  if (c.projection === "orthographic" && !(c.right > c.left && c.top > c.bottom))
    issue("Orthographic cameras need ordered left/right and bottom/top planes");
});
var CameraRequestSchema = z7.object({
  view: z7.enum(viewNames).default("iso"),
  projection: z7.enum(["auto", "perspective", "orthographic"]).default("auto"),
  azimuth: NumberValue.default(45),
  elevation: z7.number().min(-89.9).max(89.9).default(30),
  padding: z7.number().min(1.02).max(3).default(1.12),
  fov: z7.number().min(5).max(120).default(40),
  fixed: CameraSnapshotSchema.optional()
}).strict();
var ReviewPlanSchema = z7.object({
  schemaVersion: z7.literal(1),
  kind: z7.literal("review"),
  width: z7.number().int().min(64).max(2048).default(800),
  height: z7.number().int().min(64).max(2048).default(600),
  grid: z7.boolean().default(false),
  wireframe: z7.boolean().default(false),
  contactSheet: z7.boolean().default(true),
  background: Color.optional(),
  frames: z7.array(z7.object({ id: Id, camera: CameraRequestSchema }).strict()).min(1).max(36)
}).strict();
var QualityPolicySchema = z7.object({
  schemaVersion: z7.literal(1),
  kind: z7.literal("quality-policy"),
  maxTriangles: z7.number().int().nonnegative().optional(),
  maxMeshes: z7.number().int().nonnegative().optional(),
  maxMaterials: z7.number().int().nonnegative().optional(),
  maxGeometries: z7.number().int().nonnegative().optional(),
  maxExtent: z7.number().positive().finite().optional(),
  allowTransparency: z7.boolean().default(true),
  allowDoubleSided: z7.boolean().default(true),
  requireUVs: z7.boolean().default(false)
}).strict();

// ../model-forge/src/kernel/domain/schema-littlewild.ts
import { z as z8 } from "zod";
var littlewildFamilies = {
  items: "item",
  buildings: "building",
  creatures: "actor",
  pets: "pet"
};
var LittlewildId = z8.string().regex(/^[a-z0-9][a-z0-9_-]{0,60}$/);
var LittlewildVariantSchema = z8.object({
  model: Id,
  parameters: z8.record(Id, NumberValue).default({}),
  /** Replace a model material with an inline specification for this variant. */
  materials: z8.record(Id, MaterialSchema).default({})
}).strict();
var LittlewildAssetSchema = z8.object({
  id: LittlewildId,
  family: z8.enum(["items", "buildings", "creatures", "pets"]),
  name: z8.string().min(1).max(120),
  models: z8.record(LittlewildId, LittlewildVariantSchema).refine((v) => Object.keys(v).length, {
    message: "At least one Littlewild model variant is required."
  }),
  metadata: z8.record(z8.string().max(64), z8.union([z8.number(), z8.string().max(120)])).default({})
}).strict();

// ../model-forge/src/kernel/domain/schema-procedural.ts
import { z as z9 } from "zod";
var PROCEDURAL_MAX_PLACEMENTS = 2e3;
var PROCEDURAL_MAX_CANDIDATES = 2e4;
var Point = z9.tuple([NumberValue, NumberValue]);
var positive = z9.number().finite().positive().max(1e6);
var range = (min, max) => z9.tuple([z9.number().min(min).max(max), z9.number().min(min).max(max)]).refine(([low, high]) => low <= high, "Range minimum must not exceed its maximum.");
var AreaSchema = z9.discriminatedUnion("type", [
  z9.strictObject({ type: z9.literal("rect"), min: Point, max: Point }).refine(
    (area) => area.min[0] < area.max[0] && area.min[1] < area.max[1],
    "rect min must be below max on both axes."
  ),
  z9.strictObject({ type: z9.literal("circle"), center: Point, radius: positive }),
  z9.strictObject({ type: z9.literal("polygon"), points: z9.array(Point).min(3).max(256) }),
  z9.strictObject({
    type: z9.literal("path"),
    points: z9.array(Point).min(2).max(256),
    width: positive
  })
]);
var DistributionSchema = z9.discriminatedUnion("type", [
  /** Blue-noise points no closer than minDistance (Bridson, deterministic). */
  z9.strictObject({ type: z9.literal("poisson"), minDistance: positive }),
  /** A centered grid with step spacing; jitter moves each point up to jitter * step / 2. */
  z9.strictObject({
    type: z9.literal("grid"),
    step: positive,
    jitter: z9.number().min(0).max(1).default(0)
  }),
  /** Points every spacing meters along a polyline; orient yaw faces +Z along the path. */
  z9.strictObject({
    type: z9.literal("path"),
    points: z9.array(Point).min(2).max(256),
    spacing: positive,
    orient: z9.enum(["none", "yaw"]).default("yaw")
  }),
  /** count uniformly random points inside the area. */
  z9.strictObject({
    type: z9.literal("random"),
    count: z9.number().int().min(1).max(PROCEDURAL_MAX_PLACEMENTS)
  })
]);
var ScatterItemSchema = z9.strictObject({
  /** A registered model to instance. */
  model: Id.optional(),
  /** Or an existing mesh/model node of the document to copy (in-model scatter). */
  node: Id.optional(),
  weight: z9.number().finite().positive().max(1e6).default(1),
  /** Per-instance model parameters drawn uniformly from [min, max]. */
  vary: z9.record(Id, range(-1e6, 1e6)).default({})
}).refine((item) => item.model === void 0 !== (item.node === void 0), {
  message: "Each item names exactly one of model or node."
});
var GroundSchema = z9.discriminatedUnion("mode", [
  /** Place each origin on a heightfield mesh node, sunk by sink; reject slopes above maxSlope. */
  z9.strictObject({
    mode: z9.literal("terrain"),
    node: Id,
    sink: z9.number().min(-1e3).max(1e3).default(0),
    maxSlope: z9.number().min(0).max(90).default(90)
  }),
  z9.strictObject({ mode: z9.literal("plane"), y: NumberValue.default(0) }),
  z9.strictObject({ mode: z9.literal("none") })
]);
var ScatterRecipeSchema = z9.strictObject({
  schemaVersion: z9.literal(1),
  kind: z9.literal("scatter"),
  seed: z9.number().int().min(0).max(4294967295).default(1),
  /** The group node that owns every placement; instances are `<group>-<n>`. */
  group: Id.refine((id) => id.length <= 56, "Group IDs are at most 56 characters."),
  parent: Id.optional(),
  /** Required except for path distributions, where it optionally clips the path. */
  area: AreaSchema.optional(),
  exclude: z9.array(AreaSchema).max(64).default([]),
  avoidNodes: z9.strictObject({
    ids: z9.array(Id).min(1).max(256),
    margin: z9.number().min(0).max(1e3).default(0)
  }).optional(),
  distribution: DistributionSchema,
  maxCount: z9.number().int().min(1).max(PROCEDURAL_MAX_PLACEMENTS).default(PROCEDURAL_MAX_PLACEMENTS),
  items: z9.array(ScatterItemSchema).min(1).max(32),
  /** Uniform scale drawn from [min, max]. */
  scale: range(1e-3, 1e3).default([1, 1]),
  rotation: z9.strictObject({
    /** Degrees; defaults to [0, 360], or [0, 0] added to the path heading for orient yaw. */
    yaw: range(-3600, 3600).optional(),
    /** Degrees about X and Z, each drawn from this range. */
    tilt: range(-90, 90).default([0, 0])
  }).default({ tilt: [0, 0] }),
  ground: GroundSchema.default({ mode: "none" })
}).refine((recipe) => recipe.area !== void 0 || recipe.distribution.type === "path", {
  message: "area is required unless the distribution is a path.",
  path: ["area"]
});

// ../model-forge/src/kernel/domain/parse.ts
function parse(schema, input) {
  const pending = [[input, 0, false]];
  const visited = /* @__PURE__ */ new WeakSet(), active = /* @__PURE__ */ new WeakSet();
  while (pending.length) {
    const [value, depth, leaving] = pending.pop();
    if (value && typeof value === "object") {
      if (leaving) {
        active.delete(value);
        continue;
      }
      if (active.has(value)) fail("CYCLE", "Input must be acyclic JSON data.");
      if (depth > 128) fail("DEPTH_LIMIT", "Input nesting exceeds 128 levels.");
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
      "SCHEMA_INVALID",
      "Input does not match the schema. Use the schema command to inspect the contract.",
      result.error.issues.map((i) => ({ path: i.path.join("."), message: i.message }))
    );
  return result.data;
}

// ../model-forge/src/kernel/domain/canonical.ts
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value;
    return `{${Object.keys(record).filter((key) => record[key] !== void 0).sort().map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

// ../model-forge/src/kernel/domain/identity.ts
function uuid(key) {
  let a = 2166136261;
  const words = [];
  for (let j = 0; j < 4; j++) {
    for (let i = 0; i < key.length; i++) {
      a ^= key.charCodeAt(i) + j;
      a = Math.imul(a, 16777619);
    }
    words.push((a >>> 0).toString(16).padStart(8, "0"));
  }
  const hex = words.join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20)}`;
}

// ../model-forge/src/kernel/domain/rig.ts
function validateRig(rig) {
  const joints = new Map(rig.joints.map((joint) => [joint.id, joint]));
  if (joints.size !== rig.joints.length) fail("RIG_INVALID", "Joint IDs must be unique.");
  if (rig.joints.filter((joint) => !joint.parent).length !== 1)
    fail("RIG_INVALID", "A rig needs exactly one root joint.");
  for (const joint of rig.joints) {
    const visited = /* @__PURE__ */ new Set([joint.id]);
    let parent = joint.parent;
    while (parent) {
      if (!joints.has(parent)) fail("RIG_INVALID", `Unknown parent joint ${parent}.`);
      if (visited.has(parent)) fail("RIG_INVALID", `Joint cycle at ${parent}.`);
      visited.add(parent);
      parent = joints.get(parent).parent;
    }
    if (![...joint.position, ...joint.rotation].every((n) => Number.isFinite(n) && Math.abs(n) <= 1e6))
      fail("RIG_INVALID", "Joint coordinates must be finite and within \xB11,000,000.");
  }
  for (const id of [...Object.keys(rig.pose), ...Object.values(rig.bindings)])
    if (!joints.has(id)) fail("RIG_INVALID", `Unknown joint ${id}.`);
  for (const rotation2 of Object.values(rig.pose))
    if (!rotation2.every((n) => Number.isFinite(n) && Math.abs(n) <= 1e6))
      fail("RIG_INVALID", "Pose rotations must be finite and within \xB11,000,000.");
  const clips = /* @__PURE__ */ new Set();
  for (const clip of rig.clips) {
    if (clips.has(clip.id)) fail("RIG_INVALID", `Duplicate clip ${clip.id}.`);
    clips.add(clip.id);
    const tracks = /* @__PURE__ */ new Set();
    for (const track of clip.tracks) {
      if (!joints.has(track.joint) || tracks.has(track.joint))
        fail("RIG_INVALID", `Clip ${clip.id} needs unique, existing joint tracks.`);
      tracks.add(track.joint);
      let previous = -1;
      for (const frame of track.keyframes) {
        if (!Number.isFinite(frame.time) || frame.time <= previous || frame.time > clip.duration)
          fail("RIG_INVALID", `Clip ${clip.id} keyframe times must increase within its duration.`);
        if (!frame.rotation.every((n) => Number.isFinite(n) && Math.abs(n) <= 1e6))
          fail("RIG_INVALID", `Clip ${clip.id} has an invalid rotation.`);
        previous = frame.time;
      }
    }
  }
}

// ../model-forge/src/kernel/domain/scalar.ts
function scalar(value, params, depth = 0) {
  if (depth > 16) fail("EXPRESSION_DEPTH", "Scalar expressions may nest at most 16 levels.");
  let n;
  if (typeof value === "number") n = value;
  else if ("$param" in value) {
    if (!Object.hasOwn(params, value.$param))
      fail("PARAMETER_MISSING", `Parameter ${value.$param} is not defined.`);
    n = params[value.$param];
  } else {
    const args = value.args.map((v) => scalar(v, params, depth + 1));
    const arity = { sub: 2, div: 2, abs: 1, neg: 1, sin: 1, cos: 1, clamp: 3 }[value.$expr];
    if (arity && args.length !== arity)
      fail("EXPRESSION_ARITY", `${value.$expr} requires ${arity} arguments.`);
    switch (value.$expr) {
      case "add":
        n = args.reduce((a, b) => a + b, 0);
        break;
      case "sub":
        n = args[0] - args[1];
        break;
      case "mul":
        n = args.reduce((a, b) => a * b, 1);
        break;
      case "div":
        if (args[1] === 0) fail("EXPRESSION_DIV_ZERO", "Cannot divide by zero.");
        n = args[0] / args[1];
        break;
      case "min":
        n = Math.min(...args);
        break;
      case "max":
        n = Math.max(...args);
        break;
      case "abs":
        n = Math.abs(args[0]);
        break;
      case "neg":
        n = -args[0];
        break;
      case "sin":
        n = Math.sin(args[0] * Math.PI / 180);
        break;
      case "cos":
        n = Math.cos(args[0] * Math.PI / 180);
        break;
      case "clamp":
        if (args[1] > args[2]) fail("EXPRESSION_RANGE", "Clamp minimum exceeds maximum.");
        n = Math.min(args[2], Math.max(args[1], args[0]));
        break;
      default:
        return fail("EXPRESSION_OPERATOR", "Unsupported expression operator.");
    }
  }
  if (!Number.isFinite(n) || Math.abs(n) > 1e6)
    fail("EXPRESSION_RANGE", "Scalar result must be finite and between -1,000,000 and 1,000,000.", {
      value: n
    });
  return n;
}

// ../model-forge/src/kernel/domain/validate.ts
function resolveData(value, params) {
  if (Array.isArray(value)) return value.map((v) => resolveData(v, params));
  if (value && typeof value === "object") {
    if ("$param" in value || "$expr" in value)
      return scalar(value, params);
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, resolveData(v, params)])
    );
  }
  return value;
}
function modelParameters(model, overrides = {}) {
  for (const k of Object.keys(overrides))
    if (!Object.hasOwn(model.parameters, k))
      fail("UNKNOWN_PARAMETER", `Model ${model.id} has no parameter ${k}.`);
  return Object.fromEntries(
    Object.entries(model.parameters).map(([id, p]) => {
      const v = overrides[id] ?? p.default;
      if (p.min !== void 0 && p.max !== void 0 && p.min > p.max)
        fail("PARAMETER_RANGE", `${model.id}.${id} has a minimum greater than its maximum.`);
      if (p.integer && !Number.isInteger(v))
        fail("PARAMETER_INTEGER", `${model.id}.${id} requires an integer.`, { value: v });
      if (p.min !== void 0 && v < p.min || p.max !== void 0 && v > p.max)
        fail("PARAMETER_RANGE", `${model.id}.${id} is outside its permitted range.`, {
          value: v,
          min: p.min,
          max: p.max
        });
      return [id, v];
    })
  );
}
function validTransform(t) {
  if (t?.scale?.some((v) => typeof v === "number" && Math.abs(v) < 1e-6))
    fail("INVALID_SCALE", "Scale components cannot be zero.");
}
function validateDocument(document2, models = {}, stack = []) {
  if (stack.length > 16) fail("DEPTH_LIMIT", "Model nesting exceeds 16 levels.");
  if (document2.kind === "scene" && document2.camera && document2.camera.position.every((v, i) => v === document2.camera.target[i]))
    fail("INVALID_CAMERA", "Camera position and target must differ.");
  const params = document2.kind === "scene" ? document2.parameters : modelParameters(document2);
  const d = resolveData(document2, params);
  const ids = /* @__PURE__ */ new Set();
  for (const n of d.nodes) {
    if (ids.has(n.id)) fail("DUPLICATE_ID", `Duplicate node ${n.id}.`);
    ids.add(n.id);
  }
  const nodes2 = new Map(d.nodes.map((n) => [n.id, n]));
  for (const n of d.nodes) {
    validTransform(n.transform);
    if (n.pattern) {
      const counts = n.pattern.type === "grid" ? n.pattern.counts : [n.pattern.type === "path" ? n.pattern.points.length : n.pattern.count];
      if (counts.some((c) => !Number.isInteger(c) || c < 1 || c > 256) || counts.reduce((a, b) => a * b, 1) > 256)
        fail(
          "PATTERN_COUNT",
          `Pattern ${n.id} requires positive integer counts and at most 256 copies.`
        );
      if (n.type !== "mesh" && n.type !== "model")
        fail(
          "INVALID_NODE_TYPE",
          "Patterns apply to meshes or model instances, not groups or lights."
        );
    }
    if (n.pattern?.type === "path" && n.pattern.orient === "yaw") {
      for (let i = 1; i < n.pattern.points.length; i++) {
        const a = n.pattern.points[i - 1], b = n.pattern.points[i];
        if (Math.hypot(b[0] - a[0], b[2] - a[2]) < 1e-9)
          fail(
            "PATTERN_PATH",
            `Path ${n.id} needs horizontal separation between points for yaw orientation. Use orient: none for vertical placement.`
          );
      }
    }
    if (n.parent && !ids.has(n.parent))
      fail("REFERENCE_MISSING", `Parent ${n.parent} of ${n.id} does not exist.`);
    let current = n.parent;
    const visited = /* @__PURE__ */ new Set([n.id]);
    while (current) {
      if (visited.size > 64) fail("DEPTH_LIMIT", "Node hierarchy exceeds 64 levels.");
      if (visited.has(current)) fail("CYCLE", `Parent cycle includes ${n.id}.`);
      visited.add(current);
      current = nodes2.get(current)?.parent;
    }
    if (n.pattern && d.nodes.some((child) => child.parent === n.id))
      fail(
        "PATTERN_HAS_CHILDREN",
        `Pattern node ${n.id} cannot have child nodes; pattern a model instance instead.`
      );
    if (n.pattern?.type === "radial" && n.pattern.radius < 0)
      fail("INVALID_GEOMETRY", `Radial pattern ${n.id} requires a nonnegative radius.`);
    if (n.type === "mesh") {
      if (!Object.hasOwn(d.geometries, n.geometry))
        fail("REFERENCE_MISSING", `Geometry ${n.geometry} used by ${n.id} does not exist.`);
      if (!Object.hasOwn(d.materials, n.material))
        fail("REFERENCE_MISSING", `Material ${n.material} used by ${n.id} does not exist.`);
    }
    if (n.type === "model") {
      if (n.rig) {
        validateRig(n.rig);
        if (d.nodes.some((child) => child.parent === n.id))
          fail(
            "RIG_CHILDREN",
            `Rigged instance ${n.id} cannot have authored children. Include them in its model recipe first.`
          );
      }
      const m = models[n.model];
      if (!Object.hasOwn(models, n.model))
        fail("REFERENCE_MISSING", `Model ${n.model} used by ${n.id} is not registered.`);
      if (stack.includes(n.model))
        fail("CYCLE", `Model cycle: ${[...stack, n.model].join(" -> ")}.`);
      for (const [from, to] of Object.entries(n.materialOverrides)) {
        if (!Object.hasOwn(m.materials, from) || !Object.hasOwn(d.materials, to))
          fail("REFERENCE_MISSING", `Invalid material override ${from} -> ${to} on ${n.id}.`);
      }
      const mp = modelParameters(m, n.parameters);
      validateDocument(
        { ...m, ...resolveData({ geometries: m.geometries, nodes: m.nodes }, mp), parameters: {} },
        models,
        [...stack, n.model]
      );
    }
  }
  const geometryStack = /* @__PURE__ */ new Set();
  const checked = /* @__PURE__ */ new Set();
  const checkGeometry = (id) => {
    if (geometryStack.has(id)) fail("CYCLE", `Geometry cycle includes ${id}.`);
    if (checked.has(id)) return;
    const g = d.geometries[id];
    if (!Object.hasOwn(d.geometries, id))
      fail("REFERENCE_MISSING", `Geometry ${id} does not exist.`);
    if (geometryStack.size > 64)
      fail("DEPTH_LIMIT", "Geometry dependency chain exceeds 64 levels.");
    geometryStack.add(id);
    const positive2 = (v, label, allowZero = false) => {
      if (typeof v !== "number" || !Number.isFinite(v) || (allowZero ? v < 0 : v <= 0))
        fail(
          "INVALID_GEOMETRY",
          `${id}.${label} must be ${allowZero ? "nonnegative" : "positive"}.`
        );
    };
    if ("size" in g) g.size.forEach((v) => positive2(v, "size"));
    for (const k of ["radius", "height", "tube", "depth"])
      if (k in g) positive2(g[k], k);
    if (g.type === "organic") {
      for (const [field, min, max] of [
        ["roundness", 0.65, 1.5],
        ["taper", -0.65, 0.65],
        ["bend", -0.75, 0.75]
      ])
        if (g[field] < min || g[field] > max)
          fail("INVALID_GEOMETRY", `${id}.${field} must be between ${min} and ${max}.`);
      if (g.profile) {
        if (g.profile[0].at !== -1 || g.profile.at(-1).at !== 1)
          fail("INVALID_GEOMETRY", `${id}.profile must start at -1 and end at 1.`);
        for (const [index, station] of g.profile.entries()) {
          if (station.at < -1 || station.at > 1 || index > 0 && station.at - g.profile[index - 1].at < 0.02 - 1e-12)
            fail(
              "INVALID_GEOMETRY",
              `${id}.profile heights must increase by at least 0.02 within -1..1.`
            );
          if ([station.width, station.depth].some((value) => value < 0.1 || value > 2))
            fail("INVALID_GEOMETRY", `${id}.profile width/depth must be between 0.1 and 2.`);
          if (station.offset.some((value) => value < -0.75 || value > 0.75))
            fail("INVALID_GEOMETRY", `${id}.profile offset must be between -0.75 and 0.75.`);
        }
      }
    }
    if (g.type === "tube") {
      if (g.closed && g.points.length < 3)
        fail("INVALID_GEOMETRY", `Closed tube ${id} needs at least three points.`);
      const edges = g.closed ? g.points.length : g.points.length - 1;
      for (let i = 0; i < edges; i++) {
        const a = g.points[i], b = g.points[(i + 1) % g.points.length];
        if (Math.hypot(...b.map((v, j) => v - a[j])) < 1e-9)
          fail(
            "INVALID_GEOMETRY",
            `Tube ${id} has coincident consecutive points; omit a duplicated closing point.`
          );
      }
    }
    if (g.type === "cylinder") {
      positive2(g.radiusTop, "radiusTop", true);
      positive2(g.radiusBottom, "radiusBottom", true);
      if (g.radiusTop === 0 && g.radiusBottom === 0)
        fail("INVALID_GEOMETRY", `${id} needs at least one nonzero radius.`);
    }
    if (g.type === "capsule") positive2(g.length, "length", true);
    if (g.type === "heightfield") {
      positive2(g.amplitude, "amplitude", true);
      if (g.bands?.some((band, index) => index > 0 && band.below <= g.bands[index - 1].below))
        fail("INVALID_GEOMETRY", `${id}.bands must list strictly increasing below values.`);
    }
    if (g.type === "extrude" && g.bevel !== void 0) positive2(g.bevel, "bevel", true);
    if (g.type === "lathe") g.points.forEach((p) => positive2(p[0], "point radius", true));
    if (g.type === "mesh" && (g.indices.length % 3 || g.indices.some((i) => i >= g.positions.length)))
      fail("INVALID_GEOMETRY", `${id} needs triangle indices inside the positions array.`);
    if (g.type === "mesh") {
      for (const name of ["normals", "uvs"])
        if (g[name] && g[name].length !== g.positions.length)
          fail("INVALID_GEOMETRY", `${id}.${name} must contain one value per position.`);
      if (g.normals?.some((n) => Math.hypot(...n) < 1e-12))
        fail(
          "INVALID_GEOMETRY",
          `${id}.normals must be nonzero; they are normalized on compilation.`
        );
    }
    if (g.type === "boolean") {
      validTransform(g.leftTransform);
      validTransform(g.rightTransform);
      checkGeometry(g.left);
      checkGeometry(g.right);
    }
    geometryStack.delete(id);
    checked.add(id);
  };
  Object.keys(d.geometries).forEach(checkGeometry);
}

// ../model-forge/src/kernel/domain/random.ts
var SEED_MAX = 4294967295;
var DEFAULT_SEED = 1;
function cyrb128(text) {
  let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
  for (let i = 0; i < text.length; i++) {
    const k = text.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ h1 >>> 18, 597399067);
  h2 = Math.imul(h4 ^ h2 >>> 22, 2869860233);
  h3 = Math.imul(h1 ^ h3 >>> 17, 951274213);
  h4 = Math.imul(h2 ^ h4 >>> 19, 2716044179);
  return [(h1 ^ h2 ^ h3 ^ h4) >>> 0, (h2 ^ h1) >>> 0, (h3 ^ h1) >>> 0, (h4 ^ h1) >>> 0];
}
function checkSeed(seed) {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > SEED_MAX)
    fail("INVALID_OPTION", `Seed must be a whole number from 0 to ${SEED_MAX}.`, { seed });
  return seed;
}
function createRandom(seed = DEFAULT_SEED, stream = "default") {
  checkSeed(seed);
  let [a, b, c, d] = cyrb128(seed + "|" + stream);
  const round3 = () => {
    const t = (a + b | 0) + d | 0;
    d = d + 1 | 0;
    a = b ^ b >>> 9;
    b = c + (c << 3) | 0;
    c = c << 21 | c >>> 11;
    c = c + t | 0;
    return t >>> 0;
  };
  for (let warm = 0; warm < 12; warm++) round3();
  const next = () => round3() / 4294967296;
  const random = {
    seed,
    stream,
    next,
    range: (min, max) => min + next() * (max - min),
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    pick: (items, weights) => {
      if (!items.length) fail("INVALID_OPTION", "Cannot pick from an empty list.");
      if (!weights) return items[Math.floor(next() * items.length)];
      if (weights.length !== items.length || weights.some((w) => !Number.isFinite(w) || w < 0) || !weights.some((w) => w > 0))
        fail("INVALID_OPTION", "Pick weights must be nonnegative, one per item, not all zero.");
      const total = weights.reduce((sum, w) => sum + w, 0), r = next() * total;
      let upto = 0, last = 0;
      for (let i = 0; i < items.length; i++) {
        if (weights[i] > 0) last = i;
        upto += weights[i];
        if (r < upto) return items[i];
      }
      return items[last];
    },
    fork: (key) => createRandom(seed, stream + "/" + key)
  };
  return random;
}

// ../model-forge/src/kernel/domain/digest.ts
var K = new Uint32Array([
  1116352408,
  1899447441,
  3049323471,
  3921009573,
  961987163,
  1508970993,
  2453635748,
  2870763221,
  3624381080,
  310598401,
  607225278,
  1426881987,
  1925078388,
  2162078206,
  2614888103,
  3248222580,
  3835390401,
  4022224774,
  264347078,
  604807628,
  770255983,
  1249150122,
  1555081692,
  1996064986,
  2554220882,
  2821834349,
  2952996808,
  3210313671,
  3336571891,
  3584528711,
  113926993,
  338241895,
  666307205,
  773529912,
  1294757372,
  1396182291,
  1695183700,
  1986661051,
  2177026350,
  2456956037,
  2730485921,
  2820302411,
  3259730800,
  3345764771,
  3516065817,
  3600352804,
  4094571909,
  275423344,
  430227734,
  506948616,
  659060556,
  883997877,
  958139571,
  1322822218,
  1537002063,
  1747873779,
  1955562222,
  2024104815,
  2227730452,
  2361852424,
  2428436474,
  2756734187,
  3204031479,
  3329325298
]);
var rotr = (x, n) => x >>> n | x << 32 - n;
function sha256Hex(text) {
  const bytes = new TextEncoder().encode(text);
  const length = Math.ceil((bytes.length + 9) / 64) * 64;
  const data = new Uint8Array(length);
  data.set(bytes);
  data[bytes.length] = 128;
  const view = new DataView(data.buffer);
  view.setUint32(length - 8, Math.floor(bytes.length / 536870912));
  view.setUint32(length - 4, bytes.length * 8 >>> 0);
  const h = new Uint32Array([
    1779033703,
    3144134277,
    1013904242,
    2773480762,
    1359893119,
    2600822924,
    528734635,
    1541459225
  ]);
  const w = new Uint32Array(64);
  for (let offset = 0; offset < length; offset += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(offset + i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ w[i - 15] >>> 3;
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ w[i - 2] >>> 10;
      w[i] = w[i - 16] + s0 + w[i - 7] + s1 >>> 0;
    }
    let [a, b, c, d, e, f, g, k] = h;
    for (let i = 0; i < 64; i++) {
      const t1 = k + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + (e & f ^ ~e & g) + K[i] + w[i] >>> 0;
      const t2 = (rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + (a & b ^ a & c ^ b & c) >>> 0;
      k = g;
      g = f;
      f = e;
      e = d + t1 >>> 0;
      d = c;
      c = b;
      b = a;
      a = t1 + t2 >>> 0;
    }
    const next = [a, b, c, d, e, f, g, k];
    for (let i = 0; i < 8; i++) h[i] = h[i] + next[i] >>> 0;
  }
  return Array.from(h, (v) => v.toString(16).padStart(8, "0")).join("");
}

// ../model-forge/src/kernel/application/surfaces.ts
import * as THREE from "three";

// ../model-forge/src/kernel/application/surface-pattern.ts
var surfaceAlgorithm = "littlewild-surface-v1";
var SIZE = 128;
function resolveSurfaceAlgorithm(surface) {
  return surface.version === 2 ? "littlewild-surface-v2" : "littlewild-surface-v1";
}
function noise(x, y, seed) {
  let n = Math.imul(x ^ seed, 374761393) ^ Math.imul(y + seed, 668265263);
  n = Math.imul(n ^ n >>> 13, 1274126177);
  return ((n ^ n >>> 16) >>> 0) / 4294967295;
}
function generateSurface(surface) {
  if (surface.version !== void 0 && surface.version !== 1 && surface.version !== 2 || !["fur", "cloth", "leather"].includes(surface.kind) || !Number.isInteger(surface.seed) || surface.seed < 0 || surface.seed > 65535 || !Number.isFinite(surface.scale) || surface.scale < 1 || surface.scale > 16 || !Number.isFinite(surface.strength) || surface.strength < 0 || surface.strength > 1)
    throw Error("Invalid bounded asset surface");
  const heights = new Float64Array(SIZE * SIZE), color = new Uint8Array(SIZE * SIZE * 4), normal = new Uint8Array(color.length);
  const sample = (x, y) => noise((x + SIZE) % SIZE, (y + SIZE) % SIZE, surface.seed);
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++) {
      const grain = sample(x, y);
      let h;
      if (surface.kind === "fur") {
        h = 0.55 * sample(x, Math.floor(y / 4)) + 0.25 * sample(x - 1, Math.floor((y + 2) / 4)) + 0.2 * grain;
      } else if (surface.kind === "cloth") {
        const warp = 0.5 + 0.5 * Math.cos(x * Math.PI / 2), weft = 0.5 + 0.5 * Math.cos(y * Math.PI / 2);
        h = 0.45 * warp + 0.45 * weft + 0.1 * grain;
      } else h = 0.65 * grain + 0.35 * sample(Math.floor(x / 3), Math.floor(y / 3));
      heights[y * SIZE + x] = h;
    }
  if (surface.version === 2) fineHeights(surface, heights);
  const height2 = (x, y) => heights[(y + SIZE) % SIZE * SIZE + (x + SIZE) % SIZE];
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++) {
      const i = (y * SIZE + x) * 4, h = height2(x, y), strength = surface.strength;
      const relief = surface.version === 2 ? 0.38 : 0.65;
      const dx = (height2(x - 1, y) - height2(x + 1, y)) * strength * relief, dy = (height2(x, y - 1) - height2(x, y + 1)) * strength * relief;
      const length = Math.hypot(dx, dy, 1), shade = Math.round(
        255 - (1 - h) * strength * (surface.version === 2 ? 18 : surface.kind === "fur" ? 26 : 20)
      );
      color.set([shade, shade, shade, 255], i);
      normal.set(
        [
          Math.round((dx / length * 0.5 + 0.5) * 255),
          Math.round((dy / length * 0.5 + 0.5) * 255),
          Math.round((1 / length * 0.5 + 0.5) * 255),
          255
        ],
        i
      );
    }
  return { width: SIZE, height: SIZE, color, normal };
}
function fineHeights(surface, heights) {
  const sample = (x, y) => noise((x + SIZE) % SIZE, (y + SIZE) % SIZE, surface.seed);
  if (surface.kind === "fur") {
    for (let i = 0; i < heights.length; i++)
      heights[i] = 0.28 + 0.025 * sample(i % SIZE, Math.floor(i / SIZE));
    for (let strand = 0; strand < 1800; strand++) {
      const x0 = noise(strand, 0, surface.seed) * SIZE, y0 = Math.floor(noise(strand, 1, surface.seed) * SIZE);
      const length = 6 + Math.floor(noise(strand, 2, surface.seed) * 13), lean = (noise(strand, 3, surface.seed) - 0.5) * 0.6;
      const width = 0.45 + noise(strand, 4, surface.seed) * 0.35, relief = 0.25 + 0.3 * noise(strand, 5, surface.seed);
      for (let step = 0; step < length; step++) {
        const t = step / (length - 1), center = x0 + lean * step + Math.sin(t * Math.PI) * 0.65;
        const envelope = Math.pow(Math.sin(t * Math.PI), 0.65), y = (y0 + step) % SIZE;
        for (let offset = -1; offset <= 1; offset++) {
          const x = Math.floor(center) + offset, distance = Math.abs(x + 0.5 - center) / width;
          if (distance >= 1.5) continue;
          const h = 0.28 + relief * envelope * Math.exp(-distance * distance * 2), index = y * SIZE + (x % SIZE + SIZE) % SIZE;
          heights[index] = Math.max(heights[index], h);
        }
      }
    }
    return;
  }
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++) {
      if (surface.kind === "cloth") {
        const warp = 0.5 + 0.5 * Math.cos(x * Math.PI / 2), weft = 0.5 + 0.5 * Math.cos(y * Math.PI / 2);
        const over = (Math.floor(x / 4) + Math.floor(y / 4)) % 2 === 0;
        heights[y * SIZE + x] = 0.3 + 0.25 * (over ? warp : weft) + 0.08 * (over ? weft : warp) + 0.025 * sample(x, y);
      } else
        heights[y * SIZE + x] = 0.4 + 0.08 * sample(x, y) + 0.06 * (sample(x - 1, y) + sample(x + 1, y) + sample(x, y - 1) + sample(x, y + 1));
    }
}
function sphereUVs(positions) {
  const out = [];
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i], y = positions[i + 1], z13 = positions[i + 2], r = Math.hypot(x, y, z13);
    out.push(
      0.5 + Math.atan2(z13, x) / (2 * Math.PI),
      r ? Math.acos(Math.max(-1, Math.min(1, y / r))) / Math.PI : 0.5
    );
  }
  return out;
}

// ../model-forge/src/kernel/application/surfaces.ts
var maxSurfaceRecipes = 256;
function createSurfacePool() {
  const recipes = /* @__PURE__ */ new Map();
  function apply(material2, surface) {
    const { version, ...legacy } = surface;
    const surfaceAlgorithm2 = resolveSurfaceAlgorithm(surface);
    const key = `${surfaceAlgorithm2}/${canonical(version === 1 ? legacy : surface)}`;
    let maps = recipes.get(key);
    if (!maps) {
      if (recipes.size >= maxSurfaceRecipes)
        fail(
          "SCENE_BUDGET",
          `Scene exceeds ${maxSurfaceRecipes} distinct surface recipes. Reuse kind/seed/scale/strength across material colors.`
        );
      const pixels = generateSurface(surface);
      const texture = (data, name) => {
        const map = new THREE.DataTexture(data, pixels.width, pixels.height, THREE.RGBAFormat);
        map.name = `${key}/${name}`;
        map.uuid = uuid(map.name);
        Object.defineProperty(map.source, "uuid", { value: uuid(`${map.name}/source`) });
        map.wrapS = map.wrapT = THREE.RepeatWrapping;
        map.repeat.set(surface.scale, surface.scale);
        map.magFilter = THREE.LinearFilter;
        map.minFilter = THREE.LinearMipmapLinearFilter;
        map.generateMipmaps = true;
        map.needsUpdate = true;
        return map;
      };
      maps = { color: texture(pixels.color, "color"), normal: texture(pixels.normal, "normal") };
      maps.color.colorSpace = THREE.SRGBColorSpace;
      recipes.set(key, maps);
    }
    material2.map = maps.color;
    material2.normalMap = maps.normal;
    material2.userData = {
      ...material2.userData,
      surface: structuredClone(surface),
      surfaceAlgorithm: surfaceAlgorithm2
    };
  }
  function dispose() {
    for (const maps of recipes.values()) {
      maps.color.dispose();
      maps.normal.dispose();
    }
    recipes.clear();
  }
  return { apply, dispose };
}
function applySurface(material2, surface, owner) {
  const pool = owner ?? createSurfacePool();
  pool.apply(material2, surface);
  if (!owner) material2.addEventListener("dispose", pool.dispose);
}
function ensureSurfaceTangents(geometry) {
  if (geometry.getAttribute("tangent")) return;
  if (!geometry.index)
    geometry.setIndex(Array.from({ length: geometry.getAttribute("position").count }, (_, i) => i));
  geometry.computeTangents();
  const tangents = geometry.getAttribute("tangent"), normals = geometry.getAttribute("normal");
  const normal = new THREE.Vector3(), tangent = new THREE.Vector3();
  for (let i = 0; i < tangents.count; i++) {
    tangent.fromBufferAttribute(tangents, i);
    if (!Number.isFinite(tangent.lengthSq()) || tangent.lengthSq() < 1e-12 || Math.abs(tangents.getW(i)) !== 1) {
      normal.fromBufferAttribute(normals, i).normalize();
      tangent.set(Math.abs(normal.y) > 0.9 ? 1 : 0, Math.abs(normal.y) > 0.9 ? 0 : 1, 0).cross(normal).normalize();
      tangents.setXYZW(i, tangent.x, tangent.y, tangent.z, 1);
    }
  }
}

// ../model-forge/src/kernel/application/rigging.ts
import * as THREE3 from "three";

// ../model-forge/src/kernel/application/transforms.ts
import * as THREE2 from "three";
var radians = (v) => THREE2.MathUtils.degToRad(v);
function transform(object, t) {
  if (t?.position) object.position.fromArray(t.position);
  if (t?.rotation)
    object.rotation.set(
      ...t.rotation.map(radians)
    );
  if (t?.scale) object.scale.fromArray(t.scale);
  object.updateMatrixWorld(true);
}
var triangles = (g) => (g.index?.count ?? g.getAttribute("position").count) / 3;

// ../model-forge/src/kernel/application/rigging.ts
var rotation = (value) => new THREE3.Euler(...value.map(THREE3.MathUtils.degToRad));
var rigClips = (root) => {
  const clips = [];
  root.traverse((object) => clips.push(...object.animations));
  return clips;
};
function bindRig(root, spec) {
  validateRig(spec);
  const meshes = [];
  root.traverse((object) => {
    if (object instanceof THREE3.SkinnedMesh)
      fail("RIG_NESTED", "A rig cannot contain another rig.");
    if (object instanceof THREE3.Mesh) meshes.push(object);
  });
  if (!meshes.length) fail("RIG_EMPTY", "A rig needs a model containing meshes.");
  if (meshes.reduce((sum, mesh) => sum + mesh.geometry.getAttribute("position").count, 0) > 2e5)
    fail("RIG_BUDGET", "A rig supports at most 200,000 skin vertices.");
  const knownPaths = new Set(meshes.map((mesh) => mesh.name.slice(root.name.length + 1)));
  for (const path13 of Object.keys(spec.bindings))
    if (!knownPaths.has(path13))
      fail(
        "RIG_BINDING",
        `Rig binding ${path13} does not match a mesh path relative to ${root.name}.`
      );
  root.updateWorldMatrix(true, true);
  const inverse = root.matrixWorld.clone().invert();
  const ordered = [...spec.joints].sort((a, b) => Number(!!a.parent) - Number(!!b.parent));
  const bones = new Map(
    ordered.map((joint) => {
      const bone = new THREE3.Bone();
      bone.name = `${root.name}/joints/${joint.id}`;
      bone.uuid = uuid(bone.name);
      bone.userData = { jointId: joint.id };
      bone.position.fromArray(joint.position);
      bone.rotation.copy(rotation(joint.rotation));
      return [joint.id, bone];
    })
  );
  for (const joint of ordered)
    (joint.parent ? bones.get(joint.parent) : root).add(bones.get(joint.id));
  root.updateWorldMatrix(true, true);
  const skeleton = new THREE3.Skeleton([...bones.values()]);
  const origins = [...bones.values()].map(
    (bone) => bone.getWorldPosition(new THREE3.Vector3()).applyMatrix4(inverse)
  );
  const geometries = [];
  const skins = [];
  for (const mesh of meshes) {
    const geometry = mesh.geometry.clone().applyMatrix4(inverse.clone().multiply(mesh.matrixWorld));
    const positions = geometry.getAttribute("position");
    const indices = new Uint16Array(positions.count * 4), weights = new Float32Array(positions.count * 4);
    const explicit = spec.bindings[mesh.name.slice(root.name.length + 1)];
    const explicitIndex = ordered.findIndex((joint) => joint.id === explicit);
    for (let i = 0; i < positions.count; i++) {
      const point2 = new THREE3.Vector3().fromBufferAttribute(positions, i);
      const nearest = origins.map((origin, index) => ({ index, distance: point2.distanceTo(origin) })).sort((a, b) => a.distance - b.distance || a.index - b.index);
      const first = explicit ? explicitIndex : nearest[0].index;
      indices[i * 4] = first;
      weights[i * 4] = 1;
      if (!explicit && spec.binding === "smooth" && nearest.length > 1) {
        const a = nearest[0].distance, b = nearest[1].distance;
        const weight = b / Math.max(a + b, 1e-12);
        indices[i * 4 + 1] = nearest[1].index;
        weights[i * 4] = weight;
        weights[i * 4 + 1] = 1 - weight;
      }
    }
    geometry.setAttribute("skinIndex", new THREE3.Uint16BufferAttribute(indices, 4));
    geometry.setAttribute("skinWeight", new THREE3.Float32BufferAttribute(weights, 4));
    const skin = new THREE3.SkinnedMesh(geometry, mesh.material);
    skin.name = mesh.name;
    skin.uuid = mesh.uuid;
    skin.userData = { ...mesh.userData };
    skin.visible = mesh.visible;
    for (let parent = mesh.parent; parent && parent !== root; parent = parent.parent)
      skin.visible &&= parent.visible;
    skin.castShadow = mesh.castShadow;
    skin.receiveShadow = mesh.receiveShadow;
    mesh.removeFromParent();
    root.add(skin);
    skin.bind(skeleton, root.matrixWorld);
    geometries.push(geometry);
    skins.push(skin);
  }
  root.animations = spec.clips.map(
    (clip) => new THREE3.AnimationClip(
      `${root.name}/${clip.id}`,
      clip.duration,
      clip.tracks.map(
        (track) => new THREE3.QuaternionKeyframeTrack(
          `${bones.get(track.joint).uuid}.quaternion`,
          track.keyframes.map((frame) => frame.time),
          track.keyframes.flatMap(
            (frame) => new THREE3.Quaternion().setFromEuler(rotation(frame.rotation)).toArray()
          )
        )
      )
    )
  );
  function pose() {
    for (const joint of ordered)
      bones.get(joint.id).rotation.copy(rotation(spec.pose[joint.id] ?? joint.rotation));
    root.updateWorldMatrix(true, true);
    skeleton.update();
    skins.forEach((skin) => {
      skin.computeBoundingBox();
      skin.computeBoundingSphere();
    });
  }
  pose();
  return {
    bones,
    skeleton,
    pose,
    dispose: () => {
      geometries.forEach((g) => g.dispose());
      skeleton.dispose();
    }
  };
}

// ../model-forge/src/kernel/application/lights.ts
import * as THREE4 from "three";
function orientLight(light) {
  for (const child of [...light.children])
    if (child.name === "forgeLightTarget") light.remove(child);
  const target = new THREE4.Object3D();
  target.name = "forgeLightTarget";
  target.position.set(0, 0, -1);
  light.add(target);
  light.target = target;
}
function createLight(node) {
  const light = node.light === "directional" ? new THREE4.DirectionalLight(node.color, node.intensity) : node.light === "spot" ? new THREE4.SpotLight(
    node.color,
    node.intensity,
    node.distance,
    THREE4.MathUtils.degToRad(node.angle),
    node.penumbra,
    2
  ) : new THREE4.PointLight(node.color, node.intensity, node.distance, 2);
  light.castShadow = node.castShadow;
  if (light instanceof THREE4.SpotLight || light instanceof THREE4.DirectionalLight)
    orientLight(light);
  return light;
}

// ../model-forge/src/kernel/application/compiler.ts
import * as THREE10 from "three";

// ../model-forge/src/kernel/application/mesh-source.ts
var sources = /* @__PURE__ */ new WeakMap();
function rememberMeshSource(geometry, source) {
  const attributes = ["position", "normal", "uv"].filter((name) => geometry.getAttribute(name)).map((name) => {
    const attribute = geometry.getAttribute(name);
    return {
      name,
      size: attribute.itemSize,
      normalized: attribute.normalized,
      attributeType: attribute.constructor,
      arrayType: attribute.array.constructor,
      values: attribute.array.slice()
    };
  });
  sources.set(geometry, { source, attributes, indices: geometry.index.array.slice() });
  geometry.addEventListener("dispose", () => sources.delete(geometry));
}
function authoredMeshBuffers(geometry) {
  const snapshot = sources.get(geometry);
  if (!snapshot) return void 0;
  const matches = (current, original) => {
    if (current.length !== original.length) return false;
    for (let i = 0; i < current.length; i++) if (current[i] !== original[i]) return false;
    return true;
  };
  if (snapshot.attributes.some(({ name, size, normalized, attributeType, arrayType, values }) => {
    const attribute = geometry.getAttribute(name);
    return !attribute || attribute.itemSize !== size || attribute.normalized !== normalized || attribute.constructor !== attributeType || attribute.array.constructor !== arrayType || !matches(attribute.array, values);
  }) || !geometry.index || !matches(geometry.index.array, snapshot.indices))
    return void 0;
  const { source } = snapshot;
  return {
    positions: source.positions.flat(),
    indices: [...source.indices],
    ...source.normals ? { normals: source.normals.flat() } : {},
    ...source.uvs ? { uvs: source.uvs.flat() } : {}
  };
}

// ../model-forge/src/kernel/application/materials.ts
import * as THREE5 from "three";
function createMaterial(m, surfaces) {
  if (m.depthWrite === false && m.opacity >= 1)
    fail(
      "MATERIAL_DEPTH_WRITE",
      "Disabling depth writes requires opacity below 1 for portable alpha blending."
    );
  const common2 = {
    color: m.color,
    opacity: m.opacity,
    transparent: m.opacity < 1,
    depthWrite: m.depthWrite ?? true,
    side: m.doubleSided ? THREE5.DoubleSide : THREE5.FrontSide,
    // Only set when requested, so materials without the field build exactly as before.
    ...m.vertexColors ? { vertexColors: true } : {}
  };
  if (m.shading === "unlit" && m.surface)
    fail(
      "INVALID_MATERIAL",
      "Surface detail requires standard PBR shading; remove surface or use standard shading."
    );
  if (m.shading === "unlit") return new THREE5.MeshBasicMaterial(common2);
  const standard = {
    ...common2,
    metalness: m.metalness,
    roughness: m.roughness,
    emissive: m.emissive ?? "#000000",
    emissiveIntensity: m.emissiveIntensity ?? 1,
    flatShading: m.flatShading
  };
  const physical2 = Object.fromEntries(
    ["sheen", "sheenColor", "sheenRoughness", "clearcoat", "clearcoatRoughness"].filter((key) => m[key] !== void 0).map((key) => [key, m[key]])
  );
  const result = Object.keys(physical2).length ? new THREE5.MeshPhysicalMaterial({ ...standard, ...physical2 }) : new THREE5.MeshStandardMaterial(standard);
  try {
    if (m.surface) applySurface(result, m.surface, surfaces);
  } catch (error) {
    result.dispose();
    throw error;
  }
  return result;
}

// ../model-forge/src/kernel/application/organic.ts
import * as THREE6 from "three";
function section(profile, y) {
  if (!profile) return { width: 1, depth: 1, offset: [0, 0] };
  let index = 1;
  while (index < profile.length - 1 && profile[index].at < y) index++;
  const a = profile[index - 1], b = profile[index];
  const t = Math.max(0, Math.min(1, (y - a.at) / (b.at - a.at))), blend = t * t * (3 - 2 * t);
  const mix = (start, end) => start + (end - start) * blend;
  return {
    width: mix(a.width, b.width),
    depth: mix(a.depth, b.depth),
    offset: a.offset.map((value, axis) => mix(value, b.offset[axis]))
  };
}
function organicGeometry(g) {
  const around = g.segments;
  const baseRows = Math.max(8, Math.floor(around / 2));
  const positions = [], uvs = [], indices = [];
  const power = (v) => Math.sign(v) * Math.pow(Math.abs(v), g.roundness);
  const heights = Array.from(
    { length: baseRows + 1 },
    (_, row) => power(Math.cos(Math.PI * row / baseRows))
  );
  for (const station of g.profile ?? [])
    if (!heights.some((y) => Math.abs(y - station.at) < 1e-10)) heights.push(station.at);
  heights.sort((a, b) => b - a);
  const rows = heights.length - 1;
  for (let row = 0; row <= rows; row++) {
    const y = heights[row];
    const latitude = g.profile ? Math.acos(Math.sign(y) * Math.pow(Math.abs(y), 1 / g.roundness)) : Math.PI * row / rows;
    const shape = section(g.profile, y);
    const radius = Math.pow(Math.sin(latitude), g.roundness) * (1 - g.taper * y);
    for (let column = 0; column <= around; column++) {
      const longitude = Math.PI * 2 * column / around;
      positions.push(
        (radius * power(Math.cos(longitude)) * shape.width + g.bend * y * y + shape.offset[0]) * g.size[0] / 2,
        y * g.size[1] / 2,
        (radius * power(Math.sin(longitude)) * shape.depth + shape.offset[1]) * g.size[2] / 2
      );
      uvs.push(column / around, g.profile ? 1 - latitude / Math.PI : 1 - row / rows);
      if (row < rows && column < around) {
        const a = row * (around + 1) + column, b = a + around + 1;
        if (row > 0) indices.push(a, a + 1, b);
        if (row < rows - 1) indices.push(b, a + 1, b + 1);
      }
    }
  }
  const geometry = new THREE6.BufferGeometry();
  geometry.setAttribute("position", new THREE6.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE6.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const normals = geometry.getAttribute("normal");
  for (let row = 0; row <= rows; row++) {
    const first = row * (around + 1), last = first + around;
    const normal = new THREE6.Vector3().fromBufferAttribute(normals, first).add(new THREE6.Vector3().fromBufferAttribute(normals, last)).normalize();
    if (row === 0 || row === rows) {
      for (let col = 0; col <= around; col++) normals.setXYZ(first + col, 0, row === 0 ? 1 : -1, 0);
    } else {
      normals.setXYZ(first, normal.x, normal.y, normal.z);
      normals.setXYZ(last, normal.x, normal.y, normal.z);
    }
  }
  return geometry;
}

// ../model-forge/src/kernel/application/tube.ts
import * as THREE7 from "three";
function tubeGeometry(spec) {
  const curve = new THREE7.CatmullRomCurve3(
    spec.points.map((point2) => new THREE7.Vector3(...point2)),
    spec.closed,
    "centripetal"
  );
  const geometry = new THREE7.TubeGeometry(
    curve,
    spec.tubularSegments,
    spec.radius,
    spec.radialSegments,
    spec.closed
  );
  if (spec.closed || !spec.capEnds) return geometry;
  const position = geometry.getAttribute("position");
  const positions = Array.from(position.array), normals = Array.from(geometry.getAttribute("normal").array), uvs = Array.from(geometry.getAttribute("uv").array), indices = Array.from(geometry.index.array);
  for (const end of [0, 1]) {
    const center = curve.getPointAt(end), normal = curve.getTangentAt(end).multiplyScalar(end ? 1 : -1), base = positions.length / 3;
    positions.push(...center.toArray());
    normals.push(...normal.toArray());
    uvs.push(0.5, 0.5);
    for (let j = 0; j < spec.radialSegments; j++) {
      const index = end * spec.tubularSegments * (spec.radialSegments + 1) + j;
      positions.push(position.getX(index), position.getY(index), position.getZ(index));
      normals.push(...normal.toArray());
      const angle = j / spec.radialSegments * Math.PI * 2;
      uvs.push(0.5 + Math.cos(angle) / 2, 0.5 + Math.sin(angle) / 2);
    }
    for (let j = 0; j < spec.radialSegments; j++) {
      const a = base + 1 + j, b = base + 1 + (j + 1) % spec.radialSegments;
      const va = new THREE7.Vector3().fromArray(positions, a * 3).sub(center), vb = new THREE7.Vector3().fromArray(positions, b * 3).sub(center);
      indices.push(...va.cross(vb).dot(normal) > 0 ? [base, a, b] : [base, b, a]);
    }
  }
  geometry.setAttribute("position", new THREE7.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE7.Float32BufferAttribute(normals, 3));
  geometry.setAttribute("uv", new THREE7.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  return geometry;
}

// ../model-forge/src/kernel/application/heightfield.ts
import * as THREE8 from "three";
function lattice(x, z13, octave, seed) {
  let h = Math.imul(x | 0, 668265261) ^ Math.imul(z13 | 0, 374761393);
  h = Math.imul(h ^ seed, 2246822507) ^ Math.imul(octave + 1, 3266489909);
  h ^= h >>> 15;
  h = Math.imul(h, 739982445);
  h ^= h >>> 12;
  h = Math.imul(h, 695872825);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}
var fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
var clamp01 = (v) => v < 0 ? 0 : v > 1 ? 1 : v;
var smooth = (t) => t * t * (3 - 2 * t);
function valueNoise(x, z13, octave, seed) {
  const x0 = Math.floor(x), z0 = Math.floor(z13), tx = fade(x - x0), tz = fade(z13 - z0);
  const a = lattice(x0, z0, octave, seed), b = lattice(x0 + 1, z0, octave, seed), c = lattice(x0, z0 + 1, octave, seed), d = lattice(x0 + 1, z0 + 1, octave, seed);
  const top = a + (b - a) * tx, bottom = c + (d - c) * tx;
  return top + (bottom - top) * tz;
}
function height(spec, u, v) {
  const { kind, octaves, frequency, lacunarity, gain } = spec.noise;
  let sum = 0, weight = 0, amplitude = 1, f = frequency;
  for (let octave = 0; octave < octaves; octave++) {
    const n = valueNoise(u * f, v * f, octave, spec.seed);
    const signed = 2 * n - 1, folded = signed < 0 ? -signed : signed;
    const shaped = kind === "ridged" ? (1 - folded) * (1 - folded) : kind === "billow" ? folded : n;
    sum += shaped * amplitude;
    weight += amplitude;
    amplitude *= gain;
    f *= lacunarity;
  }
  let h = weight > 0 ? sum / weight : 0;
  const dx = 2 * u - 1, dz = 2 * v - 1, d2 = clamp01(dx * dx + dz * dz);
  if (spec.falloff === "island") h *= smooth(clamp01((1 - d2) * 1.25));
  else if (spec.falloff === "basin") h = h * 0.5 + 0.5 * smooth(d2);
  if (spec.terrace > 0) {
    const t = h * spec.terrace, step = Math.floor(t), frac = t - step;
    h = (step + frac * frac * frac * frac) / spec.terrace;
  }
  return clamp01(h);
}
function heightGrid(spec) {
  const [nx, nz] = spec.resolution;
  const grid = new Float64Array(nx * nz);
  for (let iz = 0; iz < nz; iz++)
    for (let ix = 0; ix < nx; ix++)
      grid[iz * nx + ix] = height(spec, ix / (nx - 1), iz / (nz - 1)) * spec.amplitude;
  return grid;
}
function heightfieldSampler(spec) {
  const grid = heightGrid(spec);
  const [nx, nz] = spec.resolution, [sx, sz] = spec.size;
  const cellX = sx / (nx - 1), cellZ = sz / (nz - 1);
  return (x, z13) => {
    const gx = (x + sx / 2) / cellX, gz = (z13 + sz / 2) / cellZ;
    const inside2 = gx >= -1e-9 && gz >= -1e-9 && gx <= nx - 1 + 1e-9 && gz <= nz - 1 + 1e-9;
    const cx = Math.min(nx - 1, Math.max(0, gx)), cz = Math.min(nz - 1, Math.max(0, gz));
    const ix = Math.min(nx - 2, Math.floor(cx)), iz = Math.min(nz - 2, Math.floor(cz));
    const fx = cx - ix, fz = cz - iz;
    const a = grid[iz * nx + ix], b = grid[iz * nx + ix + 1], c = grid[(iz + 1) * nx + ix], d = grid[(iz + 1) * nx + ix + 1];
    let y, slopeX, slopeZ;
    if (fx + fz <= 1) {
      y = a + fx * (b - a) + fz * (c - a);
      slopeX = (b - a) / cellX;
      slopeZ = (c - a) / cellZ;
    } else {
      y = d + (1 - fx) * (c - d) + (1 - fz) * (b - d);
      slopeX = (d - c) / cellX;
      slopeZ = (d - b) / cellZ;
    }
    const length = Math.sqrt(slopeX * slopeX + 1 + slopeZ * slopeZ);
    return { y, normal: [-slopeX / length, 1 / length, -slopeZ / length], inside: inside2 };
  };
}
function sampleHeightfield(spec, x, z13) {
  return heightfieldSampler(spec)(x, z13);
}
function heightfieldGeometry(spec) {
  const grid = heightGrid(spec);
  const [nx, nz] = spec.resolution, [sx, sz] = spec.size;
  const positions = new Float32Array(nx * nz * 3), uvs = new Float32Array(nx * nz * 2);
  for (let iz = 0; iz < nz; iz++)
    for (let ix = 0; ix < nx; ix++) {
      const i = iz * nx + ix;
      positions[i * 3] = -sx / 2 + sx * ix / (nx - 1);
      positions[i * 3 + 1] = grid[i];
      positions[i * 3 + 2] = -sz / 2 + sz * iz / (nz - 1);
      uvs[i * 2] = ix / (nx - 1);
      uvs[i * 2 + 1] = 1 - iz / (nz - 1);
    }
  const indices = [];
  for (let iz = 0; iz < nz - 1; iz++)
    for (let ix = 0; ix < nx - 1; ix++) {
      const a = iz * nx + ix, b = a + 1, c = a + nx, d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  const geometry = new THREE8.BufferGeometry();
  geometry.setAttribute("position", new THREE8.BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE8.BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  if (spec.bands) {
    const bands = spec.bands.map((band) => ({
      below: band.below,
      color: new THREE8.Color(band.color)
    }));
    const colors = new Float32Array(nx * nz * 3);
    for (let i = 0; i < nx * nz; i++) {
      const normalized = spec.amplitude > 0 ? grid[i] / spec.amplitude : 0;
      const band = bands.find((entry) => normalized <= entry.below) ?? bands[bands.length - 1];
      colors[i * 3] = band.color.r;
      colors[i * 3 + 1] = band.color.g;
      colors[i * 3 + 2] = band.color.b;
    }
    geometry.setAttribute("color", new THREE8.BufferAttribute(colors, 3));
  }
  return geometry;
}

// ../model-forge/src/kernel/application/resources.ts
import * as THREE9 from "three";
import { Brush, Evaluator, ADDITION, SUBTRACTION, INTERSECTION } from "three-bvh-csg/src/index.js";
function createResourcePool(warnings) {
  const surfaces = createSurfacePool();
  const geometries = /* @__PURE__ */ new Set();
  const materials = /* @__PURE__ */ new Set();
  const geometryPool = /* @__PURE__ */ new Map();
  const materialPool = /* @__PURE__ */ new Map();
  function scopeResources(scope, path13, overrides = {}) {
    const geometryCache = /* @__PURE__ */ new Map();
    const materialCache = /* @__PURE__ */ new Map();
    function material2(id) {
      if (Object.hasOwn(overrides, id)) return overrides[id];
      if (materialCache.has(id)) return materialCache.get(id);
      const m = scope.materials[id];
      const key = canonical({
        ...m,
        emissive: m.emissive ?? "#000000",
        emissiveIntensity: m.emissiveIntensity ?? 1
      });
      if (materialPool.has(key)) {
        materialCache.set(id, materialPool.get(key));
        return materialPool.get(key);
      }
      const result = createMaterial(m, surfaces);
      result.name = `${path13}/${id}`;
      Object.defineProperty(result, "uuid", { value: uuid(`material/${key}`), writable: true });
      materialPool.set(key, result);
      materialCache.set(id, result);
      materials.add(result);
      return result;
    }
    function geometry(id) {
      if (geometryCache.has(id)) return geometryCache.get(id);
      const g = scope.geometries[id];
      const key = canonical(
        g.type === "boolean" ? { ...g, left: geometry(g.left).uuid, right: geometry(g.right).uuid } : g
      );
      if (geometryPool.has(key)) {
        geometryCache.set(id, geometryPool.get(key));
        return geometryPool.get(key);
      }
      let result;
      switch (g.type) {
        case "box":
          result = new THREE9.BoxGeometry(...g.size);
          break;
        case "organic":
          result = organicGeometry(g);
          break;
        case "sphere":
          result = new THREE9.SphereGeometry(
            g.radius,
            g.segments ?? 32,
            Math.max(8, (g.segments ?? 32) / 2)
          );
          break;
        case "cylinder":
          result = new THREE9.CylinderGeometry(
            g.radiusTop,
            g.radiusBottom,
            g.height,
            g.segments ?? 32,
            1,
            g.openEnded ?? false
          );
          break;
        case "cone":
          result = new THREE9.ConeGeometry(g.radius, g.height, g.segments ?? 32);
          break;
        case "torus":
          result = new THREE9.TorusGeometry(g.radius, g.tube, 12, g.segments ?? 48);
          break;
        case "capsule":
          result = new THREE9.CapsuleGeometry(g.radius, g.length, 8, g.segments ?? 24);
          break;
        case "tube":
          result = tubeGeometry(g);
          break;
        case "heightfield":
          result = heightfieldGeometry(g);
          break;
        case "plane":
          result = new THREE9.PlaneGeometry(...g.size);
          break;
        case "lathe":
          result = new THREE9.LatheGeometry(
            g.points.map((p) => new THREE9.Vector2(p[0], p[1])),
            g.segments ?? 32
          );
          break;
        case "extrude": {
          const shape = new THREE9.Shape(
            g.points.map((p) => new THREE9.Vector2(p[0], p[1]))
          );
          shape.holes = (g.holes ?? []).map(
            (points) => new THREE9.Path(points.map((p) => new THREE9.Vector2(p[0], p[1])))
          );
          result = new THREE9.ExtrudeGeometry(shape, {
            depth: g.depth,
            steps: 1,
            bevelEnabled: (g.bevel ?? 0) > 0,
            bevelSize: g.bevel ?? 0,
            bevelThickness: g.bevel ?? 0,
            bevelSegments: g.bevelSegments ?? 3
          });
          break;
        }
        case "mesh": {
          result = new THREE9.BufferGeometry();
          result.setAttribute("position", new THREE9.Float32BufferAttribute(g.positions.flat(), 3));
          result.setIndex(g.indices);
          if (g.normals)
            result.setAttribute("normal", new THREE9.Float32BufferAttribute(g.normals.flat(), 3));
          else result.computeVertexNormals();
          if (g.uvs) result.setAttribute("uv", new THREE9.Float32BufferAttribute(g.uvs.flat(), 2));
          else
            warnings.add(
              "Custom mesh uses local spherical UV fallback; author seam-aware uvs for precise surface placement."
            );
          break;
        }
        case "boolean": {
          const leftGeometry = geometry(g.left), rightGeometry = geometry(g.right);
          if (triangles(leftGeometry) + triangles(rightGeometry) > 1e5)
            fail("CSG_BUDGET", `Boolean ${id} exceeds the 100,000 input triangle limit.`);
          const left = new Brush(leftGeometry), right = new Brush(rightGeometry);
          try {
            transform(left, g.leftTransform);
            transform(right, g.rightTransform);
            const evaluator = new Evaluator();
            evaluator.useGroups = false;
            evaluator.attributes = ["position", "normal"];
            const target = new Brush();
            const targetMaterial = target.material;
            geometries.add(target.geometry);
            try {
              const brush = evaluator.evaluate(
                left,
                right,
                { union: ADDITION, subtract: SUBTRACTION, intersect: INTERSECTION }[g.operation],
                target
              );
              result = brush.geometry;
              geometries.add(result);
              result.applyMatrix4(brush.matrix);
              result.computeVertexNormals();
            } finally {
              targetMaterial.dispose();
            }
          } finally {
            left.material.dispose();
            right.material.dispose();
          }
          warnings.add(
            "Boolean operations require closed, manifold inputs; coplanar or degenerate intersections can produce artifacts. Inspect the result before use."
          );
          break;
        }
        default:
          return fail("UNKNOWN_GEOMETRY", `Unsupported geometry type.`);
      }
      if (!result.getAttribute("uv")) {
        const positions = Array.from(result.getAttribute("position").array);
        result.setAttribute("uv", new THREE9.Float32BufferAttribute(sphereUVs(positions), 2));
      }
      geometries.add(result);
      result.name = `${path13}/${id}`;
      result.uuid = uuid(`geometry/${key}`);
      if ((g.type === "lathe" || g.type === "capsule") && result.index) {
        const positions = result.getAttribute("position");
        const kept = [];
        const a = new THREE9.Vector3(), b = new THREE9.Vector3(), c = new THREE9.Vector3();
        for (let i = 0; i < result.index.count; i += 3) {
          const ids = [0, 1, 2].map((j) => result.index.getX(i + j));
          a.fromBufferAttribute(positions, ids[0]);
          b.fromBufferAttribute(positions, ids[1]);
          c.fromBufferAttribute(positions, ids[2]);
          const edge = Math.max(
            a.distanceToSquared(b),
            a.distanceToSquared(c),
            b.distanceToSquared(c)
          );
          if (b.sub(a).cross(c.sub(a)).lengthSq() > edge * edge * 1e-24) kept.push(...ids);
        }
        if (!kept.length)
          fail("EMPTY_GEOMETRY", `Geometry ${id} generated no nondegenerate faces.`);
        result.setIndex(kept);
      }
      result.clearGroups();
      const normals = result.getAttribute("normal");
      if (normals) {
        const normal = new THREE9.Vector3();
        for (let i = 0; i < normals.count; i++) {
          normal.fromBufferAttribute(normals, i);
          if (normal.lengthSq() < 1e-12) normal.set(0, 1, 0);
          else normal.normalize();
          normals.setXYZ(i, normal.x, normal.y, normal.z);
        }
      }
      const position = result.getAttribute("position");
      if (!position || !position.count)
        fail("EMPTY_GEOMETRY", `Geometry ${id} generated no vertices.`);
      for (let i = 0; i < position.array.length; i++)
        if (!Number.isFinite(position.array[i]))
          fail("INVALID_GEOMETRY", `Geometry ${id} generated non-finite coordinates.`);
      const baked = new THREE9.BufferGeometry().copy(result);
      baked.uuid = result.uuid;
      geometries.delete(result);
      result.dispose();
      result = baked;
      if (g.type === "mesh") rememberMeshSource(result, g);
      geometries.add(result);
      geometryCache.set(id, result);
      geometryPool.set(key, result);
      return result;
    }
    return { geometry, material: material2 };
  }
  return {
    scopeResources,
    get geometryCount() {
      return geometryPool.size;
    },
    get materialCount() {
      return materials.size;
    },
    dispose() {
      surfaces.dispose();
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material2) => material2.dispose());
      geometries.clear();
      materials.clear();
      geometryPool.clear();
      materialPool.clear();
    }
  };
}

// ../model-forge/src/kernel/application/compiler.ts
function compileScene(document2, models = {}, options = {}) {
  validateDocument(document2, models);
  const scene = new THREE10.Scene();
  scene.name = document2.name;
  scene.uuid = uuid(document2.id);
  const content2 = new THREE10.Group();
  content2.name = document2.id;
  content2.uuid = uuid(`${document2.id}/content`);
  scene.add(content2);
  let meshCount = 0, triangleCount = 0, objectCount = 0, lightCount = 0, shadowCount = 0;
  const warnings = /* @__PURE__ */ new Set();
  const resources = createResourcePool(warnings);
  const rigs = [];
  const pendingRigs = [];
  const dispose = () => {
    rigs.forEach((rig) => rig.dispose());
    resources.dispose();
  };
  function buildScope(source, target, path13, parameters, overrides = {}, inheritedSlots = {}) {
    const scope = resolveData(source, parameters);
    const slots = (id) => [`${path13}/${id}`, ...inheritedSlots[id] ?? []];
    const { geometry, material: material2 } = resources.scopeResources(scope, path13, overrides);
    const objects = /* @__PURE__ */ new Map();
    const make = (node, nodePath) => {
      if (++objectCount > 2e4) fail("SCENE_BUDGET", "Expanded scene exceeds 20,000 objects.");
      let object;
      if (node.type === "mesh") {
        const g = geometry(node.geometry);
        triangleCount += triangles(g);
        meshCount++;
        if (triangleCount > 2e6)
          fail("SCENE_BUDGET", "Expanded scene exceeds 2,000,000 triangles.");
        const surface = material2(node.material);
        if (surface instanceof THREE10.MeshStandardMaterial && surface.normalMap)
          ensureSurfaceTangents(g);
        object = new THREE10.Mesh(g, surface);
        object.castShadow = true;
        object.receiveShadow = true;
      } else if (node.type === "light") {
        if (++lightCount > 32 || node.castShadow && ++shadowCount > 4)
          fail(
            "LIGHT_BUDGET",
            "Scenes support at most 32 authored lights and 4 shadow-casting lights."
          );
        object = createLight(node);
      } else {
        object = new THREE10.Group();
        if (node.type === "model") {
          const model = models[node.model];
          const replace = Object.fromEntries(
            Object.entries(node.materialOverrides).map(([from, to]) => [from, material2(to)])
          );
          buildScope(
            model,
            object,
            nodePath,
            modelParameters(model, node.parameters),
            replace,
            Object.fromEntries(
              Object.entries(node.materialOverrides).map(([from, to]) => [from, slots(to)])
            )
          );
        }
      }
      object.name = nodePath;
      object.uuid = uuid(nodePath);
      object.visible = node.visible;
      object.userData = {
        forgeId: node.id,
        forgePath: nodePath,
        label: node.name ?? node.id,
        tags: node.tags,
        type: node.type,
        ...node.type === "mesh" ? {
          geometry: node.geometry,
          geometryType: scope.geometries[node.geometry].type,
          material: node.material,
          materialSlots: slots(node.material)
        } : {}
      };
      if (node.type === "model" && node.rig) {
        object.userData.rig = node.rig;
        if (pendingRigs.length >= 32)
          fail("RIG_BUDGET", "A scene supports at most 32 rig instances.");
        pendingRigs.push({ object, rig: node.rig });
      }
      transform(object, node.transform);
      return object;
    };
    for (const node of scope.nodes) {
      const nodePath = `${path13}/${node.id}`;
      let object;
      if (node.pattern) {
        if (++objectCount > 2e4) fail("SCENE_BUDGET", "Expanded scene exceeds 20,000 objects.");
        object = new THREE10.Group();
        object.name = nodePath;
        object.uuid = uuid(nodePath);
        object.visible = node.visible;
        object.userData = {
          forgeId: node.id,
          forgePath: nodePath,
          label: node.name ?? node.id,
          type: "pattern",
          tags: node.tags
        };
        transform(object, node.transform);
        const counts = node.pattern.type === "grid" ? node.pattern.counts : [
          node.pattern.type === "path" ? node.pattern.points.length : node.pattern.count,
          1,
          1
        ];
        const count = counts.reduce((a, b) => a * b, 1);
        for (let i = 0; i < count; i++) {
          const copy = make(
            { ...node, transform: void 0, pattern: void 0 },
            `${nodePath}/${i}`
          );
          if (node.pattern.type === "linear")
            copy.position.fromArray(node.pattern.step).multiplyScalar(i);
          else if (node.pattern.type === "grid") {
            const pattern = node.pattern;
            const indices = [
              i % counts[0],
              Math.floor(i / counts[0]) % counts[1],
              Math.floor(i / (counts[0] * counts[1]))
            ];
            copy.position.fromArray(
              indices.map(
                (v, axis) => (v - (pattern.centered ? (counts[axis] - 1) / 2 : 0)) * pattern.step[axis]
              )
            );
          } else if (node.pattern.type === "path") {
            const points = node.pattern.points;
            copy.position.fromArray(points[i]);
            if (node.pattern.orient === "yaw" && points.length > 1) {
              const a = points[i === points.length - 1 ? i - 1 : i];
              const b = points[i === points.length - 1 ? i : i + 1];
              copy.rotation.y = Math.atan2(b[0] - a[0], b[2] - a[2]);
            }
          } else {
            const angle = radians(
              node.pattern.startAngle + i * node.pattern.sweep / count
            );
            copy.position.set(
              Math.cos(angle) * node.pattern.radius,
              0,
              Math.sin(angle) * node.pattern.radius
            );
            if (node.pattern.orient) copy.rotation.y = -angle;
          }
          object.add(copy);
        }
      } else object = make(node, nodePath);
      objects.set(node.id, object);
    }
    for (const node of scope.nodes)
      (node.parent ? objects.get(node.parent) : target).add(objects.get(node.id));
  }
  try {
    buildScope(document2, content2, document2.id, document2.parameters);
    scene.updateMatrixWorld(true);
    if (options.bindRigs !== false)
      for (const { object, rig } of pendingRigs) rigs.push(bindRig(object, rig));
    content2.traverse((object) => {
      if (!object.matrixWorld.elements.every(Number.isFinite))
        fail(
          "TRANSFORM_RANGE",
          `World transform overflow at ${object.name}. Reduce nested scales or coordinates.`
        );
    });
    const bounds = new THREE10.Box3().setFromObject(content2);
    if (!bounds.isEmpty() && ![...bounds.min.toArray(), ...bounds.max.toArray()].every(Number.isFinite))
      fail("TRANSFORM_RANGE", "World bounds overflowed. Reduce nested scales or coordinates.");
    const empty = bounds.isEmpty();
    const stats = {
      nodes: objectCount,
      meshes: meshCount,
      triangles: triangleCount,
      materials: resources.materialCount,
      geometries: resources.geometryCount,
      bounds: {
        min: empty ? [0, 0, 0] : bounds.min.toArray(),
        max: empty ? [0, 0, 0] : bounds.max.toArray(),
        size: empty ? [0, 0, 0] : bounds.getSize(new THREE10.Vector3()).toArray()
      },
      warnings: [...warnings]
    };
    if (meshCount === 0)
      stats.warnings.push("Scene has no meshes. Add mesh or model nodes before exporting.");
    return { scene, content: content2, stats, dispose };
  } catch (error) {
    dispose();
    throw error;
  }
}

// ../model-forge/src/kernel/application/camera.ts
import { Box3 as Box32, Vector3 as Vector37, PerspectiveCamera, OrthographicCamera, MathUtils as MathUtils4 } from "three";
function fitCamera(box, aspect, request, authored) {
  if (request.fixed) {
    const c = request.fixed;
    const camera2 = c.projection === "perspective" ? new PerspectiveCamera(c.fov, c.aspect, c.near, c.far) : new OrthographicCamera(c.left, c.right, c.top, c.bottom, c.near, c.far);
    camera2.position.fromArray(c.position);
    camera2.up.fromArray(c.up);
    camera2.zoom = c.zoom;
    const target2 = new Vector37().fromArray(c.target);
    camera2.lookAt(target2);
    camera2.updateProjectionMatrix();
    camera2.updateMatrixWorld(true);
    return { camera: camera2, target: target2 };
  }
  if (box.isEmpty()) box = new Box32(new Vector37(-0.5, -0.5, -0.5), new Vector37(0.5, 0.5, 0.5));
  const center = box.getCenter(new Vector37()), size = box.getSize(new Vector37());
  const span = Math.max(size.length(), 0.1), near = Math.max(span / 1e3, 1e-5), far = span * 1e3;
  const directions = {
    iso: [1.25, 0.9, 1.65],
    front: [0, 0, 1],
    back: [0, 0, -1],
    right: [1, 0, 0],
    side: [1, 0, 0],
    left: [-1, 0, 0],
    top: [0, 1, 0],
    bottom: [0, -1, 0]
  };
  const a = MathUtils4.degToRad(request.azimuth), e = MathUtils4.degToRad(request.elevation);
  const direction = request.view === "orbit" ? new Vector37(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e)) : new Vector37(
    ...directions[request.view] ?? directions.iso
  ).normalize();
  const worldUp = Math.abs(direction.y) > 0.999 ? new Vector37(0, 0, direction.y > 0 ? -1 : 1) : new Vector37(0, 1, 0);
  const right = new Vector37().crossVectors(worldUp, direction).normalize(), up = new Vector37().crossVectors(direction, right);
  const corners = [];
  for (const x of [-0.5, 0.5])
    for (const y of [-0.5, 0.5])
      for (const z13 of [-0.5, 0.5]) corners.push(new Vector37(size.x * x, size.y * y, size.z * z13));
  const orthographic = request.projection === "orthographic" || request.projection === "auto" && !["iso", "orbit", "authored"].includes(request.view);
  let camera;
  const target = center.clone();
  if (request.view === "authored" && authored) {
    camera = new PerspectiveCamera(authored.fov, aspect, near, far);
    camera.position.fromArray(authored.position);
    target.fromArray(authored.target);
    camera.far = Math.max(far, camera.position.distanceTo(target) + span * 2);
  } else if (orthographic) {
    const half = Math.max(
      0.05,
      ...corners.map((c) => Math.max(Math.abs(c.dot(up)), Math.abs(c.dot(right)) / aspect))
    ) * request.padding;
    camera = new OrthographicCamera(-half * aspect, half * aspect, half, -half, near, far);
    camera.position.copy(center).addScaledVector(direction, span * 3);
  } else {
    camera = new PerspectiveCamera(request.fov, aspect, near, far);
    const tanV = Math.tan(MathUtils4.degToRad(request.fov / 2)), tanH = tanV * aspect;
    const distance = Math.max(
      0.1,
      ...corners.map(
        (c) => c.dot(direction) + request.padding * Math.max(Math.abs(c.dot(right)) / tanH, Math.abs(c.dot(up)) / tanV)
      )
    );
    camera.position.copy(center).addScaledVector(direction, distance + near * 2);
  }
  camera.up.copy(worldUp);
  camera.lookAt(target);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  return { camera, target };
}
function cameraData(camera, target) {
  return {
    projection: camera instanceof PerspectiveCamera ? "perspective" : "orthographic",
    position: camera.position.toArray(),
    target: target.toArray(),
    up: camera.up.toArray(),
    near: camera.near,
    far: camera.far,
    zoom: camera.zoom,
    ...camera instanceof PerspectiveCamera ? { fov: camera.fov, aspect: camera.aspect } : { left: camera.left, right: camera.right, top: camera.top, bottom: camera.bottom }
  };
}

// ../model-forge/src/kernel/application/gltf-scene.ts
import * as THREE11 from "three";
import { clone } from "three/addons/utils/SkeletonUtils.js";
function gltfScene(root) {
  const copy = clone(root);
  const original = [], cloned = [];
  root.traverse((object) => original.push(object));
  copy.traverse((object) => cloned.push(object));
  cloned.forEach((object, i) => {
    object.uuid = original[i].uuid;
  });
  const scene = copy instanceof THREE11.Scene ? copy : new THREE11.Scene();
  if (scene !== copy) {
    scene.name = root.name;
    scene.add(copy);
  }
  const skins = [];
  scene.traverse((object) => {
    if (object instanceof THREE11.SkinnedMesh) skins.push(object);
    if (object instanceof THREE11.SpotLight || object instanceof THREE11.DirectionalLight)
      orientLight(object);
  });
  for (const skin of skins) {
    for (let parent = skin.parent; parent; parent = parent.parent) skin.visible &&= parent.visible;
    scene.add(skin);
    skin.position.set(0, 0, 0);
    skin.quaternion.identity();
    skin.scale.set(1, 1, 1);
  }
  scene.updateMatrixWorld(true);
  return scene;
}

// ../model-forge/src/kernel/application/inspection.ts
import { Box3 as Box33, Vector3 as Vector38, Mesh as Mesh3 } from "three";
function selectNodes(scene, selector2) {
  if (selector2.ids) {
    const missing = selector2.ids.filter((id) => !scene.nodes.some((n) => n.id === id));
    if (missing.length) fail("NOT_FOUND", "Selected node IDs do not exist.", { missing });
  }
  return scene.nodes.filter(
    (n) => (!selector2.ids || selector2.ids.includes(n.id)) && (selector2.tag === void 0 || n.tags.includes(selector2.tag)) && (!selector2.type || n.type === selector2.type) && (!selector2.model || n.type === "model" && n.model === selector2.model) && (selector2.parent === void 0 || (n.parent ?? null) === selector2.parent)
  );
}
function inspectNodes(scene, models, selector2 = {}, detailed = false) {
  const nodes2 = selectNodes(scene, selector2);
  if (!detailed)
    return nodes2.map((n) => ({
      id: n.id,
      name: n.name,
      type: n.type,
      parent: n.parent ?? null,
      visible: n.visible,
      tags: n.tags,
      ...n.type === "model" ? { model: n.model } : {},
      transform: n.transform
    }));
  const built = compileScene(scene, models);
  try {
    return nodes2.map((node) => {
      const object = built.content.getObjectByName(`${scene.id}/${node.id}`);
      const box = new Box33().setFromObject(object);
      let meshes = 0, triangles2 = 0;
      object.traverse((child) => {
        if (child instanceof Mesh3) {
          meshes++;
          triangles2 += (child.geometry.index?.count ?? child.geometry.getAttribute("position").count) / 3;
        }
      });
      return {
        node,
        worldPosition: object.getWorldPosition(new Vector38()).toArray(),
        worldMatrix: object.matrixWorld.toArray(),
        bounds: box.isEmpty() ? null : {
          min: box.min.toArray(),
          max: box.max.toArray(),
          size: box.getSize(new Vector38()).toArray()
        },
        meshes,
        triangles: triangles2
      };
    });
  } finally {
    built.dispose();
  }
}
function sceneChanges(before, after) {
  const diff = (a, b) => ({
    added: Object.keys(b).filter((k) => !Object.hasOwn(a, k)),
    updated: Object.keys(b).filter(
      (k) => Object.hasOwn(a, k) && JSON.stringify(a[k]) !== JSON.stringify(b[k])
    ),
    removed: Object.keys(a).filter((k) => !Object.hasOwn(b, k))
  });
  return {
    nodes: diff(
      Object.fromEntries(before.nodes.map((n) => [n.id, n])),
      Object.fromEntries(after.nodes.map((n) => [n.id, n]))
    ),
    geometries: diff(before.geometries, after.geometries),
    materials: diff(before.materials, after.materials),
    parameters: diff(before.parameters, after.parameters),
    settings: ["camera", "environment", "name"].filter(
      (k) => JSON.stringify(before[k]) !== JSON.stringify(after[k])
    )
  };
}

// ../model-forge/src/kernel/application/composition.ts
import { Box3 as Box34, Euler as Euler2, Matrix4, Quaternion as Quaternion2, Vector3 as Vector39 } from "three";
function nodeById(scene, id) {
  const node = scene.nodes.find((n) => n.id === id);
  if (!node) fail("NOT_FOUND", `Node ${id} does not exist.`);
  return node;
}
function subtreeIds(scene, id) {
  nodeById(scene, id);
  const result = /* @__PURE__ */ new Set([id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const n of scene.nodes)
      if (n.parent && result.has(n.parent) && !result.has(n.id)) {
        result.add(n.id);
        changed = true;
      }
  }
  return result;
}
function matrixTransform(matrix) {
  const position = new Vector39(), scale = new Vector39(), rotation2 = new Quaternion2();
  matrix.decompose(position, rotation2, scale);
  const rebuilt = new Matrix4().compose(position, rotation2, scale);
  if (matrix.elements.some(
    (v, i) => !Number.isFinite(v) || Math.abs(v - rebuilt.elements[i]) > 1e-7 * Math.max(1, Math.abs(v))
  ))
    fail(
      "SHEAR_UNSUPPORTED",
      "This transform contains shear. Use uniform parent scale or reparent with --local."
    );
  const euler = new Euler2().setFromQuaternion(rotation2, "XYZ");
  return {
    position: position.toArray(),
    rotation: [euler.x, euler.y, euler.z].map((v) => v * 180 / Math.PI),
    scale: scale.toArray()
  };
}
function moveWorld(scene, id, delta, models) {
  const built = compileScene(scene, models);
  try {
    const object = built.content.getObjectByName(`${scene.id}/${id}`);
    const position = object.getWorldPosition(new Vector39()).add(delta);
    if (object.parent) object.parent.worldToLocal(position);
    const node = nodeById(scene, id);
    node.transform = { ...node.transform, position: position.toArray() };
  } finally {
    built.dispose();
  }
}
function applySpatialOperation(scene, op, models) {
  if (op.op === "patchNode") {
    const node = nodeById(scene, op.id);
    const patch = structuredClone(op.patch);
    if ((patch.parameters || patch.materialOverrides || patch.rig) && node.type !== "model")
      fail("INVALID_NODE_TYPE", "Parameter and material overrides apply only to model instances.");
    const transform2 = patch.transform ? { ...node.transform, ...patch.transform } : node.transform;
    if (node.type === "model") {
      if (patch.parameters) patch.parameters = { ...node.parameters, ...patch.parameters };
      if (patch.materialOverrides)
        patch.materialOverrides = { ...node.materialOverrides, ...patch.materialOverrides };
    }
    if (patch.rig === null) {
      if (node.type === "model") delete node.rig;
      delete patch.rig;
    }
    if (patch.pattern === null) {
      delete node.pattern;
      delete patch.pattern;
    }
    Object.assign(node, patch);
    node.transform = transform2;
    return;
  }
  if (op.op === "duplicateNode") {
    const ids = subtreeIds(scene, op.id);
    const mapping = new Map(
      [...ids].map((id) => [id, id === op.id ? op.newId : `${op.newId}--${id}`])
    );
    for (const id of mapping.values()) {
      parse(Id, id);
      if (scene.nodes.some((n) => n.id === id))
        fail("ALREADY_EXISTS", `Duplicate would overwrite node ${id}.`);
    }
    const copies = scene.nodes.filter((n) => ids.has(n.id)).map((n) => {
      const copy = structuredClone(n);
      copy.id = mapping.get(n.id);
      if (copy.parent && mapping.has(copy.parent)) copy.parent = mapping.get(copy.parent);
      return copy;
    });
    const root = copies.find((n) => n.id === op.newId);
    const position = resolveData(
      root.transform?.position ?? [0, 0, 0],
      scene.parameters
    );
    const offset = resolveData(op.offset, scene.parameters);
    root.transform = {
      ...root.transform,
      position: position.map((v, i) => v + offset[i])
    };
    scene.nodes.push(...copies);
    return;
  }
  if (op.op === "reparentNode") {
    const node = nodeById(scene, op.id);
    if (op.parent) {
      nodeById(scene, op.parent);
      if (subtreeIds(scene, op.id).has(op.parent))
        fail("CYCLE", "Cannot parent a node to itself or a descendant.");
    }
    if (op.keepWorld) {
      const built = compileScene(scene, models);
      try {
        const matrix = built.content.getObjectByName(`${scene.id}/${op.id}`).matrixWorld.clone();
        const parent = op.parent ? built.content.getObjectByName(`${scene.id}/${op.parent}`) : built.content;
        matrix.premultiply(parent.matrixWorld.clone().invert());
        node.transform = matrixTransform(matrix);
      } finally {
        built.dispose();
      }
    }
    if (op.parent) node.parent = op.parent;
    else delete node.parent;
    return;
  }
  if (op.op === "groupNodes") {
    if (scene.nodes.some((n) => n.id === op.id))
      fail("ALREADY_EXISTS", `Node ${op.id} already exists.`);
    const selected = [...new Set(op.nodes)].map((id) => nodeById(scene, id));
    const parent = selected[0].parent;
    if (selected.some((n) => n.parent !== parent))
      fail("DIFFERENT_PARENTS", "Group nodes must share the same parent. Reparent them first.");
    scene.nodes.push({ id: op.id, type: "group", name: op.name, parent, visible: true, tags: [] });
    selected.forEach((n) => n.parent = op.id);
    return;
  }
  if (op.op === "groundNode" || op.op === "placeNode") {
    nodeById(scene, op.id);
    if (op.op === "placeNode") {
      nodeById(scene, op.target);
      if (subtreeIds(scene, op.id).has(op.target) || subtreeIds(scene, op.target).has(op.id))
        fail(
          "DEPENDENT_NODES",
          "Placement target must be outside the moving subtree and its ancestors."
        );
    }
    const built = compileScene(scene, models);
    let delta = new Vector39();
    try {
      const box = new Box34().setFromObject(built.content.getObjectByName(`${scene.id}/${op.id}`));
      if (box.isEmpty()) fail("EMPTY_GEOMETRY", "Cannot position an empty group by bounds.");
      if (op.op === "groundNode") delta.y = op.y - box.min.y;
      else {
        const target = new Box34().setFromObject(
          built.content.getObjectByName(`${scene.id}/${op.target}`)
        );
        if (target.isEmpty()) fail("EMPTY_GEOMETRY", "Placement target has no geometry.");
        if (op.center)
          delta.subVectors(target.getCenter(new Vector39()), box.getCenter(new Vector39()));
        const axis = { right: "x", left: "x", front: "z", back: "z", above: "y", below: "y" }[op.side];
        delta[axis] = ["right", "front", "above"].includes(op.side) ? target.max[axis] + op.gap - box.min[axis] : target.min[axis] - op.gap - box.max[axis];
      }
    } finally {
      built.dispose();
    }
    moveWorld(scene, op.id, delta, models);
    return;
  }
  fail("UNKNOWN_OPERATION", `Unsupported spatial operation ${op.op}.`);
}
function captureModel(scene, rootIds, id, name = id) {
  parse(Id, id);
  const roots = [...new Set(rootIds)];
  if (!roots.length) fail("INPUT_REQUIRED", "Choose at least one node to capture.");
  const rootNodes = roots.map((root) => nodeById(scene, root));
  const parent = rootNodes[0].parent;
  if (rootNodes.some((n) => n.parent !== parent))
    fail("DIFFERENT_PARENTS", "Captured roots must share a parent. Group the assembly first.");
  const selected = /* @__PURE__ */ new Set();
  for (const root of roots) {
    if (roots.some((other) => other !== root && subtreeIds(scene, other).has(root)))
      fail("OVERLAPPING_SELECTION", "Select a parent or its child, not both.");
    subtreeIds(scene, root).forEach((n) => selected.add(n));
  }
  const nodes2 = resolveData(
    structuredClone(scene.nodes.filter((n) => selected.has(n.id))),
    scene.parameters
  );
  for (const node of nodes2)
    if (roots.includes(node.id)) {
      delete node.parent;
      if (roots.length === 1) node.transform = { ...node.transform, position: [0, 0, 0] };
    }
  const geometryIds = /* @__PURE__ */ new Set(), materialIds = /* @__PURE__ */ new Set();
  const collectGeometry = (gid) => {
    if (geometryIds.has(gid)) return;
    geometryIds.add(gid);
    const geometry = scene.geometries[gid];
    if (!geometry) fail("REFERENCE_MISSING", `Geometry ${gid} is missing.`);
    if (geometry.type === "boolean") {
      collectGeometry(geometry.left);
      collectGeometry(geometry.right);
    }
  };
  for (const node of nodes2) {
    if (node.type === "mesh") {
      collectGeometry(node.geometry);
      materialIds.add(node.material);
    }
    if (node.type === "model")
      Object.values(node.materialOverrides).forEach((mid) => materialIds.add(mid));
  }
  return parse(ModelSchema, {
    schemaVersion: 1,
    kind: "model",
    id,
    name,
    parameters: {},
    nodes: nodes2,
    geometries: resolveData(
      Object.fromEntries([...geometryIds].map((gid) => [gid, scene.geometries[gid]])),
      scene.parameters
    ),
    materials: Object.fromEntries([...materialIds].map((mid) => [mid, scene.materials[mid]]))
  });
}
function modelDependencies(library, id) {
  const result = {};
  const visiting = /* @__PURE__ */ new Set();
  const visit = (mid) => {
    if (visiting.has(mid)) fail("CYCLE", `Model dependency cycle includes ${mid}.`);
    if (Object.hasOwn(result, mid)) return;
    const model = library[mid];
    if (!Object.hasOwn(library, mid)) fail("REFERENCE_MISSING", `Model ${mid} is missing.`);
    visiting.add(mid);
    model.nodes.forEach((n) => {
      if (n.type === "model") visit(n.model);
    });
    visiting.delete(mid);
    result[mid] = structuredClone(model);
  };
  visit(id);
  return result;
}

// ../model-forge/src/kernel/application/operations.ts
function applyOperations(scene, operations, models = {}) {
  const next = structuredClone(scene);
  for (const [operationIndex, operation] of structuredClone(operations).entries()) {
    try {
      switch (operation.op) {
        case "patchNodes": {
          const selected = selectNodes(next, operation.selector);
          if (!selected.length)
            fail(
              "EMPTY_SELECTION",
              "No nodes match the selector. Inspect node list before retrying."
            );
          for (const node of selected)
            applySpatialOperation(
              next,
              { op: "patchNode", id: node.id, patch: operation.patch },
              models
            );
          break;
        }
        case "putNode": {
          const index = next.nodes.findIndex((n) => n.id === operation.node.id);
          if (index < 0) next.nodes.push(operation.node);
          else next.nodes[index] = operation.node;
          break;
        }
        case "removeNode": {
          if (!next.nodes.some((n) => n.id === operation.id))
            fail("NOT_FOUND", `Node ${operation.id} does not exist.`);
          const remove = /* @__PURE__ */ new Set([operation.id]);
          let added = true;
          while (added) {
            added = false;
            for (const n of next.nodes)
              if (n.parent && remove.has(n.parent) && !remove.has(n.id)) {
                if (!operation.cascade)
                  fail(
                    "HAS_CHILDREN",
                    `Node ${operation.id} has children. Set cascade: true to remove its subtree.`
                  );
                remove.add(n.id);
                added = true;
              }
          }
          next.nodes = next.nodes.filter((n) => !remove.has(n.id));
          break;
        }
        case "putGeometry":
          next.geometries[operation.id] = operation.geometry;
          break;
        case "removeGeometry":
          delete next.geometries[operation.id];
          break;
        case "putMaterial":
          next.materials[operation.id] = operation.material;
          break;
        case "removeMaterial":
          delete next.materials[operation.id];
          break;
        case "setParameter":
          next.parameters[operation.id] = operation.value;
          break;
        case "setCamera":
          next.camera = operation.camera;
          break;
        case "setEnvironment":
          next.environment = operation.environment;
          break;
        default:
          applySpatialOperation(next, operation, models);
      }
    } catch (error) {
      if (error instanceof ForgeError)
        throw new ForgeError(error.code, error.message, {
          operationIndex,
          operation: operation.op,
          cause: error.details
        });
      throw error;
    }
  }
  return next;
}

// ../model-forge/src/kernel/application/target.ts
function authoringTarget(scene, models, options = {}) {
  if (options.model && options.node) fail("INVALID_OPTION", "Choose --model or --node, not both.");
  if (options.parameters && !options.model)
    fail("INVALID_OPTION", "--parameters requires --model.");
  if (options.model) {
    if (!Object.hasOwn(models, options.model))
      fail("NOT_FOUND", `Model ${options.model} does not exist.`);
    return parse(SceneSchema, {
      schemaVersion: 1,
      kind: "scene",
      id: "model",
      name: models[options.model].name,
      environment: scene.environment,
      nodes: [
        { type: "model", id: "asset", model: options.model, parameters: options.parameters ?? {} }
      ]
    });
  }
  if (!options.node) return scene;
  const ids = subtreeIds(scene, options.node), ancestors = /* @__PURE__ */ new Set();
  let parent = nodeById(scene, options.node).parent;
  while (parent) {
    ancestors.add(parent);
    parent = nodeById(scene, parent).parent;
  }
  return parse(SceneSchema, {
    ...scene,
    nodes: scene.nodes.filter((n) => ids.has(n.id) || ancestors.has(n.id)).map(
      (n) => ids.has(n.id) ? n : {
        id: n.id,
        type: "group",
        name: n.name,
        parent: n.parent,
        transform: n.transform,
        visible: n.visible,
        tags: n.tags
      }
    )
  });
}

// ../model-forge/src/kernel/application/edit.ts
function checkGuards(snapshot, options) {
  if (options.expectedRevision !== void 0 && options.expectedRevision !== snapshot.scene.revision)
    fail(
      "REVISION_CONFLICT",
      "Scene changed since it was read. Inspect and reapply against its current revision.",
      { expected: options.expectedRevision, actual: snapshot.scene.revision }
    );
  if (options.expectedState !== void 0 && options.expectedState !== snapshot.stateHash)
    fail(
      "STATE_CONFLICT",
      "The scene or model library changed since it was read. Regenerate the preview or inspect the latest state.",
      { expected: options.expectedState, actual: snapshot.stateHash }
    );
}
function prepareSceneEdit(snapshot, operations, options, hash2) {
  const ops = operations.map((operation) => parse(OperationSchema, operation));
  const { scene, models } = snapshot;
  checkGuards(snapshot, options);
  const next = parse(SceneSchema, applyOperations(scene, ops, models));
  const built = compileScene(next, models);
  const stats = built.stats;
  built.dispose();
  const changed = JSON.stringify(next) !== JSON.stringify(scene);
  const proposedRevision = scene.revision + (changed ? 1 : 0);
  if (changed && !options.dryRun) next.revision = proposedRevision;
  return {
    next,
    result: {
      scene: scene.id,
      revision: next.revision,
      stateHash: options.dryRun ? snapshot.stateHash : hash2(next, models),
      proposedStateHash: hash2({ ...next, revision: proposedRevision }, models),
      proposedRevision,
      changes: sceneChanges(scene, next),
      changed,
      dryRun: !!options.dryRun,
      operations: ops.length,
      stats
    }
  };
}

// ../model-forge/src/kernel/application/quality.ts
import {
  Box3 as Box35,
  Vector3 as Vector310,
  Mesh as Mesh4,
  SkinnedMesh as SkinnedMesh3,
  DoubleSide as DoubleSide2
} from "three";
function auditScene(scene, models = {}, input = {}) {
  const policy = parse(QualityPolicySchema, { schemaVersion: 1, kind: "quality-policy", ...input });
  const built = compileScene(scene, models);
  try {
    const findings = /* @__PURE__ */ new Map();
    const add = (code, severity, message, hint, path13, count = 1) => {
      const f = findings.get(code) ?? { code, severity, message, count: 0, paths: [], hint };
      f.count += count;
      if (path13 && !f.paths.includes(path13) && f.paths.length < 10) f.paths.push(path13);
      findings.set(code, f);
    };
    const geometries = /* @__PURE__ */ new Set(), materials = /* @__PURE__ */ new Set();
    const degenerate = /* @__PURE__ */ new Map();
    const bounds = new Box35();
    const a = new Vector310(), b = new Vector310(), c = new Vector310(), ab = new Vector310(), ac = new Vector310();
    let meshes = 0, triangles2 = 0, geometryBytes = 0, nodes2 = 0;
    built.content.traverseVisible((object) => {
      if (object.userData.forgeId) nodes2++;
      if (!(object instanceof Mesh4)) return;
      meshes++;
      const g = object.geometry;
      const position = g.getAttribute("position");
      const count = (g.index?.count ?? position.count) / 3;
      triangles2 += count;
      if (!geometries.has(g)) {
        geometries.add(g);
        geometryBytes += (g.index?.array.byteLength ?? 0) + Object.values(g.attributes).reduce((sum, attr) => sum + attr.array.byteLength, 0);
      }
      if (object instanceof SkinnedMesh3) {
        object.computeBoundingBox();
        if (object.boundingBox)
          bounds.union(object.boundingBox.clone().applyMatrix4(object.matrixWorld));
      } else {
        if (!g.boundingBox) g.computeBoundingBox();
        bounds.union(g.boundingBox.clone().applyMatrix4(object.matrixWorld));
      }
      if (!degenerate.has(g)) {
        let invalid3 = 0;
        for (let i = 0; i < count * 3; i += 3) {
          const at2 = (offset) => g.index ? g.index.getX(i + offset) : i + offset;
          a.fromBufferAttribute(position, at2(0));
          b.fromBufferAttribute(position, at2(1));
          c.fromBufferAttribute(position, at2(2));
          ab.subVectors(b, a);
          ac.subVectors(c, a);
          const edge = Math.max(ab.lengthSq(), ac.lengthSq(), b.distanceToSquared(c));
          if (ab.cross(ac).lengthSq() <= edge * edge * 1e-24) invalid3++;
        }
        degenerate.set(g, invalid3);
      }
      const invalid2 = degenerate.get(g);
      if (invalid2)
        add(
          "DEGENERATE_TRIANGLES",
          "error",
          "Visible geometry contains zero-area or nearly collinear triangles.",
          "Repair mesh indices/positions or revise boolean operands; inspect the listed paths.",
          object.name,
          invalid2
        );
      if (policy.requireUVs && !g.hasAttribute("uv"))
        add(
          "UVS_REQUIRED",
          "error",
          "The quality policy requires UV coordinates.",
          "Supply one uv pair per position in custom meshes; CSG currently discards UVs.",
          object.name
        );
      if (object.matrixWorld.determinant() < 0)
        add(
          "MIRRORED_TRANSFORM",
          "warning",
          "A visible mesh has a mirrored world transform.",
          "Review winding, normals and face culling in the target renderer.",
          object.name
        );
      for (const m of Array.isArray(object.material) ? object.material : [object.material]) {
        materials.add(m);
        if (m.transparent)
          add(
            "TRANSPARENCY",
            policy.allowTransparency ? "warning" : "error",
            "Alpha blending can produce sorting differences between renderers.",
            "Review overlapping transparent surfaces; use opaque materials when transparency is unnecessary.",
            object.name
          );
        if (m.side === DoubleSide2 && !policy.allowDoubleSided)
          add(
            "DOUBLE_SIDED",
            "error",
            "The quality policy disallows double-sided materials.",
            "Correct winding or explicitly permit double-sided surfaces in the policy.",
            object.name
          );
      }
    });
    if (!meshes)
      add(
        "EMPTY_DELIVERABLE",
        "error",
        "No visible meshes will be exported.",
        "Add a mesh/model or enable visibility on its ancestors."
      );
    const size = bounds.isEmpty() ? [0, 0, 0] : bounds.getSize(new Vector310()).toArray();
    const metrics = {
      nodes: nodes2,
      meshes,
      triangles: triangles2,
      geometries: geometries.size,
      materials: materials.size,
      geometryBytes,
      maxExtent: Math.max(...size),
      bounds: {
        min: bounds.isEmpty() ? [0, 0, 0] : bounds.min.toArray(),
        max: bounds.isEmpty() ? [0, 0, 0] : bounds.max.toArray(),
        size
      }
    };
    for (const [limit, metric] of [
      ["maxTriangles", "triangles"],
      ["maxMeshes", "meshes"],
      ["maxMaterials", "materials"],
      ["maxGeometries", "geometries"],
      ["maxExtent", "maxExtent"]
    ]) {
      const value = policy[limit];
      if (value !== void 0 && metrics[metric] > value)
        add(
          "BUDGET_" + metric.toUpperCase(),
          "error",
          `${metric} is ${metrics[metric]}; the policy limit is ${value}.`,
          "Reduce the asset cost/extent or revise the project-specific policy."
        );
    }
    const list = [...findings.values()];
    return {
      schemaVersion: 1,
      kind: "quality-report",
      scope: "visible",
      passed: !list.some((f) => f.severity === "error"),
      policy,
      metrics,
      findings: list,
      summary: {
        errors: list.filter((f) => f.severity === "error").length,
        warnings: list.filter((f) => f.severity === "warning").length
      },
      limitations: [
        "Not a manifold, collision, UV-overlap or native application import check.",
        "geometryBytes counts unique attribute/index buffers, not GPU memory or export file size."
      ]
    };
  } finally {
    built.dispose();
  }
}

// ../model-forge/src/kernel/application/littlewild.ts
import * as THREE12 from "three";

// ../model-forge/src/kernel/application/littlewild-native.ts
var natives = /* @__PURE__ */ new Map();
function buffers(geometry) {
  const position = Array.from(geometry.getAttribute("position").array);
  const normal = Array.from(geometry.getAttribute("normal").array);
  for (let i = 0; i < normal.length; i += 3) {
    const length = Math.hypot(normal[i], normal[i + 1], normal[i + 2]);
    for (let axis = 0; axis < 3; axis++) normal[i + axis] /= length || 1;
  }
  return {
    position,
    normal,
    uv: geometry.getAttribute("uv") ? Array.from(geometry.getAttribute("uv").array) : sphereUVs(position),
    index: geometry.index ? Array.from(geometry.index.array) : Array.from({ length: position.length / 3 }, (_, i) => i)
  };
}
function unchangedNative(kind, geometry, create) {
  if (!natives.has(kind)) {
    const source2 = create();
    try {
      natives.set(kind, buffers(source2));
    } finally {
      source2.dispose();
    }
  }
  const source = natives.get(kind), actual = buffers(geometry);
  for (const [field, tolerance] of [
    ["position", 11e-6],
    ["normal", 2e-4],
    ["uv", 1e-6],
    ["index", 0]
  ]) {
    if (source[field].length !== actual[field].length || source[field].some((value, i) => Math.abs(value - actual[field][i]) > tolerance))
      return false;
  }
  return true;
}

// ../model-forge/src/kernel/application/littlewild.ts
var littlewildLimits = {
  meshVertices: 8192,
  meshTriangles: 16384,
  definitionVertices: 4e4,
  definitionValues: 4e5,
  definitionDepth: 32
};
var littlewildPetRoles = [
  "body",
  "head",
  "eyes",
  "ears",
  "tail",
  "arms",
  "feet",
  "mouth",
  "cheeks",
  "sprout",
  "shell",
  // Accessory sockets: empty groups where Littlewild attaches equipped items.
  "hat",
  "face",
  "neck",
  "back"
];
function roofGeometry() {
  const shape = new THREE12.Shape();
  shape.moveTo(-0.5, 0);
  shape.lineTo(0.5, 0);
  shape.lineTo(0, 0.62);
  shape.closePath();
  const geometry = new THREE12.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false });
  geometry.translate(0, 0, -0.5);
  return geometry;
}
function primitiveGeometry(kind) {
  switch (kind) {
    case "ball":
      return new THREE12.IcosahedronGeometry(1, 0);
    case "tiny":
      return new THREE12.SphereGeometry(1, 6, 4);
    case "soft":
      return new THREE12.SphereGeometry(1, 10, 7);
    case "cone":
      return new THREE12.ConeGeometry(1, 1, 7);
    case "cylinder":
      return new THREE12.CylinderGeometry(1, 1, 1, 8);
    case "ring":
      return new THREE12.TorusGeometry(1, 0.07, 4, 16);
    case "roof":
      return roofGeometry();
    case "ground": {
      const g = new THREE12.BufferGeometry();
      g.setAttribute(
        "position",
        new THREE12.Float32BufferAttribute(
          [-0.5, 0, -0.5, -0.5, 0, 0.5, 0.5, 0, 0.5, 0.5, 0, -0.5],
          3
        )
      );
      g.setIndex([0, 1, 2, 0, 2, 3]);
      g.computeVertexNormals();
      return g;
    }
    default:
      return fail("LITTLEWILD_IMPORT", `Unsupported Littlewild primitive ${kind}.`);
  }
}
function nativePrimitive(object) {
  const kind = /^lw-(ball|soft|tiny|cone|cylinder|ring|roof|ground)$/.exec(
    String(object.userData.geometry ?? "")
  )?.[1];
  if (!kind) return null;
  return unchangedNative(kind, object.geometry, () => primitiveGeometry(kind)) ? kind : null;
}
var pairedRoles = /* @__PURE__ */ new Set(["eyes", "ears", "cheeks", "arms", "feet"]);
var round = (value, step) => {
  const result = Math.round(value / step) * step;
  return Number((Object.is(result, -0) ? 0 : result).toFixed(Math.max(0, -Math.log10(step))));
};
var vector = (values, step = 1e-5) => values.map((v) => round(v, step));
var same = (values, value) => values.every((v) => Math.abs(v - value) < 1e-9);
function hash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619) >>> 0;
  return h.toString(16).padStart(8, "0");
}
function littlewildId(value) {
  const id = value.replace(/([a-z0-9])([A-Z])/g, "$1-$2").replace(/[^A-Za-z0-9_-]+/g, "-").toLowerCase().replace(/^[^a-z0-9]+/, "").slice(0, 72);
  return id || "node";
}
function materialData(material2) {
  const m = material2;
  const result = {
    color: `#${m.color.getHexString()}`,
    roughness: round(m.roughness ?? 1, 1e-3),
    metalness: round(m.metalness ?? 0, 1e-3),
    flatShading: !!m.flatShading
  };
  if (material2.userData.surface) result.surface = structuredClone(material2.userData.surface);
  if (material2 instanceof THREE12.MeshPhysicalMaterial) {
    result.sheen = round(material2.sheen, 1e-3);
    result.sheenColor = `#${material2.sheenColor.getHexString()}`;
    result.sheenRoughness = round(material2.sheenRoughness, 1e-3);
    result.clearcoat = round(material2.clearcoat, 1e-3);
    result.clearcoatRoughness = round(material2.clearcoatRoughness, 1e-3);
  }
  if (m.emissive && m.emissive.getHex() !== 0) {
    result.emissive = `#${m.emissive.getHexString()}`;
    result.emissiveIntensity = round(m.emissiveIntensity ?? 1, 1e-3);
  }
  if (material2.side === THREE12.DoubleSide) result.doubleSided = true;
  if (!material2.depthWrite) result.depthWrite = false;
  if (material2.opacity < 1) {
    result.opacity = round(material2.opacity, 1e-3);
    result.transparent = true;
  }
  return result;
}
function meshData(geometry, label) {
  const position = geometry.getAttribute("position");
  if (!position || position.itemSize !== 3) fail("LITTLEWILD_EXPORT", `${label} has no positions.`);
  const vertices = position.count, triangles2 = (geometry.index?.count ?? vertices) / 3;
  if (vertices > littlewildLimits.meshVertices || triangles2 > littlewildLimits.meshTriangles)
    fail(
      "LITTLEWILD_BUDGET",
      `${label} has ${vertices} vertices and ${triangles2} triangles; Littlewild meshes allow ${littlewildLimits.meshVertices} vertices and ${littlewildLimits.meshTriangles} triangles. Reduce its segments.`
    );
  const positions = [];
  for (let i = 0; i < vertices; i++)
    positions.push(...vector([position.getX(i), position.getY(i), position.getZ(i)], 1e-4));
  const result = { positions };
  const normal = geometry.getAttribute("normal");
  if (normal && normal.count === vertices) {
    const normals = [];
    for (let i = 0; i < vertices; i++)
      normals.push(...vector([normal.getX(i), normal.getY(i), normal.getZ(i)], 1e-3));
    result.normals = normals;
  }
  const uv = geometry.getAttribute("uv");
  if (uv && uv.count === vertices) {
    result.uvs = [];
    for (let i = 0; i < vertices; i++) result.uvs.push(...vector([uv.getX(i), uv.getY(i)], 1e-5));
  }
  if (geometry.index) result.indices = Array.from(geometry.index.array);
  return { ...result, ...authoredMeshBuffers(geometry) };
}
function boxSize(geometry) {
  const position = geometry.getAttribute("position");
  if (!position || position.count !== 24 || geometry.index?.count !== 36) return null;
  geometry.computeBoundingBox();
  const box = geometry.boundingBox, size = box.getSize(new THREE12.Vector3()).toArray(), center = box.getCenter(new THREE12.Vector3()).toArray();
  if (center.some((v) => Math.abs(v) > 1e-6) || size.some((v) => v <= 0)) return null;
  for (let i = 0; i < 24; i++)
    for (let axis = 0; axis < 3; axis++)
      if (Math.abs(Math.abs(position.getComponent(i, axis)) - size[axis] / 2) > 1e-6) return null;
  return size;
}
function littlewildModel(root, options) {
  const materials = {}, materialRoles = /* @__PURE__ */ new Map(), meshes = {}, meshIds = /* @__PURE__ */ new Map(), ids = /* @__PURE__ */ new Set(), rig = {}, warnings = /* @__PURE__ */ new Set(), stats = { nodes: 0, meshes: 0, primitives: 0, vertices: 0, triangles: 0 };
  const roles = new Set(littlewildPetRoles);
  function role(material2, authoredRole) {
    if (Array.isArray(material2))
      fail("LITTLEWILD_EXPORT", "Multi-material meshes are unsupported.");
    const data = materialData(material2);
    const key = JSON.stringify([authoredRole ?? material2.name, data]);
    const known = materialRoles.get(key);
    if (known) return known;
    if (material2.type === "MeshBasicMaterial")
      warnings.add("Unlit materials are exported as standard Littlewild materials.");
    const base = (authoredRole ?? material2.name.split("/").pop() ?? "material").slice(0, 72);
    let name = base;
    for (let n = 2; materials[name] && JSON.stringify(materials[name]) !== JSON.stringify(data); n++)
      name = `${base}-${n}`;
    materials[name] = data;
    materialRoles.set(key, name);
    return name;
  }
  function nodeId(object, parentId) {
    const last = object.name.split("/").pop() ?? "";
    const own = littlewildId(String(object.userData.forgeId ?? "node"));
    let id = /^[0-9]+$/.test(last) ? `${own}-${last}` : own;
    if (ids.has(id)) id = `${parentId}-${id}`.slice(0, 72);
    for (let n = 2; ids.has(id); n++) id = `${id.slice(0, 70)}-${n}`;
    ids.add(id);
    return id;
  }
  function transform2(object, node) {
    const p = vector(object.position.toArray()), r = vector([object.rotation.x, object.rotation.y, object.rotation.z]), s = vector(object.scale.toArray());
    if (object.rotation.order !== "XYZ")
      fail("LITTLEWILD_EXPORT", "Only XYZ rotation order is supported.");
    if (!same(p, 0)) node.position = p;
    if (!same(r, 0)) node.rotation = r;
    if (!same(s, 1)) node.scale = s;
  }
  function convert(object, parentId) {
    if (object instanceof THREE12.Light) {
      warnings.add("Lights are not part of Littlewild assets and were skipped.");
      return null;
    }
    const id = nodeId(object, parentId), node = { primitive: "group", id };
    stats.nodes++;
    transform2(object, node);
    if (!object.visible) node.visible = false;
    if (object instanceof THREE12.Mesh) {
      const geometry = object.geometry, size = object.userData.geometryType === "box" ? boxSize(geometry) : null;
      node.material = role(object.material, object.userData.material);
      const native = nativePrimitive(object);
      if (native) {
        node.primitive = native;
        stats.primitives++;
      } else if (size) {
        node.primitive = "box";
        node.scale = vector((node.scale ?? [1, 1, 1]).map((v, axis) => v * size[axis]));
        stats.primitives++;
      } else {
        let meshId = meshIds.get(geometry);
        if (!meshId) {
          const data = meshData(geometry, String(object.userData.forgePath ?? id));
          const content2 = JSON.stringify(data), base = `m-${hash(content2)}`;
          meshId = base;
          for (let collision = 2; meshes[meshId] && JSON.stringify(meshes[meshId]) !== content2; collision++)
            meshId = `${base}-${collision}`;
          meshIds.set(geometry, meshId);
          if (!meshes[meshId]) {
            meshes[meshId] = data;
            stats.vertices += data.positions.length / 3;
          }
        }
        node.primitive = "mesh";
        node.mesh = meshId;
        stats.meshes++;
      }
      stats.triangles += (geometry.index?.count ?? geometry.getAttribute("position").count) / 3;
    }
    for (const tag of object.userData.tags ?? []) {
      if (!tag.startsWith("rig:")) continue;
      const name = tag.slice(4);
      if (!options.rig) warnings.add("Rig tags are exported only for the pets family.");
      else if (!roles.has(name))
        fail("LITTLEWILD_EXPORT", `Unknown Littlewild rig role ${name}.`, { roles: [...roles] });
      else (rig[name] ??= []).push(id);
    }
    const children = object.children.flatMap((child) => convert(child, id) ?? []);
    if (children.length) node.children = children;
    return node;
  }
  const nodes2 = root.children.flatMap((child) => convert(child, "asset") ?? []);
  if (!stats.primitives && !stats.meshes)
    fail("LITTLEWILD_EXPORT", "The model has no visible geometry.");
  if (stats.vertices > littlewildLimits.definitionVertices)
    fail(
      "LITTLEWILD_BUDGET",
      `Model bakes ${stats.vertices} vertices; Littlewild allows ${littlewildLimits.definitionVertices}.`
    );
  return {
    nodes: nodes2,
    materials,
    meshes,
    rig: Object.fromEntries(
      Object.entries(rig).map(([key, value]) => {
        if (!pairedRoles.has(key) && value.length > 1)
          fail("LITTLEWILD_EXPORT", `Rig role ${key} is tagged on ${value.length} nodes.`);
        return [key, pairedRoles.has(key) ? value : value[0]];
      })
    ),
    warnings: [...warnings],
    stats
  };
}

// ../model-forge/src/kernel/application/littlewild-import.ts
import * as THREE13 from "three";

// ../model-forge/src/kernel/application/littlewild-materials.ts
var plain = (value) => !!value && typeof value === "object" && !Array.isArray(value);
var fields = /* @__PURE__ */ new Set([
  "color",
  "roughness",
  "metalness",
  "opacity",
  "transparent",
  "depthWrite",
  "doubleSided",
  "flatShading",
  "emissive",
  "emissiveIntensity",
  "surface",
  "sheen",
  "sheenColor",
  "sheenRoughness",
  "clearcoat",
  "clearcoatRoughness"
]);
function importedMaterials(materials, used) {
  const byValue = /* @__PURE__ */ new Map();
  return (role, props, nodeId, mesh) => {
    const base = Object.hasOwn(materials, role) ? materials[role] : role;
    if (props !== void 0 && !plain(props))
      fail("LITTLEWILD_IMPORT", `Node ${nodeId} materialProps must be an object.`);
    const data = {
      ...typeof base === "string" ? { color: base } : plain(base) ? base : {},
      ...plain(props) ? props : {}
    };
    const unsupported = (field, reason) => fail(
      "LITTLEWILD_MATERIAL_UNSUPPORTED",
      `Node ${nodeId} material ${role}: ${field} ${reason}`,
      { node: nodeId, material: role, field, value: data[field] }
    );
    for (const field of Object.keys(data))
      if (!fields.has(field)) unsupported(field, "is not supported by Scene Forge.");
    const opacity = data.opacity ?? 1;
    const transparent = data.transparent ?? false;
    if (data.depthWrite !== void 0 && typeof data.depthWrite !== "boolean")
      unsupported("depthWrite", "must be a boolean.");
    if (data.depthWrite === false && !(transparent === true && typeof opacity === "number" && opacity < 1))
      unsupported("depthWrite", "false requires an alpha-blended surface with opacity below 1.");
    if (typeof transparent !== "boolean" || transparent !== (typeof opacity === "number" && opacity < 1))
      unsupported(
        "transparent",
        "must match opacity < 1; change the source explicitly before importing."
      );
    if (typeof data.emissiveIntensity === "number" && data.emissiveIntensity > 20)
      unsupported("emissiveIntensity", "exceeds Scene Forge\u2019s maximum of 20.");
    const { transparent: _transparent, ...mapped } = data;
    const material2 = {
      roughness: 0.98,
      metalness: 0,
      opacity: 1,
      flatShading: !mesh,
      ...mapped
    };
    const key = canonical([role, material2]);
    const found = byValue.get(key);
    if (found) return found;
    const stem = (Object.hasOwn(materials, role) ? role : `c${role.replace("#", "")}`).replace(
      /[^A-Za-z0-9_-]/g,
      "-"
    );
    const prefix = /^[A-Za-z]/.test(stem) ? stem : `m${stem}`;
    const hasOverride = plain(props) && Object.keys(props).length > 0;
    let id = `${prefix.slice(0, hasOverride ? 32 : 64)}${hasOverride ? `-${nodeId.slice(0, 30)}` : ""}`;
    const start = id;
    let collision = 1;
    while (Object.hasOwn(used, id)) id = `${start.slice(0, 55)}-${collision++}`;
    used[id] = material2;
    byValue.set(key, id);
    return id;
  };
}

// ../model-forge/src/kernel/application/littlewild-import.ts
var plain2 = (value) => !!value && typeof value === "object" && !Array.isArray(value);
var degrees = (value) => Number(THREE13.MathUtils.radToDeg(value).toFixed(4));
var triples = (values, step) => {
  const out = [];
  for (let i = 0; i < values.length; i += 3)
    out.push(
      [0, 1, 2].map(
        (k) => step === void 0 ? values[i + k] : Number((Math.round(values[i + k] / step) * step).toFixed(5))
      )
    );
  return out;
};
function bake(geometry) {
  const indexed = geometry;
  const position = indexed.getAttribute("position"), normal = indexed.getAttribute("normal");
  const indices = indexed.index ? Array.from(indexed.index.array) : Array.from({ length: position.count }, (_, i) => i);
  return {
    type: "mesh",
    positions: triples(position.array, 1e-5),
    indices,
    ...indexed.getAttribute("uv") ? {
      uvs: Array.from({ length: position.count }, (_, i) => [
        indexed.getAttribute("uv").getX(i),
        indexed.getAttribute("uv").getY(i)
      ])
    } : {},
    ...normal ? { normals: triples(normal.array, 1e-4) } : {}
  };
}
function forgeId(value, fallback) {
  const id = value.replace(/[^A-Za-z0-9_-]/g, "-").slice(0, 64);
  return /^[A-Za-z]/.test(id) ? id : `n${id}`.slice(0, 64) || fallback;
}
function importedNodeIds(roots) {
  const result = /* @__PURE__ */ new Map(), ids = /* @__PURE__ */ new Set();
  let counter = 0;
  const visit = (input) => {
    if (!plain2(input)) return;
    const lwId = typeof input.id === "string" ? input.id : void 0;
    let nodeId = forgeId(lwId ?? `${String(input.primitive)}${++counter}`, `node${++counter}`);
    while (ids.has(nodeId)) nodeId = `${nodeId.slice(0, 58)}${++counter}`;
    ids.add(nodeId);
    result.set(input, nodeId);
    for (const child of Array.isArray(input.children) ? input.children : []) visit(child);
  };
  for (const node of roots) visit(node);
  return result;
}
var camel = (value) => value.replace(/[-_]+([a-z0-9])/g, (_, c) => c.toUpperCase()).replace(/[^A-Za-z0-9]/g, "");
function littlewildModels(asset, prefix) {
  return littlewildImportPlan(asset, prefix).models;
}
function littlewildImportPlan(asset, prefix) {
  if (asset.format !== "littlewild-3d-asset" || asset.schemaVersion !== 1 || !plain2(asset.models))
    fail("LITTLEWILD_IMPORT", "Expected a littlewild-3d-asset visual definition.");
  const base = forgeId(prefix ?? camel(String(asset.id)), "littlewild"), meshes = plain2(asset.meshes) ? asset.meshes : {}, materials = plain2(asset.materials) ? asset.materials : {}, rig = asset.category === "pet" && plain2(asset.rig) ? asset.rig : {};
  const roles = new Set(littlewildPetRoles);
  const models = {};
  const variantModels = [];
  for (const [variant, model] of Object.entries(asset.models)) {
    if (!plain2(model) || !Array.isArray(model.nodes))
      fail("LITTLEWILD_IMPORT", `Variant ${variant} has no nodes.`);
    const suffix = camel(`-${variant}`);
    const id = `${base.slice(0, Math.max(1, 64 - suffix.length))}${suffix}`.slice(0, 64);
    if (Object.hasOwn(models, id))
      fail(
        "LITTLEWILD_IMPORT",
        `Variants collide at model ID ${id}. Choose distinct variant names or a shorter prefix.`
      );
    variantModels.push([variant, id]);
    const geometries = { box: { type: "box", size: [1, 1, 1] } }, usedMaterials = {}, nodes2 = [], tags = /* @__PURE__ */ new Map();
    for (const [role, refs] of Object.entries(plain2(rig[variant]) ? rig[variant] : {}))
      if (roles.has(role))
        for (const ref of Array.isArray(refs) ? refs : [refs])
          tags.set(String(ref), [...tags.get(String(ref)) ?? [], `rig:${role}`]);
    const resolveMaterial = importedMaterials(materials, usedMaterials);
    const nodeIds = importedNodeIds(model.nodes);
    const visit = (input, parent) => {
      if (!plain2(input)) return;
      const primitive = String(input.primitive), lwId = typeof input.id === "string" ? input.id : void 0;
      const nodeId = nodeIds.get(input);
      const vec = (key) => Array.isArray(input[key]) ? input[key] : void 0;
      const position = vec("position"), rotation2 = vec("rotation"), scale = vec("scale");
      const node = {
        id: nodeId,
        type: primitive === "group" ? "group" : "mesh",
        ...parent ? { parent } : {},
        ...position || rotation2 || scale ? {
          transform: {
            ...position ? { position } : {},
            ...rotation2 ? { rotation: rotation2.map(degrees) } : {},
            ...scale ? { scale } : {}
          }
        } : {},
        ...input.visible === false ? { visible: false } : {},
        ...lwId && tags.has(lwId) ? { tags: tags.get(lwId) } : {}
      };
      if (primitive !== "group") {
        const geometryId = primitive === "mesh" ? forgeId(`mesh-${String(input.mesh)}`, "mesh") : primitive === "box" ? "box" : `lw-${primitive}`;
        if (!geometries[geometryId]) {
          if (primitive === "mesh") {
            const data = meshes[String(input.mesh)];
            if (!plain2(data) || !Array.isArray(data.positions))
              fail("LITTLEWILD_IMPORT", `Missing mesh ${String(input.mesh)}.`);
            const positions = data.positions;
            if (data.uvs !== void 0 && (!Array.isArray(data.uvs) || data.uvs.length !== positions.length / 3 * 2 || data.uvs.some(
              (value) => typeof value !== "number" || !Number.isFinite(value) || Math.abs(value) > 1e4
            )))
              fail(
                "LITTLEWILD_IMPORT",
                `Mesh ${String(input.mesh)} needs one finite UV pair per position, bounded to \xB110000.`
              );
            geometries[geometryId] = {
              type: "mesh",
              positions: triples(positions),
              indices: Array.isArray(data.indices) ? data.indices : Array.from({ length: positions.length / 3 }, (_, i) => i),
              ...Array.isArray(data.uvs) ? {
                uvs: Array.from({ length: positions.length / 3 }, (_, i) => [
                  data.uvs[i * 2],
                  data.uvs[i * 2 + 1]
                ])
              } : {},
              ...Array.isArray(data.normals) ? { normals: triples(data.normals) } : {}
            };
          } else geometries[geometryId] = bake(primitiveGeometry(primitive));
        }
        const role = String(input.material);
        const materialId = resolveMaterial(role, input.materialProps, nodeId, primitive === "mesh");
        Object.assign(node, { geometry: geometryId, material: materialId });
      }
      nodes2.push(node);
      for (const child of Array.isArray(input.children) ? input.children : []) visit(child, nodeId);
    };
    for (const node of model.nodes) visit(node);
    if (!Object.values(usedMaterials).length)
      fail("LITTLEWILD_IMPORT", `Variant ${variant} has no geometry.`);
    const used = new Set(nodes2.map((n) => n.geometry).filter(Boolean));
    models[id] = {
      schemaVersion: 1,
      kind: "model",
      id,
      name: `${String(asset.name)} (${variant})`.slice(0, 120),
      category: `littlewild-${String(asset.category)}`,
      description: `Imported from Littlewild ${String(asset.category)}:${String(asset.id)}/${variant}.`,
      geometries: Object.fromEntries(Object.entries(geometries).filter(([k]) => used.has(k))),
      materials: usedMaterials,
      nodes: nodes2
    };
  }
  return { models, variantModels: Object.fromEntries(variantModels) };
}

// ../model-forge/src/kernel/application/littlewild-resources.ts
var plain3 = (value) => !!value && typeof value === "object" && !Array.isArray(value);
function nodes(models, visit) {
  const walk = (values) => {
    for (const node of values)
      if (plain3(node)) {
        visit(node);
        if (Array.isArray(node.children)) walk(node.children);
      }
  };
  for (const model of Object.values(models))
    if (plain3(model) && Array.isArray(model.nodes)) walk(model.nodes);
}
function reuseLittlewildMeshes(models, meshes, preferred) {
  const used = /* @__PURE__ */ new Set();
  nodes(models, (node) => {
    if (typeof node.mesh === "string") used.add(node.mesh);
  });
  const byContent = /* @__PURE__ */ new Map(), names = /* @__PURE__ */ new Map(), output = {};
  for (const id of /* @__PURE__ */ new Set([...preferred, ...Object.keys(meshes)])) {
    if (!used.has(id) || !Object.hasOwn(meshes, id)) continue;
    const key = canonical(meshes[id]), existing = byContent.get(key);
    if (existing) names.set(id, existing);
    else {
      byContent.set(key, id);
      output[id] = meshes[id];
    }
  }
  nodes(models, (node) => {
    if (typeof node.mesh === "string" && names.has(node.mesh)) node.mesh = names.get(node.mesh);
  });
  return output;
}
function assertLittlewildComplexity(visual) {
  let count = 0;
  const visit = (value, depth) => {
    if (++count > 4e5 || depth > 32)
      fail(
        "LITTLEWILD_BUDGET",
        "Visual exceeds Littlewild\u2019s 400,000 JSON values or depth 32. Reuse mesh resources, reduce segments, or remove unused variants."
      );
    if (value && typeof value === "object")
      for (const child of Object.values(value)) visit(child, depth + 1);
  };
  visit(visual, 0);
}

// ../model-forge/src/kernel/application/terrain.ts
var identity = () => ({ scale: 1, yaw: 0, translation: [0, 0, 0] });
function turn(yaw, x, z13) {
  if (yaw === 0) return [x, z13];
  const c = Math.cos(yaw), s = Math.sin(yaw);
  return [x * c + z13 * s, -x * s + z13 * c];
}
function applySimilarity(f, p) {
  const [x, z13] = turn(f.yaw, p[0] * f.scale, p[2] * f.scale);
  return [x + f.translation[0], p[1] * f.scale + f.translation[1], z13 + f.translation[2]];
}
function invertSimilarity(f, p) {
  const [x, z13] = turn(-f.yaw, p[0] - f.translation[0], p[2] - f.translation[2]);
  return [x / f.scale, (p[1] - f.translation[1]) / f.scale, z13 / f.scale];
}
function nodeFrame(scene, id, role) {
  const chain = [];
  const seen = /* @__PURE__ */ new Set();
  for (let current = id; current; ) {
    if (seen.has(current)) fail("CYCLE", `Parent cycle includes ${current}.`);
    seen.add(current);
    const node = scene.nodes.find((n) => n.id === current);
    if (!node) return fail("REFERENCE_MISSING", `Node ${current} does not exist.`);
    chain.push(node);
    current = node.parent;
  }
  let frame = identity();
  for (const node of chain.reverse()) {
    const t = resolveData(node.transform ?? {}, scene.parameters);
    const [rx, ry, rz] = t.rotation ?? [0, 0, 0], [sx, sy, sz] = t.scale ?? [1, 1, 1];
    if (node.pattern || Math.abs(rx) > 1e-9 || Math.abs(rz) > 1e-9 || sx <= 0 || Math.abs(sx - sy) > 1e-9 || Math.abs(sx - sz) > 1e-9)
      fail(
        "TERRAIN_TRANSFORM",
        `Node ${node.id} on the ${role} chain uses a transform grounding cannot follow.`,
        {
          node: node.id,
          transform: node.transform,
          pattern: node.pattern !== void 0,
          hint: "Terrain grounding supports translation, yaw (rotation about Y) and positive uniform scale, without patterns, on the terrain node, the scatter parent and their ancestors."
        }
      );
    const local = {
      scale: sx,
      yaw: ry * Math.PI / 180,
      translation: t.position ?? [0, 0, 0]
    };
    frame = {
      scale: frame.scale * local.scale,
      yaw: frame.yaw + local.yaw,
      translation: applySimilarity(frame, local.translation)
    };
  }
  return frame;
}
function terrainSpec(scene, id) {
  const node = scene.nodes.find((n) => n.id === id);
  if (!node) return fail("REFERENCE_MISSING", `Terrain node ${id} does not exist.`);
  const geometry = node.type === "mesh" ? scene.geometries[node.geometry] : void 0;
  if (!geometry || geometry.type !== "heightfield")
    fail("INVALID_NODE_TYPE", `Node ${id} is not a mesh with heightfield geometry.`, {
      hint: "Ground on a mesh node whose geometry has type heightfield."
    });
  const spec = resolveData(geometry, scene.parameters);
  if (spec.size.some((v) => !(v > 0)))
    fail("INVALID_GEOMETRY", `Heightfield of ${id} needs a positive size.`);
  return spec;
}
function terrainSampler(scene, terrain, frameNode) {
  const sample = heightfieldSampler(terrainSpec(scene, terrain));
  const terrainFrame = nodeFrame(scene, terrain, "terrain"), frame = nodeFrame(scene, frameNode, "scatter parent");
  return (x, z13) => {
    const local = invertSimilarity(terrainFrame, applySimilarity(frame, [x, 0, z13]));
    const hit = sample(local[0], local[2]);
    const world = applySimilarity(terrainFrame, [local[0], hit.y, local[2]]);
    const [nx, nz] = turn(terrainFrame.yaw - frame.yaw, hit.normal[0], hit.normal[2]);
    return {
      y: invertSimilarity(frame, world)[1],
      normal: [nx, hit.normal[1], nz],
      inside: hit.inside
    };
  };
}
function sampleTerrainNode(scene, terrain, points) {
  const sample = terrainSampler(scene, terrain);
  return points.map(([x, z13]) => ({ x, z: z13, ...sample(x, z13) }));
}

// ../model-forge/src/kernel/application/terrain-presets.ts
var terrainPresetNames = ["plains", "hills", "mountains", "island", "dunes"];
var defaultTerrainPreset = "hills";
var material = { color: "#ffffff", roughness: 0.95, vertexColors: true };
var terrainPresets = {
  plains: {
    description: "Gently rolling grassland, nearly flat; good for layouts and roads.",
    geometry: {
      size: [64, 64],
      amplitude: 1.5,
      resolution: [64, 64],
      noise: { kind: "value", octaves: 3, frequency: 2, lacunarity: 2, gain: 0.45 },
      falloff: "none",
      terrace: 0,
      bands: [
        { below: 0.4, color: "#5f8f3e" },
        { below: 1, color: "#7aa851" }
      ]
    },
    material
  },
  hills: {
    description: "Rolling hills with grass valleys and earthy tops.",
    geometry: {
      size: [64, 64],
      amplitude: 6,
      resolution: [96, 96],
      noise: { kind: "value", octaves: 5, frequency: 3, lacunarity: 2, gain: 0.5 },
      falloff: "none",
      terrace: 0,
      bands: [
        { below: 0.45, color: "#5b8a3a" },
        { below: 0.75, color: "#7c9a4a" },
        { below: 1, color: "#8a7a55" }
      ]
    },
    material
  },
  mountains: {
    description: "Ridged peaks with rock faces and snow caps.",
    geometry: {
      size: [128, 128],
      amplitude: 28,
      resolution: [128, 128],
      noise: { kind: "ridged", octaves: 6, frequency: 2.5, lacunarity: 2.1, gain: 0.55 },
      falloff: "none",
      terrace: 0,
      bands: [
        { below: 0.3, color: "#4f7a3a" },
        { below: 0.65, color: "#7a7268" },
        { below: 0.85, color: "#9a948c" },
        { below: 1, color: "#f2f4f7" }
      ]
    },
    material
  },
  island: {
    description: "A single island falling off to sea level at the edges, with beaches.",
    geometry: {
      size: [96, 96],
      amplitude: 10,
      resolution: [96, 96],
      noise: { kind: "value", octaves: 5, frequency: 3, lacunarity: 2, gain: 0.5 },
      falloff: "island",
      terrace: 0,
      bands: [
        { below: 0.04, color: "#d9c58f" },
        { below: 0.5, color: "#5b8a3a" },
        { below: 0.8, color: "#6f7d4a" },
        { below: 1, color: "#8c8478" }
      ]
    },
    material
  },
  dunes: {
    description: "Soft desert dunes with billowed crests.",
    geometry: {
      size: [64, 64],
      amplitude: 4,
      resolution: [96, 96],
      noise: { kind: "billow", octaves: 3, frequency: 4, lacunarity: 2, gain: 0.4 },
      falloff: "none",
      terrace: 0,
      bands: [
        { below: 0.5, color: "#d6b77a" },
        { below: 1, color: "#e6cc92" }
      ]
    },
    material
  }
};
function terrainPreset(name, options = {}) {
  if (!terrainPresetNames.includes(name))
    fail("NOT_FOUND", `Terrain preset ${name} does not exist.`, {
      available: terrainPresetNames,
      hint: `Use one of ${terrainPresetNames.join(", ")}.`
    });
  const preset = terrainPresets[name];
  const geometry = parse(HeightfieldGeometrySchema, {
    type: "heightfield",
    ...structuredClone(preset.geometry),
    ...Object.fromEntries(Object.entries(options).filter(([, value]) => value !== void 0))
  });
  return { geometry, material: parse(MaterialSchema, structuredClone(preset.material)) };
}

// ../model-forge/src/kernel/application/placement.ts
var round4 = (value) => Math.round(value * 1e4) / 1e4 + 0;
var point = (x, z13) => [round4(x), round4(z13)];
function budget(count, what) {
  if (count > PROCEDURAL_MAX_CANDIDATES)
    fail(
      "PROCEDURAL_BUDGET",
      `${what} would generate about ${Math.ceil(count)} candidate points; the limit is ${PROCEDURAL_MAX_CANDIDATES}.`,
      {
        limit: PROCEDURAL_MAX_CANDIDATES,
        estimate: Math.ceil(count),
        hint: "Increase the spacing (minDistance, step or spacing) or shrink the area."
      }
    );
}
function areaBounds(area) {
  if (area.type === "rect") return { min: [...area.min], max: [...area.max] };
  if (area.type === "circle") {
    const [x, z13] = area.center;
    return { min: [x - area.radius, z13 - area.radius], max: [x + area.radius, z13 + area.radius] };
  }
  const pad = area.type === "path" ? area.width / 2 : 0;
  const xs = area.points.map((p) => p[0]), zs = area.points.map((p) => p[1]);
  return {
    min: [Math.min(...xs) - pad, Math.min(...zs) - pad],
    max: [Math.max(...xs) + pad, Math.max(...zs) + pad]
  };
}
function segmentDistance2(p, a, b) {
  const dx = b[0] - a[0], dz = b[1] - a[1], length2 = dx * dx + dz * dz;
  let t = length2 > 0 ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / length2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const ex = p[0] - (a[0] + t * dx), ez = p[1] - (a[1] + t * dz);
  return ex * ex + ez * ez;
}
function insideArea(area, p) {
  switch (area.type) {
    case "rect":
      return p[0] >= area.min[0] && p[0] <= area.max[0] && p[1] >= area.min[1] && p[1] <= area.max[1];
    case "circle": {
      const dx = p[0] - area.center[0], dz = p[1] - area.center[1];
      return dx * dx + dz * dz <= area.radius * area.radius;
    }
    case "polygon": {
      let inside2 = false;
      const points = area.points;
      for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const [xi, zi] = points[i], [xj, zj] = points[j];
        if (zi > p[1] !== zj > p[1] && p[0] < (xj - xi) * (p[1] - zi) / (zj - zi) + xi)
          inside2 = !inside2;
      }
      return inside2;
    }
    case "path": {
      const limit = area.width / 2 * (area.width / 2);
      for (let i = 1; i < area.points.length; i++)
        if (segmentDistance2(p, area.points[i - 1], area.points[i]) <= limit) return true;
      return false;
    }
  }
}
var insideBounds = (bounds, p) => p[0] >= bounds.min[0] && p[0] <= bounds.max[0] && p[1] >= bounds.min[1] && p[1] <= bounds.max[1];
function poissonDisk(bounds, minDistance, random) {
  const width = bounds.max[0] - bounds.min[0], depth = bounds.max[1] - bounds.min[1], r = minDistance, r2 = r * r;
  budget(0.6 * (width * depth) / r2, "Poisson sampling");
  const cell = r / Math.SQRT2, columns = Math.floor(width / cell) + 1, rows = Math.floor(depth / cell) + 1;
  if (!(columns * rows <= Number.MAX_SAFE_INTEGER))
    fail("PROCEDURAL_BUDGET", "Poisson sampling bounds are too large for the spacing.", {
      limit: PROCEDURAL_MAX_CANDIDATES,
      hint: "Increase the spacing (minDistance) or shrink the area."
    });
  const grid = /* @__PURE__ */ new Map();
  const points = [], active = [];
  const cellOf = (p) => [
    Math.min(columns - 1, Math.floor((p[0] - bounds.min[0]) / cell)),
    Math.min(rows - 1, Math.floor((p[1] - bounds.min[1]) / cell))
  ];
  const free = (p) => {
    const [cx, cz] = cellOf(p);
    for (let z13 = Math.max(0, cz - 2); z13 <= Math.min(rows - 1, cz + 2); z13++)
      for (let x = Math.max(0, cx - 2); x <= Math.min(columns - 1, cx + 2); x++) {
        const index = grid.get(z13 * columns + x);
        if (index === void 0) continue;
        const dx = points[index][0] - p[0], dz = points[index][1] - p[1];
        if (dx * dx + dz * dz < r2) return false;
      }
    return true;
  };
  const add = (p) => {
    budget(points.length + 1, "Poisson sampling");
    const [cx, cz] = cellOf(p);
    grid.set(cz * columns + cx, points.length);
    active.push(points.length);
    points.push(p);
  };
  add(point(bounds.min[0] + random.next() * width, bounds.min[1] + random.next() * depth));
  while (active.length) {
    const slot = Math.floor(random.next() * active.length), origin = points[active[slot]];
    let found = false;
    for (let attempt = 0; attempt < 30 && !found; attempt++) {
      for (let tries = 0; tries < 32; tries++) {
        const dx = (random.next() * 4 - 2) * r, dz = (random.next() * 4 - 2) * r, d2 = dx * dx + dz * dz;
        if (d2 < r2 || d2 > 4 * r2) continue;
        const candidate = point(origin[0] + dx, origin[1] + dz);
        if (insideBounds(bounds, candidate) && free(candidate)) {
          add(candidate);
          found = true;
        }
        break;
      }
    }
    if (!found) {
      active[slot] = active[active.length - 1];
      active.pop();
    }
  }
  return points;
}
function gridLayout(bounds, step, jitter, random) {
  const width = bounds.max[0] - bounds.min[0], depth = bounds.max[1] - bounds.min[1];
  const columns = Math.floor(width / step + 1e-9) + 1, rows = Math.floor(depth / step + 1e-9) + 1;
  budget(columns * rows, "Grid layout");
  const startX = bounds.min[0] + (width - (columns - 1) * step) / 2, startZ = bounds.min[1] + (depth - (rows - 1) * step) / 2;
  const points = [];
  for (let z13 = 0; z13 < rows; z13++)
    for (let x = 0; x < columns; x++) {
      const ox = jitter > 0 ? (random.next() - 0.5) * jitter * step : 0, oz = jitter > 0 ? (random.next() - 0.5) * jitter * step : 0;
      points.push(point(startX + x * step + ox, startZ + z13 * step + oz));
    }
  return points;
}
function gridArea(columns, rows, step, center = [0, 0]) {
  const half = (count) => Math.floor(((count - 1) * step / 2 + step * 0.4999) * 1e4 + 1e-6);
  const [cx, cz] = center.map((v) => Math.round(v * 1e4));
  const at2 = (units) => units / 1e4 + 0;
  return {
    type: "rect",
    min: [at2(cx - half(columns)), at2(cz - half(rows))],
    max: [at2(cx + half(columns)), at2(cz + half(rows))]
  };
}
function pathLayout(points, spacing) {
  const segments2 = [];
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i][0] - points[i - 1][0], dz = points[i][1] - points[i - 1][1], length = Math.sqrt(dx * dx + dz * dz);
    if (length > 1e-9) segments2.push({ a: points[i - 1], dx, dz, length });
    total += length;
  }
  if (!segments2.length) return [{ point: point(points[0][0], points[0][1]), heading: 0 }];
  const count = Math.floor(total / spacing + 1e-9) + 1;
  budget(count, "Path layout");
  const result = [];
  let segment = 0, start = 0;
  for (let k = 0; k < count; k++) {
    const distance = Math.min(total, k * spacing);
    while (segment < segments2.length - 1 && distance > start + segments2[segment].length) {
      start += segments2[segment].length;
      segment++;
    }
    const s = segments2[segment], t = Math.min(1, (distance - start) / s.length);
    result.push({
      point: point(s.a[0] + t * s.dx, s.a[1] + t * s.dz),
      heading: round4(Math.atan2(s.dx, s.dz) * 180 / Math.PI)
    });
  }
  return result;
}
function uniformRandom(area, count, random) {
  const bounds = areaBounds(area), width = bounds.max[0] - bounds.min[0], depth = bounds.max[1] - bounds.min[1];
  const points = [];
  let inside2 = 0;
  const attempts = Math.min(count * 64, PROCEDURAL_MAX_CANDIDATES);
  for (let attempt = 0; attempt < attempts && inside2 < count; attempt++) {
    const p = point(bounds.min[0] + random.next() * width, bounds.min[1] + random.next() * depth);
    points.push(p);
    if (insideArea(area, p)) inside2++;
  }
  return { points, inside: inside2 };
}

// ../model-forge/src/kernel/application/scatter.ts
import { Box3 as Box36, Matrix4 as Matrix42, Vector3 as Vector312 } from "three";

// ../model-forge/src/kernel/application/scatter-items.ts
function scatterSources(scene, models, recipe) {
  return recipe.items.map((item, index) => {
    let target;
    let template;
    if (item.model !== void 0) {
      if (!Object.hasOwn(models, item.model))
        fail("REFERENCE_MISSING", `Scatter item ${index} uses unregistered model ${item.model}.`, {
          item: index,
          hint: "Register or import the model first, or use a node template item."
        });
      target = models[item.model];
    } else {
      template = scene.nodes.find((n) => n.id === item.node);
      if (!template)
        fail("REFERENCE_MISSING", `Scatter item ${index} copies missing node ${item.node}.`, {
          item: index
        });
      if (template.type !== "mesh" && template.type !== "model")
        fail("INVALID_NODE_TYPE", `Template ${template.id} must be a mesh or model node.`, {
          item: index
        });
      if (scene.nodes.some((n) => n.parent === template.id))
        fail("INVALID_NODE_TYPE", `Template ${template.id} has children and cannot be copied.`, {
          item: index,
          hint: "Capture the assembly as a model and scatter model instances instead."
        });
      if (template.type === "model") target = models[template.model];
    }
    const vary = Object.keys(item.vary).sort().map((name) => {
      if (!target)
        fail("UNKNOWN_PARAMETER", `Scatter item ${index} varies ${name}, but it is a mesh.`, {
          item: index,
          hint: "vary applies to model parameters; remove it from mesh templates."
        });
      const declared = target.parameters[name];
      if (!declared)
        fail("UNKNOWN_PARAMETER", `Model ${target.id} has no parameter ${name}.`, {
          item: index
        });
      let [min, max] = item.vary[name];
      if (declared.min !== void 0 && min < declared.min || declared.max !== void 0 && max > declared.max)
        fail("PARAMETER_RANGE", `vary.${name} must stay inside ${target.id}.${name}'s range.`, {
          item: index,
          vary: [min, max],
          min: declared.min,
          max: declared.max
        });
      if (declared.integer) {
        [min, max] = [Math.ceil(min), Math.floor(max)];
        if (min > max)
          fail("PARAMETER_RANGE", `vary.${name} contains no whole number.`, { item: index });
      }
      return [name, min, max, declared.integer === true];
    });
    return { weight: item.weight, model: item.model, template, vary };
  });
}
function transformOf(draw, baseScale) {
  const rotation2 = [draw.tilt[0], draw.yaw, draw.tilt[1]].map(round4);
  const scale = baseScale.map((v) => round4(v * draw.scale));
  return {
    position: draw.position.map(round4),
    ...rotation2.some((v) => v !== 0) ? { rotation: rotation2 } : {},
    ...scale.some((v) => v !== 1) ? { scale } : {}
  };
}
function instanceNode(scene, source, id, group, tag, draw, random) {
  const parameters = Object.fromEntries(
    source.vary.map(([name, min, max, integer2]) => {
      const value = random.range(min, max);
      return [name, integer2 ? Math.min(max, Math.round(value)) : round4(value)];
    })
  );
  if (source.model !== void 0)
    return {
      id,
      type: "model",
      model: source.model,
      parent: group,
      tags: [tag],
      transform: transformOf(draw, [1, 1, 1]),
      ...source.vary.length ? { parameters } : {}
    };
  const template = structuredClone(source.template);
  const base = resolveData(template.transform?.scale ?? [1, 1, 1], scene.parameters);
  return {
    ...template,
    id,
    parent: group,
    visible: true,
    tags: [...template.tags.filter((t) => t !== tag), tag].slice(-32),
    transform: transformOf(draw, base),
    ...template.type === "model" ? { parameters: { ...template.parameters, ...parameters } } : {}
  };
}

// ../model-forge/src/kernel/application/scatter.ts
var MAX_NODES = 1e4;
function candidates(recipe, random) {
  const d = recipe.distribution;
  if (d.type === "path")
    return pathLayout(d.points, d.spacing).map(({ point: point2, heading }) => ({
      point: point2,
      heading: d.orient === "yaw" ? heading : void 0
    }));
  const area = recipe.area;
  if (d.type === "random")
    return uniformRandom(area, d.count, random).points.map((point2) => ({ point: point2 }));
  const bounds = areaBounds(area);
  const points = d.type === "poisson" ? poissonDisk(bounds, d.minDistance, random) : gridLayout(bounds, d.step, d.jitter, random);
  return points.map((point2) => ({ point: point2 }));
}
function footprints(scene, models, recipe) {
  if (!recipe.avoidNodes) return [];
  const { ids, margin } = recipe.avoidNodes;
  for (const id of ids)
    if (!scene.nodes.some((n) => n.id === id))
      fail("REFERENCE_MISSING", `avoidNodes names missing node ${id}.`, { node: id });
  const built = compileScene(scene, models, { bindRigs: false });
  try {
    const frame = recipe.parent ? built.content.getObjectByName(`${scene.id}/${recipe.parent}`) : built.content;
    const toFrame = new Matrix42().copy(frame.matrixWorld).invert();
    return ids.map((id) => {
      const object = built.content.getObjectByName(`${scene.id}/${id}`);
      const box = new Box36().setFromObject(object);
      if (box.isEmpty()) box.setFromPoints([object.getWorldPosition(new Vector312())]);
      const corners = [0, 1, 2, 3, 4, 5, 6, 7].map(
        (i) => new Vector312(
          i & 1 ? box.max.x : box.min.x,
          i & 2 ? box.max.y : box.min.y,
          i & 4 ? box.max.z : box.min.z
        ).applyMatrix4(toFrame)
      );
      const xs = corners.map((c) => c.x), zs = corners.map((c) => c.z);
      return {
        min: [Math.min(...xs) - margin, Math.min(...zs) - margin],
        max: [Math.max(...xs) + margin, Math.max(...zs) + margin]
      };
    });
  } finally {
    built.dispose();
  }
}
function grounding(scene, recipe) {
  const ground = recipe.ground;
  if (ground.mode === "none") return () => 0;
  if (ground.mode === "plane") return () => ground.y;
  const sample = terrainSampler(scene, ground.node, recipe.parent);
  const steepest = ground.maxSlope >= 90 ? -Infinity : Math.cos(ground.maxSlope * Math.PI / 180);
  return ([x, z13]) => {
    const hit = sample(x, z13);
    if (!hit.inside) return "outside";
    if (hit.normal[1] < steepest - 1e-12) return "slope";
    return hit.y - ground.sink;
  };
}
function subset(total, count, random) {
  const indices = Array.from({ length: total }, (_, i) => i);
  for (let i = 0; i < count; i++) {
    const j = random.int(i, total - 1);
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices.slice(0, count).sort((a, b) => a - b);
}
function planScatter(scene, models, input, options = {}) {
  const recipe = parse(ScatterRecipeSchema, input);
  const recipeHash = sha256Hex(canonical(recipe));
  const tag = `scatter:${recipeHash.slice(0, 8)}`;
  const current = scene.nodes.find((n) => n.id === recipe.group);
  const existing = !!current;
  if (current && (!options.replace || !current.tags?.includes("scatter")))
    fail(
      "DUPLICATE_ID",
      options.replace ? `Node ${recipe.group} exists but is not a scatter group, so it cannot be replaced.` : `Node ${recipe.group} already exists.`,
      {
        id: recipe.group,
        ...options.replace ? { type: current.type, tags: current.tags ?? [] } : {},
        hint: options.replace ? "Choose another group ID (--group); replace only removes a group tagged scatter that an earlier scatter or layout created." : "Choose another group ID, or replace the existing scatter group (replace: true / --replace) with the write guards."
      }
    );
  const removed = existing ? subtreeIds(scene, recipe.group) : /* @__PURE__ */ new Set();
  const working = { ...scene, nodes: scene.nodes.filter((n) => !removed.has(n.id)) };
  if (recipe.parent && !working.nodes.some((n) => n.id === recipe.parent))
    fail("REFERENCE_MISSING", `Scatter parent ${recipe.parent} does not exist.`);
  const sources2 = scatterSources(working, models, recipe);
  const ground = grounding(working, recipe);
  const avoid = footprints(working, models, recipe);
  const root = createRandom(recipe.seed, "scatter");
  const pool = candidates(recipe, root.fork("distribution"));
  const rejected = { outside: 0, exclusion: 0, slope: 0, budget: 0 };
  const accepted = [];
  for (const [index, candidate] of pool.entries()) {
    const p = candidate.point;
    if (recipe.area && !insideArea(recipe.area, p)) {
      rejected.outside++;
      continue;
    }
    if (recipe.exclude.some((area) => insideArea(area, p)) || avoid.some((b) => insideBounds(b, p))) {
      rejected.exclusion++;
      continue;
    }
    const y = ground(p);
    if (y === "outside" || y === "slope") {
      rejected[y]++;
      continue;
    }
    accepted.push({ index, candidate, y });
  }
  const kept = accepted.length > recipe.maxCount ? subset(accepted.length, recipe.maxCount, root.fork("budget")).map((i) => accepted[i]) : accepted;
  rejected.budget = accepted.length - kept.length;
  if (!kept.length && !options.allowEmpty)
    fail("SCATTER_EMPTY", "The scatter placed nothing.", {
      candidates: pool.length,
      rejected,
      hint: "Read details.rejected: widen the area, lower minDistance or step, relax exclude/avoidNodes margin or ground.maxSlope, or pass allowEmpty to accept an empty group."
    });
  if (working.nodes.length + 1 + kept.length > MAX_NODES)
    fail("PROCEDURAL_BUDGET", `The scatter would exceed ${MAX_NODES} document nodes.`, {
      limit: MAX_NODES,
      existing: working.nodes.length,
      placements: kept.length,
      hint: "Lower maxCount or scatter into a separate model."
    });
  const taken = new Set(working.nodes.map((n) => n.id));
  const nodes2 = kept.map(({ index, candidate, y }, n) => {
    const id = `${recipe.group}-${n + 1}`;
    if (taken.has(id))
      fail("DUPLICATE_ID", `Placement ID ${id} is already used by another node.`, {
        id,
        hint: "Choose a group ID whose <group>-<n> instance IDs are free."
      });
    const random = root.fork(`c${index}`);
    const source = random.pick(
      sources2,
      sources2.map((s) => s.weight)
    );
    const scale = random.range(recipe.scale[0], recipe.scale[1]);
    const yawRange = recipe.rotation.yaw ?? (candidate.heading !== void 0 ? [0, 0] : [0, 360]);
    const yaw = (candidate.heading ?? 0) + random.range(yawRange[0], yawRange[1]);
    const tilt = [
      random.range(recipe.rotation.tilt[0], recipe.rotation.tilt[1]),
      random.range(recipe.rotation.tilt[0], recipe.rotation.tilt[1])
    ];
    const position = [candidate.point[0], y, candidate.point[1]];
    return instanceNode(
      working,
      source,
      id,
      recipe.group,
      tag,
      { position, yaw, tilt, scale },
      random
    );
  });
  const group = {
    id: recipe.group,
    type: "group",
    ...recipe.parent ? { parent: recipe.parent } : {},
    tags: ["scatter", tag]
  };
  const operations = [
    ...existing ? [{ op: "removeNode", id: recipe.group, cascade: true }] : [],
    { op: "putNode", node: group },
    ...nodes2.map((node) => ({ op: "putNode", node }))
  ].map((operation) => parse(OperationSchema, operation));
  return {
    recipe,
    operations,
    placement: {
      seed: recipe.seed,
      recipeHash,
      group: recipe.group,
      placed: kept.length,
      candidates: pool.length,
      rejected
    }
  };
}

// ../model-forge/src/kernel/io/files.ts
import { promises as fs, createReadStream } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
async function readJson(file) {
  try {
    const chunks = [];
    let bytes = 0;
    for await (const chunk2 of createReadStream(file)) {
      bytes += chunk2.length;
      if (bytes > 16 * 1024 * 1024) fail("INPUT_TOO_LARGE", `JSON file exceeds 16 MiB: ${file}`);
      chunks.push(chunk2);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch (error) {
    if (error instanceof ForgeError) throw error;
    if (errorCode(error) === "ENOENT") fail("NOT_FOUND", `File does not exist: ${file}`);
    fail("JSON_READ_FAILED", `Cannot read JSON file ${file}.`, { reason: errorMessage(error) });
  }
}
async function atomicWrite(file, data) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${randomUUID()}.tmp`;
  try {
    await fs.writeFile(tmp, data, { flag: "wx" });
    await fs.rename(tmp, file);
  } finally {
    await fs.rm(tmp, { force: true });
  }
}
var writeJson = (file, value) => atomicWrite(file, JSON.stringify(value, null, 2) + "\n");

// ../model-forge/src/kernel/io/state-hash.ts
import { createHash } from "node:crypto";
var stateHash = (scene, models) => createHash("sha256").update(canonical({ scene, models })).digest("hex");
var modelStateHash = (model, dependencies) => createHash("sha256").update(canonical({ model, dependencies })).digest("hex");

// ../model-forge/src/kernel/io/export-textures.ts
import { deflateSync } from "node:zlib";
import { DataTexture as DataTexture2, RGBAFormat as RGBAFormat2 } from "three";
function crc32(bytes) {
  let crc = 4294967295;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = crc >>> 1 ^ (crc & 1 ? 3988292384 : 0);
  }
  return (crc ^ 4294967295) >>> 0;
}
function chunk(name, bytes) {
  const body = Buffer.concat([Buffer.from(name), bytes]);
  const header = Buffer.alloc(4), tail = Buffer.alloc(4);
  header.writeUInt32BE(bytes.length);
  tail.writeUInt32BE(crc32(body));
  return Buffer.concat([header, body, tail]);
}
function png(image, flipY) {
  const { width, height: height2, data } = image;
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height2, 4);
  header[8] = 8;
  header[9] = 6;
  const rows = Buffer.alloc(height2 * (width * 4 + 1));
  for (let y = 0; y < height2; y++) {
    const sourceY = flipY ? height2 - y - 1 : y;
    rows.set(
      data.subarray(sourceY * width * 4, (sourceY + 1) * width * 4),
      y * (width * 4 + 1) + 1
    );
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(rows, { level: 9 })),
    chunk("IEND", new Uint8Array())
  ]);
}
function installTextureExport(exporter) {
  exporter.register((writer) => {
    const target = writer;
    const cache = /* @__PURE__ */ new Map();
    target.buildNormalMapTextureAsync = async (map, flipX, flipY) => {
      if (!(map instanceof DataTexture2) || !(map.image.data instanceof Uint8Array) || map.image.width !== 128 || map.image.height !== 128)
        fail(
          "EXPORT_INVALID",
          "Normal texture conversion requires compiler-generated surface data."
        );
      const pixels = new Uint8Array(map.image.data);
      for (let i = 0; i < pixels.length; i += 4) {
        if (flipX) pixels[i] = 255 - pixels[i];
        if (flipY) pixels[i + 1] = 255 - pixels[i + 1];
      }
      const converted = map.clone();
      converted.source = new DataTexture2(pixels, 128, 128).source;
      return converted;
    };
    target.processImage = (input, format, flipY) => {
      const found = cache.get(input)?.get(flipY);
      if (found !== void 0) return found;
      const image = input;
      if (!image || format !== RGBAFormat2 || !(image.data instanceof Uint8Array) || image.width !== 128 || image.height !== 128 || image.data.length !== 128 * 128 * 4)
        fail(
          "EXPORT_INVALID",
          "Texture export requires compiler-generated 128\xD7128 RGBA surface data."
        );
      const encoded = png(image, flipY);
      const definition = {
        mimeType: "image/png"
      };
      if (target.options.binary) {
        target.pending.push(
          target.processBufferViewImage(new Blob([new Uint8Array(encoded)], { type: "image/png" })).then((index2) => {
            definition.bufferView = index2;
          })
        );
      } else definition.uri = `data:image/png;base64,${encoded.toString("base64")}`;
      const index = (target.json.images ??= []).push(definition) - 1;
      if (!cache.has(input)) cache.set(input, /* @__PURE__ */ new Map());
      cache.get(input).set(flipY, index);
      return index;
    };
    return {};
  });
  return exporter;
}

// ../model-forge/src/kernel/io/blob-reader.ts
var BlobReader = class {
  result = null;
  onloadend = null;
  onerror = null;
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((value) => {
      this.result = value;
      this.onloadend?.();
    }).catch((error) => this.onerror?.(error));
  }
  readAsDataURL(blob) {
    blob.arrayBuffer().then((value) => {
      this.result = `data:${blob.type};base64,${Buffer.from(value).toString("base64")}`;
      this.onloadend?.();
    }).catch((error) => this.onerror?.(error));
  }
};
function installBlobReader() {
  if (!globalThis.FileReader)
    Object.defineProperty(globalThis, "FileReader", {
      value: BlobReader,
      configurable: true,
      writable: true
    });
}

// ../model-forge/src/kernel/io/export.ts
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { OBJExporter } from "three/addons/exporters/OBJExporter.js";
import { STLExporter } from "three/addons/exporters/STLExporter.js";
import { Box3 as Box37, Vector3 as Vector313, Mesh as Mesh6 } from "three";
var exportFormats = ["glb", "gltf", "obj", "stl", "three"];
async function validateExport(data, format) {
  if (format !== "glb" && format !== "gltf")
    fail("INVALID_OPTION", "Export validation is available for glb and gltf only.");
  const { validateBytes } = await import("gltf-validator");
  const report = await validateBytes(typeof data === "string" ? Buffer.from(data) : data, {
    maxIssues: 100
  });
  return { validator: "Khronos glTF-Validator", ...report.issues };
}
async function exportScene(document2, models, format, nodeId) {
  if (nodeId) document2 = authoringTarget(document2, models, { node: nodeId });
  const built = compileScene(document2, models);
  try {
    const hidden = [];
    built.scene.traverse((object) => {
      if (!object.visible) hidden.push(object);
    });
    if (nodeId && hidden.some(
      (object) => object.name === `${document2.id}/${nodeId}` || object.getObjectByName(`${document2.id}/${nodeId}`)
    ))
      fail("NODE_HIDDEN", `Node ${nodeId} is hidden by itself or an ancestor.`);
    hidden.forEach((object) => object.removeFromParent());
    const bounds = new Box37().setFromObject(built.scene);
    const usedMaterials = /* @__PURE__ */ new Set();
    const usedGeometries = /* @__PURE__ */ new Set();
    let nodes2 = 0, meshes = 0, triangles2 = 0;
    built.scene.traverse((object) => {
      if (object.userData.forgeId) nodes2++;
      if (object instanceof Mesh6) {
        usedGeometries.add(object.geometry);
        meshes++;
        triangles2 += (object.geometry.index?.count ?? object.geometry.getAttribute("position").count) / 3;
        (Array.isArray(object.material) ? object.material : [object.material]).forEach(
          (m) => usedMaterials.add(m)
        );
      }
    });
    const stats = {
      ...built.stats,
      nodes: nodes2,
      meshes,
      triangles: triangles2,
      materials: usedMaterials.size,
      geometries: usedGeometries.size,
      bounds: {
        min: bounds.isEmpty() ? [0, 0, 0] : bounds.min.toArray(),
        max: bounds.isEmpty() ? [0, 0, 0] : bounds.max.toArray(),
        size: bounds.isEmpty() ? [0, 0, 0] : bounds.getSize(new Vector313()).toArray()
      }
    };
    let data;
    const warnings = [...built.stats.warnings];
    if (format === "glb" || format === "gltf") {
      installBlobReader();
      const portable = gltfScene(built.scene);
      const result = await installTextureExport(new GLTFExporter()).parseAsync(portable, {
        binary: format === "glb",
        onlyVisible: true,
        trs: false,
        animations: rigClips(portable)
      });
      data = format === "glb" ? new Uint8Array(result) : JSON.stringify(result, null, 2) + "\n";
    } else if (format === "obj") {
      data = new OBJExporter().parse(built.scene);
      warnings.push(
        "OBJ export contains geometry, normals and UVs only; materials are not exported. Use GLB to retain PBR materials."
      );
    } else if (format === "stl") {
      const view = new STLExporter().parse(built.scene, { binary: true });
      data = new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
      warnings.push(
        "STL stores triangles only: no hierarchy, materials or unit metadata. Coordinates are in meters."
      );
    } else data = JSON.stringify(built.scene.toJSON(), null, 2) + "\n";
    return { data, stats, warnings };
  } finally {
    built.dispose();
  }
}

// ../model-forge/src/kernel/io/littlewild.ts
import path2 from "node:path";
import { promises as fs2 } from "node:fs";

// ../model-forge/src/kernel/application/littlewild-preserve.ts
import * as THREE14 from "three";
var plain4 = (value) => !!value && typeof value === "object" && !Array.isArray(value);
var owned = /* @__PURE__ */ new Set([
  "primitive",
  "id",
  "position",
  "rotation",
  "scale",
  "material",
  "materialProps",
  "mesh",
  "visible",
  "children"
]);
var physical = {
  sheen: 0,
  sheenColor: "#000000",
  sheenRoughness: 1,
  clearcoat: 0,
  clearcoatRoughness: 0
};
var round2 = (value, step) => {
  const result = Math.round(value / step) * step;
  return Number((Object.is(result, -0) ? 0 : result).toFixed(Math.max(0, -Math.log10(step))));
};
function sameVector(previous, next, fallback) {
  const values = (value) => Array.isArray(value) && value.length === 3 && value.every((v) => typeof v === "number") ? value.map((v) => round2(v, 1e-5)) : value === void 0 ? [fallback, fallback, fallback] : null;
  const a = values(previous), b = values(next);
  return !!a && !!b && a.every((v, i) => v === b[i]);
}
function resolvedMaterial(table, key, props, mesh) {
  if (typeof key !== "string" || props !== void 0 && !plain4(props)) return null;
  const base = Object.hasOwn(table, key) ? table[key] : key;
  if (typeof base !== "string" && !plain4(base)) return null;
  const data = {
    roughness: 0.98,
    metalness: 0,
    opacity: 1,
    flatShading: !mesh,
    ...typeof base === "string" ? { color: base } : base,
    ...plain4(props) ? props : {}
  };
  delete data.transparent;
  if (data.depthWrite === true) delete data.depthWrite;
  if (data.doubleSided === false) delete data.doubleSided;
  if (data.emissive === void 0 || String(data.emissive).toLowerCase() === "#000000") {
    delete data.emissive;
    delete data.emissiveIntensity;
  }
  if (Object.keys(physical).some((field) => data[field] !== void 0))
    for (const [field, value] of Object.entries(physical)) data[field] ??= value;
  for (const [field, value] of Object.entries(data))
    if (typeof value === "number") data[field] = round2(value, 1e-3);
    else if (typeof value === "string" && value.startsWith("#")) data[field] = value.toLowerCase();
  return canonical(data);
}
function derivedBuffers(positions, indices) {
  const geometry = new THREE14.BufferGeometry();
  try {
    const position = new THREE14.Float32BufferAttribute(positions, 3);
    geometry.setAttribute("position", position);
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const normal = geometry.getAttribute("normal");
    return {
      normals: Array.from(normal.array, (v) => round2(v, 1e-3)),
      uvs: new THREE14.Float32BufferAttribute(sphereUVs(Array.from(position.array)), 2).array
    };
  } finally {
    geometry.dispose();
  }
}
function sameMesh(source, exported) {
  if (!plain4(source) || !plain4(exported) || !Array.isArray(source.positions)) return false;
  const positions = source.positions;
  const indices = Array.isArray(source.indices) ? source.indices : Array.from({ length: positions.length / 3 }, (_, i) => i);
  const derived = source.normals === void 0 || source.uvs === void 0 ? derivedBuffers(positions, indices) : void 0;
  const uvs = source.uvs === void 0 ? Array.from(derived.uvs, (v) => round2(v, 1e-5)) : source.uvs;
  const expected = {
    ...source,
    indices,
    normals: source.normals ?? derived.normals,
    uvs
  };
  return canonical(expected) === canonical(exported);
}
function preserveVariantNodes(exported, source, tables, kept) {
  const imported = importedNodeIds(source);
  const merge = (nodes2, previous) => {
    const byId = /* @__PURE__ */ new Map(), bySynthetic = /* @__PURE__ */ new Map();
    for (const node of previous)
      if (plain4(node) && typeof node.id === "string" && !byId.has(node.id)) byId.set(node.id, node);
    for (const node of previous)
      if (plain4(node) && node.id === void 0 && imported.has(node)) {
        const id = littlewildId(imported.get(node));
        if (!byId.has(id) && !bySynthetic.has(id)) bySynthetic.set(id, node);
      }
    return nodes2.map((node) => {
      const match = byId.get(node.id) ?? bySynthetic.get(node.id);
      return match && match.primitive === node.primitive ? mergeNode(node, match) : track(node);
    });
  };
  const track = (node) => {
    if (node.material) kept.exportedMaterialNodes.push(node);
    if (node.children) node.children = merge(node.children, []);
    return node;
  };
  const mergeNode = (node, source2) => {
    const result = {};
    const take = (field, fromSource) => {
      const value = fromSource ? source2[field] : node[field];
      if (value !== void 0) result[field] = value;
    };
    take("primitive", false);
    take("id", !Object.hasOwn(source2, "id") ? true : source2.id === node.id);
    for (const [field, fallback] of [
      ["position", 0],
      ["rotation", 0],
      ["scale", 1]
    ])
      take(field, sameVector(source2[field], node[field], fallback));
    take("visible", source2.visible === false === (node.visible === false));
    let exportedMaterial = false;
    if (node.primitive !== "group") {
      const mesh = node.primitive === "mesh";
      const before = resolvedMaterial(tables.previous, source2.material, source2.materialProps, mesh);
      if (before !== null && before === resolvedMaterial(tables.materials, node.material, void 0, mesh)) {
        take("material", true);
        take("materialProps", true);
        if (Object.hasOwn(tables.previous, String(source2.material)))
          kept.materials.add(String(source2.material));
      } else {
        take("material", false);
        exportedMaterial = true;
      }
    }
    if (node.primitive === "mesh") {
      const same2 = sameMesh(
        tables.previousMeshes[String(source2.mesh)],
        tables.meshes[String(node.mesh)]
      );
      take("mesh", same2);
      if (same2) kept.meshes.add(String(source2.mesh));
    }
    const children = merge(
      node.children ?? [],
      Array.isArray(source2.children) ? source2.children : []
    );
    if (children.length || Array.isArray(source2.children)) result.children = children;
    for (const [field, value] of Object.entries(source2))
      if (!owned.has(field)) result[field] = value;
    const ordered = {};
    for (const field of [...Object.keys(source2), ...Object.keys(result)])
      if (Object.hasOwn(result, field) && !Object.hasOwn(ordered, field))
        ordered[field] = result[field];
    if (exportedMaterial) kept.exportedMaterialNodes.push(ordered);
    return ordered;
  };
  return merge(exported, source);
}
function referencedResources(models) {
  const materials = /* @__PURE__ */ new Set(), meshes = /* @__PURE__ */ new Set();
  const walk = (nodes2) => {
    if (!Array.isArray(nodes2)) return;
    for (const node of nodes2)
      if (plain4(node)) {
        if (typeof node.material === "string") materials.add(node.material);
        if (typeof node.mesh === "string") meshes.add(node.mesh);
        walk(node.children);
      }
  };
  if (plain4(models)) {
    for (const model of Object.values(models)) if (plain4(model)) walk(model.nodes);
  }
  return { materials, meshes };
}
function inSourceOrder(value, source) {
  if (!plain4(source)) return value;
  const ordered = {};
  for (const key of [...Object.keys(source), ...Object.keys(value)])
    if (Object.hasOwn(value, key) && !Object.hasOwn(ordered, key)) ordered[key] = value[key];
  return ordered;
}
function preserveExported(previous, exported, materials, meshes) {
  const sourceModels = plain4(previous.models) ? previous.models : {}, previousMaterials = plain4(previous.materials) ? previous.materials : {}, previousMeshes = plain4(previous.meshes) ? previous.meshes : {};
  const kept = {
    materials: /* @__PURE__ */ new Set(),
    meshes: /* @__PURE__ */ new Set(),
    exportedMaterialNodes: []
  };
  const exportedMaterials = { ...materials };
  for (const [variant, model] of Object.entries(exported)) {
    const source = sourceModels[variant];
    model.nodes = preserveVariantNodes(
      model.nodes,
      plain4(source) && Array.isArray(source.nodes) ? source.nodes : [],
      { previous: previousMaterials, previousMeshes, materials: exportedMaterials, meshes },
      kept
    );
  }
  const table = {};
  for (const key of kept.materials) table[key] = previousMaterials[key];
  const names = /* @__PURE__ */ new Map();
  for (const node of kept.exportedMaterialNodes) {
    const role = node.material, mesh = node.primitive === "mesh";
    const meaning = resolvedMaterial(exportedMaterials, role, void 0, mesh);
    let name = names.get(role) ?? role;
    for (let n = 2; Object.hasOwn(table, name) && canonical(table[name]) !== canonical(exportedMaterials[role]) && resolvedMaterial(table, name, void 0, mesh) !== meaning; n++)
      name = `${role.slice(0, 76)}-${n}`;
    names.set(role, name);
    table[name] ??= exportedMaterials[role];
    node.material = name;
  }
  for (const key of Object.keys(materials)) delete materials[key];
  Object.assign(materials, table);
  for (const id of kept.meshes) meshes[id] = previousMeshes[id];
}
function preserveTables(visual, previous) {
  const used = referencedResources(previous.models);
  const extras = (field, references) => {
    const source = plain4(previous[field]) ? previous[field] : {}, current = plain4(visual[field]) ? { ...visual[field] } : {};
    for (const [key, value] of Object.entries(source))
      if (!references.has(key) && !Object.hasOwn(current, key)) current[key] = value;
    return Object.keys(current).length ? inSourceOrder(current, source) : void 0;
  };
  const materials = extras("materials", used.materials), meshes = extras("meshes", used.meshes);
  return inSourceOrder(
    { ...visual, materials: materials ?? {}, ...meshes ? { meshes } : {} },
    previous
  );
}

// ../model-forge/src/kernel/io/littlewild.ts
var plain5 = (value) => !!value && typeof value === "object" && !Array.isArray(value);
function definitionText(value) {
  return JSON.stringify(value, null, 2).replace(
    /\[\s+(-?[\d.e+-]+(?:,\s+-?[\d.e+-]+)*)\s+\]/g,
    (_, body) => `[${String(body).replace(/,\s+/g, ", ")}]`
  ) + "\n";
}
var plainText = (value) => JSON.stringify(value, null, 2) + "\n";
var asciiText = (value) => plainText(value).replace(
  /[\u0080-\uffff]/g,
  (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`
);
var sourceLayouts = [definitionText, plainText, asciiText];
function renameMaterials(nodes2, names, field = "material") {
  for (const node of nodes2) {
    if (node[field] && names.has(node[field])) node[field] = names.get(node[field]);
    if (node.children) renameMaterials(node.children, names, field);
  }
}
function collect(nodes2, key, into) {
  for (const node of nodes2) {
    if (!plain5(node)) continue;
    if (typeof node[key] === "string") into.add(node[key]);
    if (Array.isArray(node.children)) collect(node.children, key, into);
  }
  return into;
}
function littlewildVisual(asset, models, existing) {
  const category = littlewildFamilies[asset.family], previous = plain5(existing?.visual) ? existing.visual : {}, previousModels = plain5(previous.models) ? previous.models : {}, previousMaterials = plain5(previous.materials) ? previous.materials : {}, previousMeshes = plain5(previous.meshes) ? previous.meshes : {};
  const materials = {}, meshes = {}, exported = {}, rig = {}, report = [], warnings = /* @__PURE__ */ new Set();
  for (const [variant, spec] of Object.entries(asset.models)) {
    const model = models[spec.model];
    if (!model) fail("NOT_FOUND", `Model ${spec.model} does not exist.`);
    for (const key of Object.keys(spec.materials))
      if (!Object.hasOwn(model.materials, key))
        fail("LITTLEWILD_EXPORT", `Model ${spec.model} has no material ${key} to replace.`);
    const scene = parse(SceneSchema, {
      schemaVersion: 1,
      kind: "scene",
      id: "littlewild",
      name: asset.name,
      materials: spec.materials,
      nodes: [
        {
          type: "model",
          id: "asset",
          model: spec.model,
          parameters: spec.parameters,
          materialOverrides: Object.fromEntries(Object.keys(spec.materials).map((k) => [k, k]))
        }
      ]
    });
    const built = compileScene(scene, models, { bindRigs: false });
    try {
      const root = built.content.children[0];
      const result2 = littlewildModel(root, { rig: asset.family === "pets" });
      const names = /* @__PURE__ */ new Map();
      for (const [role, data] of Object.entries(result2.materials)) {
        let name = role;
        if (materials[name] && JSON.stringify(materials[name]) !== JSON.stringify(data))
          name = `${role}-${variant}`.slice(0, 80);
        materials[name] = data;
        if (name !== role) names.set(role, name);
      }
      renameMaterials(result2.nodes, names);
      const meshNames = /* @__PURE__ */ new Map();
      for (const [id, data] of Object.entries(result2.meshes)) {
        let name = id, suffix = 1;
        while (Object.hasOwn(meshes, name) && canonical(meshes[name]) !== canonical(data) || Object.hasOwn(previousMeshes, name) && canonical(previousMeshes[name]) !== canonical(data))
          name = `${id.slice(0, 64)}-${suffix++}`;
        meshes[name] = data;
        if (name !== id) meshNames.set(id, name);
      }
      renameMaterials(result2.nodes, meshNames, "mesh");
      exported[variant] = { nodes: result2.nodes };
      if (Object.keys(result2.rig).length) rig[variant] = result2.rig;
      result2.warnings.forEach((w) => warnings.add(w));
      report.push({ variant, model: spec.model, ...result2.stats });
    } finally {
      built.dispose();
    }
  }
  if (existing) preserveExported(previous, exported, materials, meshes);
  const finalModels = structuredClone({ ...previousModels, ...exported });
  for (const [name, model] of Object.entries(previousModels)) {
    if (Object.hasOwn(exported, name) || !plain5(model) || !Array.isArray(model.nodes)) continue;
    for (const role of collect(model.nodes, "material", /* @__PURE__ */ new Set()))
      if (Object.hasOwn(previousMaterials, role)) {
        if (materials[role] && JSON.stringify(materials[role]) !== JSON.stringify(previousMaterials[role]))
          warnings.add(`Retained variant ${name} now uses the re-exported material ${role}.`);
        else materials[role] ??= previousMaterials[role];
      }
    for (const id of collect(model.nodes, "mesh", /* @__PURE__ */ new Set()))
      if (Object.hasOwn(previousMeshes, id)) meshes[id] ??= previousMeshes[id];
  }
  const finalMeshes = reuseLittlewildMeshes(finalModels, meshes, Object.keys(previousMeshes));
  const vertices = Object.values(finalMeshes).reduce(
    (sum, mesh) => sum + (plain5(mesh) && Array.isArray(mesh.positions) ? mesh.positions.length / 3 : 0),
    0
  );
  if (vertices > littlewildLimits.definitionVertices)
    fail(
      "LITTLEWILD_BUDGET",
      `${asset.id} bakes ${vertices} vertices; Littlewild allows ${littlewildLimits.definitionVertices}.`
    );
  const previousRig = asset.family === "pets" && plain5(previous.rig) ? previous.rig : {};
  const finalRig = asset.family === "pets" ? Object.fromEntries(
    Object.entries({ ...previousRig, ...rig }).filter(
      ([name]) => Object.hasOwn(finalModels, name) && (Object.hasOwn(rig, name) || !Object.hasOwn(exported, name))
    )
  ) : previous.rig;
  const metadata = {
    ...plain5(previous.metadata) ? previous.metadata : {},
    ...asset.metadata
  };
  const visual = {
    format: "littlewild-3d-asset",
    schemaVersion: 1,
    category,
    id: asset.id,
    name: asset.name,
    materials,
    models: finalModels,
    metadata,
    ...previous.behaviors === void 0 ? {} : { behaviors: previous.behaviors },
    ...finalRig === void 0 || plain5(finalRig) && !Object.keys(finalRig).length ? {} : { rig: finalRig },
    ...Object.keys(finalMeshes).length ? { meshes: finalMeshes } : {}
  };
  const result = existing ? preserveTables(visual, previous) : visual;
  assertLittlewildComplexity(result);
  const referenced = referencedResources(result.models).meshes;
  const unused = Object.keys(plain5(result.meshes) ? result.meshes : {}).filter(
    (id) => !referenced.has(id)
  );
  if (unused.length)
    warnings.add(
      `Kept ${unused.length} source mesh${unused.length === 1 ? "" : "es"} that no variant references: ${unused.join(", ")}. Delete them from the definition by hand if nothing else needs them.`
    );
  return { visual: result, report, warnings: [...warnings] };
}
async function readDefinition(file) {
  try {
    await fs2.access(file);
  } catch (error) {
    if (errorCode(error) === "ENOENT") return void 0;
    throw error;
  }
  const value = await readJson(file);
  if (!plain5(value)) fail("LITTLEWILD_EXPORT", `${file} is not a Littlewild definition.`);
  return value;
}
async function littlewildExportIdentity(file, options) {
  const directory = path2.basename(path2.dirname(path2.dirname(file)));
  const family = options.family ?? (Object.hasOwn(littlewildFamilies, directory) ? directory : "items");
  const existing = await readDefinition(file);
  const previousName = plain5(existing?.visual) ? existing.visual.name : void 0;
  const name = options.name ?? (typeof previousName === "string" && existing?.family === family ? previousName : options.fallbackName);
  return { id: path2.basename(path2.dirname(file)), family, name };
}
async function writeLittlewildAsset(asset, models, file, options = {}) {
  const existing = await readDefinition(file);
  let previousText;
  try {
    previousText = await fs2.readFile(file, "utf8");
  } catch {
    previousText = void 0;
  }
  if (existing && (existing.format !== "littlewild-definition" || existing.family !== asset.family || existing.id !== asset.id))
    fail(
      "LITTLEWILD_EXPORT",
      `${file} belongs to ${String(existing.family)}/${String(existing.id)}, not ${asset.family}/${asset.id}.`
    );
  if (path2.basename(path2.dirname(file)) !== asset.id || path2.basename(path2.dirname(path2.dirname(file))) !== asset.family)
    fail(
      "LITTLEWILD_EXPORT",
      `Littlewild expects ${asset.family}/${asset.id}/definition.json; got ${file}.`
    );
  const { visual, report, warnings } = littlewildVisual(asset, models, existing);
  const definition = existing ? Object.fromEntries(
    Object.entries({ ...existing, visual }).map(([k]) => [
      k,
      k === "visual" ? visual : existing[k]
    ])
  ) : {
    format: "littlewild-definition",
    schemaVersion: 1,
    family: asset.family,
    id: asset.id,
    visual
  };
  const layout = existing && sourceLayouts.find((format) => format(existing) === previousText) || definitionText;
  const text = layout(definition);
  const changed = previousText !== text;
  if (changed && !options.dryRun && !options.check) await atomicWrite(file, text);
  return {
    path: file,
    id: asset.id,
    family: asset.family,
    changed,
    written: changed && !options.dryRun && !options.check,
    bytes: Buffer.byteLength(text),
    variants: report,
    warnings
  };
}

// ../model-forge/src/kernel/io/playwright.ts
import { createRequire } from "node:module";
import { realpathSync } from "node:fs";
import path3 from "node:path";
var defaultPackageDirectory = "source/scene-forge";
var notFound = (error) => ["MODULE_NOT_FOUND", "ERR_MODULE_NOT_FOUND"].includes(errorCode(error) ?? "");
function realDirectory(file) {
  if (!file) return void 0;
  try {
    return path3.dirname(realpathSync(file));
  } catch {
    return path3.dirname(path3.resolve(file));
  }
}
function playwrightSearchRoots(environment) {
  const entry = realDirectory(environment.entry);
  const prefix = path3.dirname(environment.execPath);
  const roots = [
    environment.cwd,
    ...entry ? [path3.join(entry, "..", environment.packageDirectory ?? defaultPackageDirectory)] : [],
    environment.platform === "win32" ? prefix : path3.join(prefix, "..", "lib")
  ];
  return [...new Set(roots.map((root) => path3.resolve(root)))];
}
var playwrightRemedies = [
  "From a repository checkout: cd source/scene-forge && npm ci (bin/scene-forge then finds source/scene-forge/node_modules/playwright).",
  "Anywhere: npm install --global playwright, or set NODE_PATH to a node_modules directory that contains playwright.",
  "Then provide Chromium: npx playwright install chromium (Linux: --with-deps), or set FORGE_CHROMIUM_PATH."
];
var playwrightEnvironment = (packageDirectory) => ({
  cwd: process.cwd(),
  entry: process.argv[1],
  execPath: process.execPath,
  platform: process.platform,
  ...packageDirectory ? { packageDirectory } : {}
});
async function loadPlaywright(environment = playwrightEnvironment(), importDefault = () => import("playwright")) {
  const reasons = [];
  try {
    return { resolvedFrom: "default", module: await importDefault() };
  } catch (error) {
    if (!notFound(error)) throw error;
    reasons.push(errorMessage(error).split("\n")[0]);
  }
  const roots = playwrightSearchRoots(environment);
  for (const root of roots) {
    try {
      const load = createRequire(path3.join(root, "noop.js"));
      const resolved = load.resolve("playwright");
      return { resolvedFrom: resolved, module: load(resolved) };
    } catch (error) {
      if (!notFound(error)) throw error;
    }
  }
  return fail(
    "PLAYWRIGHT_UNAVAILABLE",
    "This command renders in headless Chromium through Playwright, which is not bundled with this executable and could not be resolved.",
    {
      searched: ["module resolution of the running CLI and NODE_PATH", ...roots],
      reasons,
      remedies: playwrightRemedies
    }
  );
}

// ../model-forge/src/kernel/io/capture.ts
import { promises as fs3 } from "node:fs";
import path4 from "node:path";
import os from "node:os";
var captureDependencies = (environment) => ({
  createTemp: () => fs3.mkdtemp(path4.join(os.tmpdir(), "forge-capture-")),
  async launch() {
    const { chromium } = (await loadPlaywright(environment)).module;
    return chromium.launch({
      headless: true,
      executablePath: process.env.FORGE_CHROMIUM_PATH,
      args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader"]
    });
  }
});
async function withCaptureSession(html, options, action, ports = captureDependencies()) {
  const temp = await ports.createTemp();
  let browser;
  let failed = false;
  try {
    try {
      browser = await ports.launch();
    } catch (error) {
      if (error instanceof ForgeError && error.code === "PLAYWRIGHT_UNAVAILABLE") throw error;
      fail(
        "BROWSER_UNAVAILABLE",
        "Screenshot capture needs Chromium. Run npx playwright install chromium (or install --with-deps chromium on Linux), or set FORGE_CHROMIUM_PATH.",
        { reason: errorMessage(error) }
      );
    }
    const page = await browser.newPage({
      viewport: { width: options.width, height: options.height },
      deviceScaleFactor: 1
    });
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    const assertRendered = async () => {
      const error = await page.evaluate(() => window.forgeError);
      if (error || pageErrors.length)
        fail("RENDER_FAILED", "Scene preview failed to render.", { error, pageErrors });
    };
    await page.setContent(html, { waitUntil: "load" });
    await page.evaluate(
      (capture) => document.body.classList.toggle("capture", capture),
      !options.ui
    );
    await page.waitForFunction(
      () => {
        const rendered = window;
        return rendered.forgeReady || rendered.forgeError;
      },
      {},
      { timeout: 3e4 }
    );
    await assertRendered();
    return await action({
      temp,
      browser,
      page,
      async capture(request, grid, wireframe = false) {
        const camera = await page.evaluate(
          async ({ request: request2, grid: grid2, wireframe: wireframe2 }) => {
            const viewer = window.forgeViewer;
            viewer.clearSelection();
            viewer.configureCapture(request2, wireframe2);
            viewer.setGrid(grid2);
            await new Promise(
              (resolve) => requestAnimationFrame(() => {
                viewer.render();
                resolve();
              })
            );
            return viewer.getCamera();
          },
          { request, grid, wireframe }
        );
        await assertRendered();
        const bytes = await page.screenshot({ type: "png" });
        await assertRendered();
        return { bytes, camera };
      }
    });
  } catch (error) {
    failed = true;
    throw error;
  } finally {
    try {
      await browser?.close();
    } catch (error) {
      if (!failed) throw error;
    } finally {
      await fs3.rm(temp, { recursive: true, force: true });
    }
  }
}

// ../model-forge/src/kernel/io/review.ts
import { promises as fs4 } from "node:fs";
import path5 from "node:path";
import { createHash as createHash2 } from "node:crypto";
import { REVISION } from "three";
async function reviewRender(scene, models, output, input, renderer, options = {}) {
  scene = parse(SceneSchema, scene);
  const originalStateHash = stateHash(scene, models);
  const plan = parse(ReviewPlanSchema, input);
  if (plan.background)
    scene = { ...scene, environment: { ...scene.environment, background: plan.background } };
  const ids = plan.frames.map((f) => f.id);
  if (new Set(ids).size !== ids.length || plan.contactSheet && ids.includes("contact-sheet"))
    fail("DUPLICATE_ID", "Review frame IDs must be unique; contact-sheet is reserved.");
  if (plan.frames.some((f) => f.camera.view === "authored" && !f.camera.fixed) && !scene.camera)
    fail("INVALID_CAMERA", "No authored camera is defined. Use setCamera or another view.");
  const destination = path5.resolve(output);
  const exists2 = await fs4.readdir(destination).catch((error) => {
    if (errorCode(error) === "ENOENT") return [];
    throw error;
  });
  if (exists2.length && !options.overwrite)
    fail(
      "ALREADY_EXISTS",
      "Review directory is not empty. Choose a new directory or pass --overwrite."
    );
  const started = performance.now();
  const html = await renderer.buildHtml(scene, models, { stateHash: options.sourceStateHash });
  return withCaptureSession(
    html,
    plan,
    async ({ temp, browser, page, capture }) => {
      const stats = await page.evaluate(
        () => window.forgeViewer.stats
      );
      const frames = [];
      for (const frame of plan.frames) {
        const { bytes, camera } = await capture(frame.camera, plan.grid, plan.wireframe);
        await fs4.writeFile(path5.join(temp, `${frame.id}.png`), bytes);
        frames.push({
          id: frame.id,
          file: `${frame.id}.png`,
          width: plan.width,
          height: plan.height,
          camera,
          sha256: createHash2("sha256").update(bytes).digest("hex"),
          bytes: bytes.length
        });
      }
      let contactSheet;
      if (plan.contactSheet) {
        const images = await Promise.all(
          frames.map(async (f) => ({
            id: f.id,
            url: "data:image/png;base64," + (await fs4.readFile(path5.join(temp, f.file))).toString("base64")
          }))
        );
        const result = await page.evaluate(
          async ({ images: images2, width, height: height2 }) => {
            const scale = Math.min(1, 640 / width, 480 / height2), cellWidth = Math.max(1, Math.round(width * scale)), cellHeight = Math.max(1, Math.round(height2 * scale)), columns = Math.min(3, Math.ceil(Math.sqrt(images2.length))), rows = Math.ceil(images2.length / columns), label = 32;
            const canvas = document.createElement("canvas");
            canvas.width = columns * cellWidth;
            canvas.height = rows * (cellHeight + label);
            const ctx = canvas.getContext("2d");
            ctx.fillStyle = "#171d25";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            for (const [i, frame] of images2.entries()) {
              const image = new Image();
              image.src = frame.url;
              await image.decode();
              const x = i % columns * cellWidth, y = Math.floor(i / columns) * (cellHeight + label);
              ctx.drawImage(image, x, y + label, cellWidth, cellHeight);
              ctx.fillStyle = "#edf2f7";
              ctx.font = "14px sans-serif";
              ctx.fillText(frame.id, x + 12, y + 22, Math.max(1, cellWidth - 24));
            }
            return {
              url: canvas.toDataURL("image/png"),
              width: canvas.width,
              height: canvas.height
            };
          },
          { images, width: plan.width, height: plan.height }
        );
        await fs4.writeFile(
          path5.join(temp, "contact-sheet.png"),
          Buffer.from(result.url.split(",")[1], "base64")
        );
        contactSheet = { file: "contact-sheet.png", width: result.width, height: result.height };
      }
      const manifest = {
        schemaVersion: 1,
        kind: "review-result",
        provenance: {
          tool: renderer.tool,
          version: renderer.version,
          three: REVISION,
          node: process.version,
          platform: process.platform,
          arch: process.arch,
          chromium: browser.version(),
          rendererRequested: "ANGLE SwiftShader",
          documentTransport: "inline-html"
        },
        scene: options.identity?.scene ?? scene.id,
        revision: options.identity?.revision ?? scene.revision,
        sourceStateHash: options.sourceStateHash ?? originalStateHash,
        renderStateHash: stateHash(scene, models),
        target: options.target ?? { scene: scene.id },
        plan,
        stats,
        frames,
        contactSheet,
        replayPlan: "replay-plan.json",
        durationMs: Math.round(performance.now() - started)
      };
      const replay = parse(ReviewPlanSchema, {
        ...plan,
        background: scene.environment.background,
        frames: frames.map((f) => ({ id: f.id, camera: { fixed: f.camera } }))
      });
      await fs4.mkdir(destination, { recursive: true });
      for (const name of [
        ...frames.map((f) => f.file),
        ...contactSheet ? [contactSheet.file] : []
      ])
        await atomicWrite(path5.join(destination, name), await fs4.readFile(path5.join(temp, name)));
      await writeJson(path5.join(destination, "replay-plan.json"), replay);
      await writeJson(path5.join(destination, "review.json"), manifest);
      return {
        directory: destination,
        manifest: path5.join(destination, "review.json"),
        replayPlan: path5.join(destination, "replay-plan.json"),
        contactSheet: contactSheet ? path5.join(destination, contactSheet.file) : void 0,
        frames: frames.map((f) => ({ ...f, path: path5.join(destination, f.file) })),
        stats,
        durationMs: manifest.durationMs,
        sourceStateHash: manifest.sourceStateHash
      };
    },
    renderer.capture
  );
}

// ../model-forge/src/kernel/application/semantic-bindings.ts
import { Box3 as Box38 } from "three";
function reject(message) {
  return fail("SCHEMA_INVALID", message, {
    hint: "Repair semantic tags, unique node paths and finite geometry in the source recipe; recompile before exporting."
  });
}
function semanticBindings(root, required2 = []) {
  root.updateWorldMatrix(true, true);
  const bindings = [];
  const roles = /* @__PURE__ */ new Set();
  const pathCounts = /* @__PURE__ */ new Map();
  let visited = 0;
  root.traverse((object) => {
    if (++visited > 2e4) reject("Semantic binding traversal exceeds 20,000 objects.");
    if (object.name) pathCounts.set(object.name, (pathCounts.get(object.name) ?? 0) + 1);
  });
  root.traverse((object) => {
    const tags = object.userData.tags;
    if (!Array.isArray(tags)) return;
    for (const tag of tags) {
      if (typeof tag !== "string" || !/^(socket|articulation|volume):/.test(tag)) continue;
      const match = /^(socket|articulation|volume):([a-zA-Z][a-zA-Z0-9_-]{0,63})$/.exec(tag);
      if (!match) reject(`Invalid semantic role: ${tag}`);
      if (roles.has(tag)) reject(`Duplicate semantic role: ${tag}`);
      if (!object.name) reject(`Semantic role ${tag} requires a stable object path.`);
      if (pathCounts.get(object.name) !== 1) reject(`Duplicate semantic path: ${object.name}`);
      const binding = {
        kind: match[1],
        role: match[2],
        path: object.name,
        parent: object.parent?.name ?? "",
        localMatrix: object.matrix.toArray(),
        worldMatrix: object.matrixWorld.toArray()
      };
      if (![...binding.localMatrix, ...binding.worldMatrix].every(Number.isFinite))
        reject(`Non-finite semantic transform: ${tag}`);
      if (binding.kind === "volume") {
        const bounds = new Box38().setFromObject(object, true);
        if (bounds.isEmpty() || ![...bounds.min.toArray(), ...bounds.max.toArray()].every(Number.isFinite))
          reject(`Semantic volume ${tag} needs nonempty finite geometry.`);
        binding.bounds = { min: bounds.min.toArray(), max: bounds.max.toArray() };
      }
      roles.add(tag);
      bindings.push(binding);
      if (bindings.length > 256) reject("An assembly supports at most 256 semantic bindings.");
    }
  });
  for (const role of required2) {
    if (!roles.has(role)) reject(`Missing required semantic role: ${role}`);
  }
  return {
    format: "forge-semantic-bindings",
    version: 1,
    coordinates: { unit: "metre", up: "+Y", forward: "+Z", matrix: "column-major" },
    bindings: bindings.sort((a, b) => `${a.kind}:${a.role}`.localeCompare(`${b.kind}:${b.role}`))
  };
}

// src/domain/schema.ts
import { z as z10 } from "zod";
var ProjectSchema = z10.object({
  schemaVersion: z10.literal(1),
  name: z10.string().min(1).max(120),
  activeScene: Id,
  scenes: z10.record(Id, z10.string()),
  models: z10.record(Id, z10.string())
}).strict();
var CompositionSchema = z10.object({
  schemaVersion: z10.literal(1),
  kind: z10.literal("composition"),
  ...guards,
  groups: z10.array(z10.object({ ...nodeBase, type: z10.literal("group").default("group") }).strict()).default([]),
  instances: z10.array(
    z10.object({
      ...nodeBase,
      type: z10.literal("model").default("model"),
      model: Id,
      parameters: z10.record(Id, Scalar).default({}),
      materialOverrides: z10.record(Id, Id).default({})
    }).strict()
  ).min(1).max(1e4)
}).strict();
var SceneBundleSchema = z10.object({
  schemaVersion: z10.literal(1),
  kind: z10.literal("scene-bundle"),
  scene: SceneSchema,
  models: z10.record(Id, ModelSchema)
}).strict();
var LittlewildExportSchema = z10.object({
  schemaVersion: z10.literal(1),
  kind: z10.literal("littlewild-export"),
  target: z10.string().min(1).max(512),
  assets: z10.array(LittlewildAssetSchema).min(1).max(128)
}).strict();
var schemas = {
  scene: SceneSchema,
  model: ModelSchema,
  project: ProjectSchema,
  batch: BatchSchema,
  node: NodeSchema,
  geometry: GeometrySchema,
  material: MaterialSchema,
  composition: CompositionSchema,
  "model-bundle": ModelBundleSchema,
  "scene-bundle": SceneBundleSchema,
  selector: SelectorSchema,
  scalar: Scalar,
  review: ReviewPlanSchema,
  camera: CameraRequestSchema,
  "camera-snapshot": CameraSnapshotSchema,
  "quality-policy": QualityPolicySchema,
  pattern: PatternSchema,
  rig: RigSchema,
  "littlewild-export": LittlewildExportSchema,
  scatter: ScatterRecipeSchema
};
var schemaKinds = Object.keys(schemas);
function jsonSchema(kind) {
  if (!Object.hasOwn(schemas, kind))
    fail("UNKNOWN_SCHEMA", `Unknown schema ${kind}.`, { available: Object.keys(schemas) });
  return z10.toJSONSchema(schemas[kind], {
    target: "draft-2020-12",
    io: "input"
  });
}

// src/version.ts
var VERSION = "0.6.0";

// src/infra/files.ts
import { promises as fs5 } from "node:fs";
import path6 from "node:path";
async function inside(root, relative) {
  const candidate = path6.resolve(root, relative);
  const rel = path6.relative(root, candidate);
  if (path6.isAbsolute(relative) || rel.startsWith("..") || path6.isAbsolute(rel))
    fail("INVALID_PATH", `Project path escapes the project: ${relative}`);
  let ancestor = candidate;
  let actual;
  while (true) {
    try {
      actual = await fs5.realpath(ancestor);
      break;
    } catch (error) {
      if (errorCode(error) !== "ENOENT") throw error;
      const parent = path6.dirname(ancestor);
      if (parent === ancestor) throw error;
      ancestor = parent;
    }
  }
  const resolved = path6.resolve(actual, path6.relative(ancestor, candidate));
  if (path6.relative(root, resolved).startsWith(".."))
    fail("INVALID_PATH", `Project path resolves outside the project: ${relative}`);
  return candidate;
}
async function findProject(start) {
  let current = await fs5.realpath(path6.resolve(start)).catch(() => fail("PROJECT_NOT_FOUND", `Directory ${start} does not exist.`));
  while (true) {
    try {
      await fs5.access(path6.join(current, "forge.project.json"));
      return current;
    } catch {
    }
    const parent = path6.dirname(current);
    if (parent === current)
      fail(
        "PROJECT_NOT_FOUND",
        "No forge.project.json found. Run init <directory> to create a project."
      );
    current = parent;
  }
}
async function withLock(root, action) {
  const lock = path6.join(root, ".forge.lock");
  let handle;
  try {
    handle = await fs5.open(lock, "wx");
  } catch (error) {
    if (errorCode(error) === "EEXIST")
      fail(
        "PROJECT_LOCKED",
        "Another command holds the project lock. Retry after it finishes. If the process crashed, remove .forge.lock only after verifying no writer is running."
      );
    throw error;
  }
  try {
    await handle.writeFile(JSON.stringify({ pid: process.pid }));
    return await action();
  } finally {
    try {
      await handle.close();
    } finally {
      await fs5.rm(lock, { force: true });
    }
  }
}

// src/infra/assets.ts
import { promises as fs6 } from "node:fs";
import { fileURLToPath } from "node:url";

// src/infra/embedded-assets.ts
var embeddedAssets = void 0;

// src/infra/assets.ts
function candidates2(name) {
  const base = import.meta.url;
  if (!base) return [];
  const relative = name.startsWith("examples/") ? [`./${name}`, `../../examples/catalog/${name.slice("examples/".length)}`] : [`./${name}`, `../../dist/${name}`];
  return relative.map((file) => fileURLToPath(new URL(file, base)));
}
async function readAsset(name) {
  if (embeddedAssets) {
    const embedded = embeddedAssets[name];
    if (embedded !== void 0) return embedded;
    return fail(
      "BUILD_REQUIRED",
      `Packaged asset ${name} is missing from this executable. Rebuild it with npm run build:cli.`
    );
  }
  for (const file of candidates2(name)) {
    try {
      return await fs6.readFile(file, "utf8");
    } catch (error) {
      if (!["ENOENT", "ENOTDIR"].includes(errorCode(error) ?? "")) throw error;
    }
  }
  return fail("BUILD_REQUIRED", `Packaged asset ${name} is missing. Run npm run build.`);
}

// src/infra/preview.ts
import path7 from "node:path";

// src/preview/template.ts
var escapeHtml = (s) => s.replace(
  /[&<>"']/g,
  (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
);
function previewTemplate(name, css, script, payload, version) {
  const vectors = ["position", "rotation", "scale"].map(
    (key) => `<fieldset><legend>${key === "position" ? "Position \xB7 m" : key === "rotation" ? "Rotation \xB7 \xB0" : "Scale"}</legend><div class="vector">${["x", "y", "z"].map((axis) => `<label><span>${axis.toUpperCase()}</span><input type="number" id="${key}-${axis}" aria-label="${key} ${axis}" step="${key === "rotation" ? 5 : 0.1}" inputmode="decimal"></label>`).join("")}</div></fieldset>`
  ).join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><title>${escapeHtml(name)} \xB7 Scene Forge</title><style>${css}</style></head>
<body><header><div class="brand"><strong>Scene Forge <small>${escapeHtml(version)}</small></strong><div><h1 id="scene-name"></h1><p class="muted" id="scene-meta"></p><select id="scene-chooser" aria-label="Example scene" hidden></select></div></div><div class="actions"><button id="undo" title="Undo (Ctrl/\u2318 Z)" disabled>Undo</button><button id="redo" title="Redo (Ctrl/\u2318 Shift Z)" disabled>Redo</button><button id="recipe" aria-expanded="false" aria-controls="source-panel">View recipe</button><button id="save-bundle" title="Download scene and model recipes">Save bundle</button><button id="png">Save PNG</button><button id="glb">Export GLB</button><button id="save-edits" class="primary" disabled>Save edits</button></div></header>
<main class="workspace"><aside class="navigator" aria-label="Scene and model library"><div class="navigator-head"><div class="tabs" role="tablist" aria-label="Browse"><button id="scene-tab" role="tab" aria-selected="true" aria-controls="scene-list">Scene</button><button id="models-tab" role="tab" aria-selected="false" aria-controls="model-list">Models <span id="model-count"></span></button></div><label class="search-label"><span id="filter-label">Find an object</span><input id="filter" type="search" placeholder="Filter by name" autocomplete="off"></label></div><section id="scene-list" role="tabpanel" aria-labelledby="scene-tab"><div class="list-heading"><span>Objects</span><span id="node-count"></span></div><div id="objects"></div></section><section id="model-list" role="tabpanel" aria-labelledby="models-tab" hidden><p class="library-help">Add a model, then move it into place.</p><label class="category-label">Category<select id="asset-category" aria-label="Category"><option value="">All models</option></select></label><div id="models"></div></section><div class="navigator-bottom"><p class="muted">Reusable models stay linked to their recipes.</p><details id="warning-panel" hidden><summary id="warning-summary">Build notes</summary><p id="warnings"></p></details></div></aside>
<section class="viewport" aria-label="Scene composer"><div class="toolbar"><div class="views" aria-label="Camera views"><button data-view="iso" aria-pressed="true">Perspective</button><button data-view="front" aria-pressed="false">Front</button><button data-view="side" aria-pressed="false">Side</button><button data-view="top" aria-pressed="false">Top</button></div><div class="views"><button id="fit" title="Frame selection or scene (F)">Frame</button><button id="fit-all" title="Frame all objects (Shift+F)">Fit all</button><button id="grid" aria-pressed="true">Grid</button><button id="wireframe" aria-pressed="false">Wireframe</button></div></div><div class="edit-toolbar"><div class="views" aria-label="Transform tool"><button data-mode="select" aria-pressed="true" title="Select (Q)">Select</button><button data-mode="translate" aria-pressed="false" title="Move (W)">Move</button><button data-mode="rotate" aria-pressed="false" title="Rotate (E)">Rotate</button><button data-mode="scale" aria-pressed="false" title="Scale (R)">Scale</button></div><label class="inline-check"><input id="snap" type="checkbox"> Snap <span class="muted">0.25 m / 15\xB0</span></label><span id="edit-state" class="muted">Saved scene</span></div><div id="stage"><span class="stage-label" id="view-label">Perspective</span><span class="stage-help">Drag to orbit \xB7 Right-drag to pan \xB7 Scroll to zoom \xB7 F to frame</span><div id="loading" role="status">Loading scene\u2026</div><section id="source-panel" hidden aria-label="Scene recipe"><div><h2 id="source-title">Current scene recipe</h2><button id="close-source">Close</button></div><pre id="source"></pre></section><div id="toast" role="status" aria-live="polite" hidden></div></div></section>
<aside class="inspector" aria-label="Object inspector"><div class="inspector-title"><h2 id="selection-title">Scene composition</h2><span id="selection-kind" class="muted"></span></div><div id="empty-selection"><p>Select an object to position it, or add a reusable model from the library.</p><button id="browse-models">Browse models</button><div class="help-block"><h3>Make it reusable</h3><p>Capture an assembly with <code>model capture</code>, then compose scenes with its instances.</p></div><div class="help-block"><h3>Keep your work</h3><p>Download edits, then apply the JSON batch to your project with the CLI.</p></div></div><form id="transform-form" hidden><label class="field">Name<input id="node-name" maxlength="120"></label><p class="node-id" id="selected-id"></p>${vectors}<label class="inline-check"><input type="checkbox" id="node-visible"> Visible in scene</label><div class="object-actions"><button type="button" id="duplicate">Duplicate</button><button type="button" id="ground">Ground</button><button type="button" id="remove" class="danger">Remove</button></div></form><div id="editor-tools"></div><details class="node-json"><summary>Node details</summary><pre id="details">Select an object to inspect its source and dimensions.</pre></details><div class="object-actions"><button id="copy-camera">Copy review plan</button><button id="save-review">Save review plan</button></div></aside></main>
<footer><span id="stats"></span><span id="bounds"></span><span class="accent">Offline \xB7 Three.js</span></footer><script>window.__FORGE__=${payload};</script><script>${script.replace(/<\/script/gi, "<\\/script")}</script></body></html>`;
}

// src/infra/preview.ts
function compileLibrary(models) {
  return Object.values(models).map((model) => {
    const doc = parse(SceneSchema, {
      schemaVersion: 1,
      kind: "scene",
      id: "catalog",
      name: model.name,
      nodes: [{ type: "model", id: "root", model: model.id }]
    });
    const compiled = compileScene(doc, models, { bindRigs: false });
    try {
      return {
        id: model.id,
        name: model.name,
        category: model.category,
        description: model.description,
        parameters: model.parameters,
        stats: compiled.stats,
        object: compiled.content.children[0].toJSON()
      };
    } finally {
      compiled.dispose();
    }
  });
}
function compilePreview(document2, models, options) {
  const built = compileScene(document2, models, { bindRigs: false });
  try {
    return {
      version: VERSION,
      document: document2,
      scene: built.scene.toJSON(),
      stats: built.stats,
      stateHash: options.stateHash,
      editable: options.editable !== false
    };
  } finally {
    built.dispose();
  }
}
async function renderPreview(data) {
  const [script, css] = await Promise.all([readAsset("viewer.js"), readAsset("viewer.css")]);
  const json = JSON.stringify(data);
  if (Buffer.byteLength(json) > 64 * 1024 * 1024)
    fail("PREVIEW_BUDGET", "Preview scene data exceeds 64 MiB. Preview a smaller scene or model.");
  return previewTemplate(data.document.name, css, script, json.replace(/</g, "\\u003c"), VERSION);
}
async function createPreview(document2, models, options = {}) {
  const library = options.includeLibrary !== false && options.editable !== false ? compileLibrary(models) : [];
  return renderPreview({ ...compilePreview(document2, models, options), models, library });
}
async function createProjectPreview(documents, models, activeScene) {
  if (!documents.length || documents.length > 24)
    fail(
      "PREVIEW_BUDGET",
      "A project preview requires 1\u201324 scenes. Use a single-scene preview for larger projects."
    );
  if (new Set(documents.map((scene) => scene.id)).size !== documents.length)
    fail("DUPLICATE_ID", "Project preview scene IDs must be unique.");
  const scenes = documents.map(
    (scene) => compilePreview(scene, models, { stateHash: stateHash(scene, models) })
  );
  const selected = activeScene ? scenes.find((scene) => scene.document.id === activeScene) : scenes[0];
  if (!selected) fail("NOT_FOUND", `Scene ${activeScene} is not in this project.`);
  return renderPreview({
    ...selected,
    models,
    library: compileLibrary(models),
    project: { scenes }
  });
}
async function screenshot(html, output, options) {
  const request = parse(CameraRequestSchema, { view: options.view, ...options.camera });
  return withCaptureSession(html, options, async ({ capture }) => {
    const { bytes, camera } = await capture(request, options.grid, !!options.wireframe);
    await atomicWrite(path7.resolve(output), bytes);
    return {
      path: path7.resolve(output),
      width: options.width,
      height: options.height,
      view: options.view,
      camera
    };
  });
}

// src/infra/project.ts
import { promises as fs7 } from "node:fs";
import path8 from "node:path";
var newScene = (id, name = id) => parse(SceneSchema, { schemaVersion: 1, kind: "scene", id, name });
async function parseFile(schema, root, relative) {
  const value = await readJson(await inside(root, relative));
  try {
    return parse(schema, value);
  } catch (error) {
    if (error instanceof ForgeError && error.code === "SCHEMA_INVALID")
      fail(error.code, `${relative}: ${error.message}`, error.details);
    throw error;
  }
}
async function readManifest(root) {
  return parse(ProjectSchema, await readJson(path8.join(root, "forge.project.json")));
}
async function loadUnlocked(root, sceneId) {
  const manifest = await readManifest(root);
  const id = sceneId ?? manifest.activeScene;
  if (!Object.hasOwn(manifest.scenes, id))
    fail("NOT_FOUND", `Scene ${id} is not registered.`, {
      available: Object.keys(manifest.scenes)
    });
  const scene = await parseFile(SceneSchema, root, manifest.scenes[id]);
  if (scene.id !== id)
    fail("ID_MISMATCH", `Scene file declares ${scene.id}, but is registered as ${id}.`);
  const models = {};
  for (const [mid, file] of Object.entries(manifest.models)) {
    const model = await parseFile(ModelSchema, root, file);
    if (model.id !== mid)
      fail("ID_MISMATCH", `Model file declares ${model.id}, but is registered as ${mid}.`);
    models[mid] = model;
  }
  return { root, manifest, scene, models, stateHash: stateHash(scene, models) };
}
async function loadProject(start, sceneId) {
  const root = await findProject(start);
  return withLock(root, () => loadUnlocked(root, sceneId));
}
async function loadProjectScenes(start) {
  const root = await findProject(start);
  return withLock(root, async () => {
    const current = await loadUnlocked(root);
    const scenes = [];
    for (const [id, relative] of Object.entries(current.manifest.scenes)) {
      const scene = id === current.scene.id ? current.scene : parse(SceneSchema, await readJson(await inside(root, relative)));
      if (scene.id !== id)
        fail("ID_MISMATCH", `Scene file declares ${scene.id}, but is registered as ${id}.`);
      scenes.push(scene);
    }
    return { root, manifest: current.manifest, models: current.models, scenes };
  });
}
async function initProject(directory, name) {
  const root = path8.resolve(directory);
  await fs7.mkdir(root, { recursive: true });
  return withLock(root, async () => {
    const manifestPath = path8.join(root, "forge.project.json");
    for (const file of [manifestPath, path8.join(root, "scenes/main.scene.json")]) {
      try {
        await fs7.access(file);
        fail("ALREADY_EXISTS", `Initialization would overwrite ${file}. Choose a new directory.`);
      } catch (error) {
        if (errorCode(error) !== "ENOENT") throw error;
      }
    }
    const manifest = {
      schemaVersion: 1,
      name: name ?? path8.basename(root),
      activeScene: "main",
      scenes: { main: "scenes/main.scene.json" },
      models: {}
    };
    parse(ProjectSchema, manifest);
    await writeJson(path8.join(root, "scenes/main.scene.json"), newScene("main", "Main scene"));
    await fs7.mkdir(path8.join(root, "models"), { recursive: true });
    await fs7.mkdir(path8.join(root, "exports"), { recursive: true });
    await writeJson(manifestPath, manifest);
    return { project: root, manifest };
  });
}
async function createScene(start, id, name) {
  parse(Id, id);
  const root = await findProject(start);
  return withLock(root, async () => {
    const manifest = await readManifest(root);
    if (Object.hasOwn(manifest.scenes, id)) fail("ALREADY_EXISTS", `Scene ${id} already exists.`);
    const relative = `scenes/${id}.scene.json`;
    try {
      await fs7.access(path8.join(root, relative));
      fail("ALREADY_EXISTS", `Unregistered scene file ${relative} already exists.`);
    } catch (error) {
      if (errorCode(error) !== "ENOENT") throw error;
    }
    await writeJson(await inside(root, relative), newScene(id, name));
    manifest.scenes[id] = relative;
    await writeJson(path8.join(root, "forge.project.json"), manifest);
    return { id, path: relative };
  });
}
async function useScene(start, id) {
  const root = await findProject(start);
  return withLock(root, async () => {
    const manifest = await readManifest(root);
    if (!Object.hasOwn(manifest.scenes, id)) fail("NOT_FOUND", `Scene ${id} does not exist.`);
    manifest.activeScene = id;
    await writeJson(path8.join(root, "forge.project.json"), manifest);
    return { activeScene: id };
  });
}
async function commitOperations(start, sceneId, ops, options = {}) {
  const root = await findProject(start);
  return withLock(root, async () => {
    const snapshot = await loadUnlocked(root, sceneId);
    const { next, result } = prepareSceneEdit(snapshot, ops, options, stateHash);
    if (result.changed && !options.dryRun) await persistScene(root, snapshot, next);
    return result;
  });
}
async function persistScene(root, { scene, manifest }, next) {
  await writeJson(await inside(root, `history/${scene.id}/${scene.revision}.json`), scene);
  await writeJson(await inside(root, manifest.scenes[scene.id]), next);
}
async function commitPlanned(start, sceneId, plan, options = {}) {
  const root = await findProject(start);
  return withLock(root, async () => {
    const snapshot = await loadUnlocked(root, sceneId);
    checkGuards(snapshot, options);
    const { operations, report } = plan(snapshot);
    const { next, result } = prepareSceneEdit(snapshot, operations, options, stateHash);
    if (result.changed && !options.dryRun) await persistScene(root, snapshot, next);
    return { ...result, ...report };
  });
}
async function importModel(start, input, replace = false, options = {}) {
  const data = input && typeof input === "object" && "kind" in input && input.kind === "model-bundle" ? parse(ModelBundleSchema, input) : (() => {
    const m = parse(ModelSchema, input);
    return { entry: m.id, models: { [m.id]: m } };
  })();
  if (!Object.hasOwn(data.models, data.entry))
    fail("REFERENCE_MISSING", "Bundle entry model is missing.");
  const warnings = [];
  for (const [id, model] of Object.entries(data.models))
    if (model.revision !== void 0) {
      warnings.push(
        `Dropped the editor-only revision ${model.revision} of model ${id}; projects store portable recipes.`
      );
      const { revision: _revision, ...portable } = model;
      data.models[id] = portable;
    }
  const root = await findProject(start);
  return withLock(root, async () => {
    const snapshot = await loadUnlocked(root);
    checkGuards(snapshot, options);
    const result = await registerModels(
      root,
      data.models,
      data.entry,
      replace,
      snapshot,
      options.dryRun
    );
    return warnings.length ? { ...result, warnings } : result;
  });
}
async function registerModels(root, incoming, entry, replace, snapshot, dryRun = false) {
  const current = snapshot ?? await loadUnlocked(root);
  const manifest = structuredClone(current.manifest);
  for (const [id, model] of Object.entries(incoming)) {
    if (model.id !== id) fail("ID_MISMATCH", `Model ${model.id} is keyed as ${id}.`);
    if (Object.hasOwn(current.models, id) && canonical(current.models[id]) !== canonical(model) && !replace)
      fail(
        "ALREADY_EXISTS",
        `Model ${id} differs from the registered model. Use --replace deliberately.`
      );
  }
  const library = { ...current.models, ...incoming };
  for (const model of Object.values(library)) {
    const built = compileScene(
      parse(SceneSchema, {
        schemaVersion: 1,
        kind: "scene",
        id: "validation",
        name: "Validation",
        nodes: [{ type: "model", id: "root", model: model.id }]
      }),
      library
    );
    built.dispose();
  }
  for (const file of Object.values(manifest.scenes)) {
    const built = compileScene(
      parse(SceneSchema, await readJson(await inside(root, file))),
      library
    );
    built.dispose();
  }
  if (dryRun)
    return { id: entry, dryRun: true, models: Object.keys(incoming), model: incoming[entry] };
  const writes = [];
  for (const [id, model] of Object.entries(incoming)) {
    const relative = Object.hasOwn(manifest.models, id) ? manifest.models[id] : `models/${id}.model.json`;
    const file = await inside(root, relative);
    let previous = null;
    try {
      previous = await fs7.readFile(file);
    } catch (error) {
      if (errorCode(error) !== "ENOENT") throw error;
    }
    if (!Object.hasOwn(manifest.models, id) && previous)
      fail("ALREADY_EXISTS", `Unregistered model file ${relative} exists.`);
    writes.push({ file, data: model, previous });
    manifest.models[id] = relative;
  }
  try {
    for (const write of writes) await writeJson(write.file, write.data);
    await writeJson(path8.join(root, "forge.project.json"), manifest);
  } catch (error) {
    for (const write of writes) {
      if (write.previous) await atomicWrite(write.file, write.previous);
      else await fs7.rm(write.file, { force: true });
    }
    throw error;
  }
  return {
    id: entry,
    path: manifest.models[entry],
    parameters: library[entry].parameters,
    models: Object.keys(incoming),
    stateHash: stateHash(current.scene, library)
  };
}
async function captureProjectModel(start, sceneId, roots, id, name, replace = false, options = {}) {
  const root = await findProject(start);
  return withLock(root, async () => {
    const snapshot = await loadUnlocked(root, sceneId);
    checkGuards(snapshot, options);
    const model = captureModel(snapshot.scene, roots, id, name);
    const library = { ...snapshot.models, [id]: model };
    modelDependencies(library, id);
    return registerModels(root, { [id]: model }, id, replace, snapshot, options.dryRun);
  });
}
async function cloneScene(start, sourceId, id, name) {
  parse(Id, id);
  const root = await findProject(start);
  return withLock(root, async () => {
    const snapshot = await loadUnlocked(root, sourceId);
    if (Object.hasOwn(snapshot.manifest.scenes, id)) fail("ALREADY_EXISTS", `Scene ${id} exists.`);
    const relative = `scenes/${id}.scene.json`;
    const file = await inside(root, relative);
    try {
      await fs7.access(file);
      fail("ALREADY_EXISTS", `${relative} exists.`);
    } catch (error) {
      if (errorCode(error) !== "ENOENT") throw error;
    }
    const scene = {
      ...snapshot.scene,
      id,
      name: name ?? `${snapshot.scene.name} copy`,
      revision: 0
    };
    await writeJson(file, scene);
    snapshot.manifest.scenes[id] = relative;
    await writeJson(path8.join(root, "forge.project.json"), snapshot.manifest);
    return { id, path: relative };
  });
}
async function restoreScene(start, sceneId, revision, expectedRevision) {
  const root = await findProject(start);
  return withLock(root, async () => {
    const current = await loadUnlocked(root, sceneId);
    if (expectedRevision !== void 0 && current.scene.revision !== expectedRevision)
      fail("REVISION_CONFLICT", "Current revision does not match expected revision.", {
        actual: current.scene.revision
      });
    const saved = parse(
      SceneSchema,
      await readJson(await inside(root, `history/${current.scene.id}/${revision}.json`))
    );
    if (saved.id !== current.scene.id)
      fail("ID_MISMATCH", "History snapshot belongs to another scene.");
    const built = compileScene(saved, current.models);
    built.dispose();
    await writeJson(
      await inside(root, `history/${current.scene.id}/${current.scene.revision}.json`),
      current.scene
    );
    saved.revision = current.scene.revision + 1;
    await writeJson(await inside(root, current.manifest.scenes[saved.id]), saved);
    return { scene: saved.id, restoredFrom: revision, revision: saved.revision };
  });
}

// src/infra/review.ts
function reviewScene(scene, models, output, input, options = {}) {
  return reviewRender(
    scene,
    models,
    output,
    input,
    {
      tool: "scene-forge",
      version: VERSION,
      buildHtml: (document2, library, { stateHash: stateHash2 }) => createPreview(document2, library, { editable: false, includeLibrary: false, stateHash: stateHash2 })
    },
    options
  );
}

// src/infra/bundle.ts
import { promises as fs8 } from "node:fs";
import path9 from "node:path";
function packScene(scene, library) {
  const models = {};
  for (const node of scene.nodes)
    if (node.type === "model") Object.assign(models, modelDependencies(library, node.model));
  const bundle = parse(SceneBundleSchema, {
    schemaVersion: 1,
    kind: "scene-bundle",
    scene,
    models
  });
  const built = compileScene(bundle.scene, bundle.models);
  built.dispose();
  return bundle;
}
async function unpackScene(directory, input) {
  const bundle = parse(SceneBundleSchema, input);
  for (const [id, model] of Object.entries(bundle.models))
    if (id !== model.id) fail("ID_MISMATCH", `Model ${model.id} is keyed as ${id}.`);
  const packed = packScene(bundle.scene, bundle.models);
  const root = path9.resolve(directory);
  await fs8.mkdir(path9.dirname(root), { recursive: true });
  try {
    await fs8.mkdir(root);
  } catch (error) {
    if (errorCode(error) === "EEXIST") fail("ALREADY_EXISTS", "Unpack requires a new directory.");
    throw error;
  }
  const files = [];
  try {
    const sceneFile = `scenes/${packed.scene.id}.scene.json`;
    const manifest = {
      schemaVersion: 1,
      name: packed.scene.name,
      activeScene: packed.scene.id,
      scenes: { [packed.scene.id]: sceneFile },
      models: Object.fromEntries(
        Object.keys(packed.models).map((id) => [id, `models/${id}.model.json`])
      )
    };
    for (const [relative, data] of [
      [sceneFile, packed.scene],
      ...Object.entries(packed.models).map(([id, m]) => [`models/${id}.model.json`, m]),
      ["forge.project.json", manifest]
    ]) {
      const file = path9.join(root, relative);
      files.push(file);
      await writeJson(file, data);
    }
    return {
      project: root,
      scene: packed.scene.id,
      models: Object.keys(packed.models),
      stateHash: stateHash(packed.scene, packed.models)
    };
  } catch (error) {
    for (const file of files) await fs8.rm(file, { force: true });
    for (const relative of ["scenes", "models", ""])
      await fs8.rmdir(path9.join(root, relative)).catch(() => {
      });
    throw error;
  }
}

// src/commands/rigging.ts
import { Mesh as Mesh7 } from "three";
function registerRigCommands(c) {
  const { program, snapshot, global, output, input, sourceOptions: sourceOptions2, editOptions: editOptions2, at: at2 } = c;
  const rig = program.command("rig").description("Inspect, bind and pose model-instance skeletons");
  rig.command("inspect <node>").description("Read joints, clips and bindable mesh paths").action(async (id) => {
    const s = await snapshot();
    const node = s.scene.nodes.find((n) => n.id === id);
    if (node?.type !== "model")
      fail(
        "INVALID_NODE_TYPE",
        "Rigging requires a model instance. Capture meshes as a model first."
      );
    const built = compileScene(s.scene, s.models, { bindRigs: false });
    try {
      const object = built.content.getObjectByName(`${s.scene.id}/${id}`);
      const meshes = [];
      object.traverse((child) => {
        if (child instanceof Mesh7) meshes.push(child.name.slice(object.name.length + 1));
      });
      output({
        node: id,
        rig: node.rig ?? null,
        meshes,
        revision: s.scene.revision,
        stateHash: s.stateHash
      });
    } finally {
      built.dispose();
    }
  });
  editOptions2(
    sourceOptions2(
      rig.command("bind <node>").description("Replace a model instance rig with a validated rig JSON document")
    )
  ).action(async (id, opts) => {
    const definition = parse(RigSchema, await input(opts));
    output(
      await commitOperations(
        global().project,
        global().scene,
        [{ op: "patchNode", id, patch: { rig: definition } }],
        opts
      )
    );
  });
  editOptions2(
    rig.command("pose <node>").description("Set an absolute local joint rotation in degrees").requiredOption("--joint <id>", "Joint ID").requiredOption("--rotation <x,y,z>", "XYZ Euler degrees")
  ).action(async (id, opts) => {
    const s = await snapshot();
    const node = s.scene.nodes.find((n) => n.id === id);
    if (node?.type !== "model" || !node.rig)
      fail("RIG_MISSING", "Bind a rig to this model instance first.");
    const definition = structuredClone(node.rig);
    definition.pose[opts.joint] = at2(opts.rotation);
    const operations = [
      { op: "patchNode", id, patch: { rig: parse(RigSchema, definition) } }
    ];
    output(
      await commitOperations(global().project, s.scene.id, operations, {
        ...opts,
        expectedState: opts.expectedState ?? s.stateHash,
        expectedRevision: opts.expectedRevision ?? s.scene.revision
      })
    );
  });
  editOptions2(
    rig.command("remove <node>").description("Remove the rig and return its model to its authored rest form")
  ).action(
    async (id, opts) => output(
      await commitOperations(
        global().project,
        global().scene,
        [{ op: "patchNode", id, patch: { rig: null } }],
        opts
      )
    )
  );
}

// src/infra/examples.ts
import { z as z11 } from "zod";
var Entry = z11.object({
  id: Id,
  name: z11.string(),
  description: z11.string(),
  features: z11.array(z11.string()),
  models: z11.array(Id),
  stats: z11.unknown()
}).strict();
async function exampleData(name) {
  return JSON.parse(await readAsset(`examples/${name}`));
}
var listExamples = async () => parse(z11.array(Entry), await exampleData("index.json"));
async function exampleBundle(id) {
  parse(Id, id);
  const examples = await listExamples();
  if (!examples.some((entry) => entry.id === id))
    fail("NOT_FOUND", `Unknown example ${id}.`, { available: examples.map((entry) => entry.id) });
  return parse(SceneBundleSchema, await exampleData(`${id}.scene-bundle.json`));
}
async function createExample(id, directory) {
  const project = await unpackScene(directory, await exampleBundle(id));
  return {
    ...project,
    example: id,
    nextCommands: [
      ["forge3d", "-p", project.project, "inspect", "--source"],
      ["forge3d", "-p", project.project, "model", "list"],
      ["forge3d", "-p", project.project, "review", "--out", `${project.project}/exports/review`],
      [
        "forge3d",
        "-p",
        project.project,
        "export",
        "--validate",
        "--out",
        `${project.project}/exports/scene.glb`
      ]
    ]
  };
}

// src/commands/examples.ts
function registerExampleCommands(c) {
  const command = c.program.command("example").description("Discover and copy bundled procedural examples into editable projects");
  command.command("list").description("List examples, reusable models, features and compiled statistics").action(async () => c.output(await listExamples()));
  command.command("show <id>").description("Inspect the complete portable scene recipe").option("--raw", "Print bare JSON for piping into scene unpack or saving as a bundle").action(async (id, options) => {
    const bundle = await exampleBundle(id);
    if (options.raw) c.writeOut(JSON.stringify(bundle, null, 2) + "\n");
    else c.output(bundle);
  });
  command.command("create <id> <directory>").description("Create a new project from an example without overwriting existing files").action(async (id, directory) => {
    const created = await createExample(id, c.resolvePath(directory));
    const nextCommands = created.nextCommands.map(([, ...args]) => [c.program.name(), ...args]);
    c.output({ ...created, nextCommands });
  });
}

// src/commands/create-cli.ts
import { Command as Command3, CommanderError as CommanderError2 } from "commander";
import path12 from "node:path";

// src/commands/errors.ts
import { CommanderError } from "commander";
function withHint(error, hints) {
  if (error instanceof ForgeError && Object.hasOwn(hints, error.code))
    return Object.assign(error, { hint: hints[error.code] });
  return error;
}
var ownHint = (error) => "hint" in error && typeof error.hint === "string" ? error.hint : void 0;
function formatCliError(error) {
  const forge = error instanceof ForgeError ? error : new ForgeError(
    error instanceof CommanderError ? "CLI_USAGE" : "INTERNAL_ERROR",
    errorMessage(error)
  );
  return JSON.stringify(
    {
      ok: false,
      error: {
        code: forge.code,
        message: forge.message,
        hint: ownHint(forge) ?? {
          SCHEMA_INVALID: "Run schema --kind <kind> --raw and repair the reported field paths.",
          CLI_USAGE: "Run describe <command path> to discover accepted arguments and flags.",
          REFERENCE_MISSING: "Inspect registered models and node IDs before retrying.",
          REVISION_CONFLICT: "Inspect the latest source and rebase the edit; do not drop the guard blindly.",
          STATE_CONFLICT: "Inspect the latest scene/model library and regenerate the review or edit batch.",
          BROWSER_UNAVAILABLE: "Run doctor; install Chromium or set FORGE_CHROMIUM_PATH.",
          PLAYWRIGHT_UNAVAILABLE: "Run doctor. Make playwright resolvable (details.remedies), then install Chromium.",
          RIG_INVALID: "Run schema --kind rig --raw. Check the single root, joint references, cycles and increasing keyframe times.",
          RIG_BINDING: "Run rig inspect <node> and use the exact relative mesh paths returned.",
          RIG_MISSING: "Use rig bind <node> --file <rig.json> before posing a joint.",
          PARAMETER_INTEGER: "Use a whole-number override for parameters marked integer: true.",
          PATTERN_PATH: "Separate successive XZ positions for yaw orientation, or use orient: none.",
          PATTERN_COUNT: "Resolve pattern counts to positive integers; their product must not exceed 256.",
          QUALITY_GATE_FAILED: "Read details.findings, repair the listed geometry or budgets, and run audit again.",
          INPUT_TOO_LARGE: "Split the recipe into smaller reusable models; JSON inputs are limited to 16 MiB.",
          EMPTY_SELECTION: "Run node list with the same filters and check the IDs/tags.",
          PROCEDURAL_BUDGET: "Procedural output is bounded (2,000 placements, 20,000 candidate points, 10,000 scene nodes, 256 x 256 terrain vertices). Increase spacing, shrink the area or lower counts.",
          SCATTER_EMPTY: "Nothing was placed. Read details.rejected and widen the area, lower the spacing or relax exclusions and maxSlope.",
          TERRAIN_TRANSFORM: "Grounding follows only translation, yaw and positive uniform scale on the terrain node, the scatter parent and their ancestors."
        }[forge.code],
        ...forge.details !== void 0 ? { details: forge.details } : {}
      }
    },
    null,
    2
  ) + "\n";
}

// src/commands/options.ts
var integer = (value) => {
  if (!/^\d+$/.test(value))
    return fail("INVALID_OPTION", `Expected a nonnegative integer, got ${value}.`);
  const n = Number(value);
  if (!Number.isSafeInteger(n)) fail("INVALID_OPTION", "Integer is outside the safe range.");
  return n;
};
var at = (text) => {
  const parts = text.split(",");
  const values = parts.map(Number);
  if (parts.some((v) => !v.trim()) || values.length !== 3 || values.some((n) => !Number.isFinite(n)))
    fail("INVALID_OPTION", "Expected a comma-separated x,y,z vector.");
  return values;
};
var sourceOptions = (cmd) => cmd.option("--file <path>", "Read JSON from file, or - for stdin").option("--data <json>", "Inline JSON");
var editOptions = (cmd) => cmd.option("--expected-revision <n>", "Reject if current revision differs", integer).option("--expected-state <hash>", "Reject if the scene or model library changed").option("--dry-run", "Validate and compile without writing");

// src/commands/input.ts
import { z as z12 } from "zod";
import path10 from "node:path";
async function readInputFile(file, flag) {
  try {
    return await readJson(file);
  } catch (error) {
    throw withHint(error, { NOT_FOUND: missingInputHint(flag) });
  }
}
var missingInputHint = (flag) => `No file exists at the ${flag} path; relative paths resolve against the current directory. Check the path${flag === "--file" ? ", or pass --file - for stdin or --data <json>" : ""}.`;
var parseJson = (value) => {
  if (Buffer.byteLength(value) > 16 * 1024 * 1024)
    fail("INPUT_TOO_LARGE", "JSON input exceeds 16 MiB.");
  try {
    return JSON.parse(value);
  } catch {
    fail("JSON_INVALID", "Cannot parse JSON input. Pass valid JSON with double-quoted keys.");
  }
};
async function readInput(runtime, options) {
  if (!!options.data === !!options.file)
    fail("INPUT_REQUIRED", "Supply exactly one of --file <path|-> or --data <json>.");
  if (options.data) return parseJson(options.data);
  if (options.file === "-") {
    if (runtime.stdin.isTTY) fail("INPUT_REQUIRED", "Pipe JSON to stdin or pass a file path.");
    const chunks = [];
    let bytes = 0;
    for await (const chunk2 of runtime.stdin) {
      bytes += chunk2.length;
      if (bytes > 16 * 1024 * 1024) fail("INPUT_TOO_LARGE", "Input exceeds 16 MiB.");
      chunks.push(Buffer.from(chunk2));
    }
    return parseJson(Buffer.concat(chunks).toString("utf8"));
  }
  return readInputFile(path10.resolve(runtime.cwd, options.file), "--file");
}
var parseParameters = (value) => parse(z12.record(Id, NumberValue), parseJson(value));

// src/commands/discovery.ts
import { Option } from "commander";

// src/commands/procedural-catalog.ts
function proceduralCatalog(name) {
  const cli = `${name} -p <project>`;
  return {
    commands: ["scatter", "layout", "terrain add", "terrain sample"],
    recipe: "scatter (schema --kind scatter --raw). Flags compile to this recipe; every result echoes the normalized recipe and recipeHash, and --file/--data replays it.",
    determinism: "Same scene, model library, recipe and seed give the same operations, scene bytes and stateHash. Keyed PRNG (cyrb128 seed|stream -> sfc32); each candidate draws from its own stream, so exclusions never reshuffle survivors.",
    distributions: {
      poisson: "scatter --spacing <meters>: even blue noise, no two closer than spacing",
      random: "scatter --count <n>: uniform random points",
      path: 'layout --path "x,z;x,z" --spacing <meters> [--orient yaw|none]',
      grid: "layout --grid CxR --step <meters> [--jitter 0..1] [--center x,z]"
    },
    areas: ["rect:x0,z0,x1,z1", "circle:x,z,radius", "polygon:x,z;x,z;x,z[;...]"],
    defaultArea: "scatter --on <terrain> without --area or --parent covers the terrain footprint",
    grounding: "--on <heightfield node> sets each origin on the rendered surface (--sink, --max-slope). Terrain and parent chains may only translate, yaw and scale uniformly (TERRAIN_TRANSFORM). Without --on, origins sit at y 0 of the frame.",
    output: {
      ids: "<group>-1..<group>-N under one group node",
      tags: ["scatter (group)", "scatter:<recipeHash8> (group and every instance)"],
      result: "normal edit result + recipe + placement{seed, recipeHash, group, placed, candidates, rejected{outside, exclusion, slope, budget}} + nextCommands",
      regenerate: "--replace removes an existing group tagged scatter and its subtree first (any other node of that ID fails DUPLICATE_ID); rerunning the same recipe with --replace leaves the revision unchanged"
    },
    terrain: {
      presets: Object.fromEntries(
        terrainPresetNames.map((p) => [p, terrainPresets[p].description])
      ),
      defaultPreset: defaultTerrainPreset,
      creates: "mesh node <id> (tag terrain), geometry <id>_geo (heightfield), material <id>_mat",
      coloring: "Presets color by height bands through vertex colors; --color or --material makes a solid surface without bands",
      geometry: "heightfield (schema --kind geometry --raw)",
      replace: "--replace regenerates the terrain; placements keep their heights, so rerun the result.staleScatterGroups with scatter --replace"
    },
    guards: ["--dry-run", "--expected-revision", "--expected-state"],
    limits: {
      placements: PROCEDURAL_MAX_PLACEMENTS,
      candidates: PROCEDURAL_MAX_CANDIDATES,
      sceneNodes: 1e4,
      items: 32,
      exclusions: 64,
      areaPoints: 256,
      terrainResolution: HEIGHTFIELD_MAX_RESOLUTION,
      samplePoints: 256
    },
    errors: {
      DUPLICATE_ID: "group exists: --replace with guards (scatter groups only), or another --group",
      SCATTER_EMPTY: "nothing placed: read details.rejected, loosen spacing/area or --allow-empty",
      PROCEDURAL_BUDGET: "too many candidates or placements: raise spacing, shrink area, --max",
      TERRAIN_TRANSFORM: "tilted or non-uniformly scaled terrain/parent chain"
    },
    examples: [
      `${cli} terrain add ground --preset hills --size 48,48 --seed 7`,
      `${cli} terrain sample ground --at "0,0;10,-4"`,
      `${cli} scatter --model tree,rock:2 --on ground --spacing 3 --scale 0.8..1.3 --seed 42 --group forest --dry-run`,
      `${cli} layout --model post --path "-20,-20;20,-20;20,20" --spacing 2 --on ground --group fence`,
      `${cli} layout --model crate --grid 4x3 --step 1.5 --center 0,5 --group stock`,
      `${cli} scatter --file forest.scatter.json --replace --expected-revision <n> --expected-state <hash>`
    ]
  };
}

// src/commands/discovery.ts
function registerDiscoveryCommands(c) {
  const { program, output, writeOut } = c;
  program.command("catalog").description("Discover commands, geometry types, conventions and limits").action(
    () => output({
      version: VERSION,
      workflow: [
        "init",
        "apply",
        "model capture",
        "scene compose",
        "node transform",
        "validate",
        "inspect",
        "preview",
        "screenshot",
        "review",
        "audit",
        "scene pack",
        "export"
      ],
      schemas: schemaKinds,
      geometryTypes: [
        "box",
        "sphere",
        "organic",
        "cylinder",
        "cone",
        "torus",
        "capsule",
        "plane",
        "lathe",
        "extrude",
        "mesh",
        "boolean",
        "tube",
        "heightfield"
      ],
      organicForms: {
        type: "organic",
        units: "size is the untapered diameter on X/Y/Z in meters; taper and bend can extend X/Z bounds",
        parameters: {
          roundness: [0.65, 1.5],
          taper: [-0.65, 0.65],
          bend: [-0.75, 0.75],
          segments: [12, 96]
        },
        profile: {
          stations: [2, 12],
          at: [-1, 1],
          minimumHeightGap: 0.02,
          width: [0.1, 2],
          depth: [0.1, 2],
          offset: [-0.75, 0.75],
          meaning: "Optional profile stations start at -1 and end at 1. Width/depth multiply each crosssection; offset [X,Z] moves its center in half-size units. Smoothstep interpolation never overshoots; every station is sampled exactly.",
          example: [
            { at: -1, width: 1, depth: 1, offset: [0, 0] },
            { at: -0.35, width: 1.12, depth: 1.15, offset: [0, 0.12] },
            { at: 0.35, width: 0.75, depth: 0.8, offset: [0, 0] },
            { at: 1, width: 0.65, depth: 0.7, offset: [0.1, -0.08] }
          ]
        },
        meaning: "roundness 1 is ellipsoidal, below 1 is fuller; positive taper narrows the top; bend offsets both ends along +X",
        example: {
          op: "putGeometry",
          id: "plushBody",
          geometry: {
            type: "organic",
            size: [0.9, 1.1, 0.72],
            roundness: 0.9,
            taper: 0.22,
            bend: 0,
            segments: 32
          }
        },
        export: "Closed smooth mesh with seam-aware UVs. Littlewild receives baked mesh; GLB retains mesh and UVs.",
        workflow: "inspect --source, apply --dry-run with revision/state guards, apply same batch with guards, review --file previous/replay-plan.json"
      },
      surfaceDetails: {
        algorithm: "littlewild-surface-v1",
        versions: {
          1: "Original detail, default when omitted; exact replay compatibility",
          2: "Fine directional fur fibres, woven yarn and subtle leather grain"
        },
        uniqueRecipesPerScene: 256,
        pooling: "Identical version/kind/seed/scale/strength share maps across material colors; each compilation owns and disposes its pool.",
        fields: {
          kind: ["fur", "cloth", "leather"],
          version: [1, 2],
          seed: [0, 65535],
          scale: [1, 16],
          strength: [0, 1]
        },
        required: ["kind", "seed", "scale", "strength"],
        example: {
          op: "putMaterial",
          id: "plushFur",
          material: {
            color: "#c89059",
            roughness: 0.9,
            sheen: 0.65,
            sheenColor: "#ffe4bd",
            surface: { kind: "fur", seed: 7, scale: 3, strength: 0.4 }
          }
        },
        outputs: "Deterministic 128\xD7128 color and tangent normal maps; no image files, browser, shader scripts or network needed for GLB export",
        compatibility: "Standard PBR only. Littlewild preserves recipe and UVs; GLB embeds PNGs with KHR_texture_transform repeat and recipe in material extras.",
        limits: "Surface detail shades existing geometry; use organic forms or authored meshes for a fluffy silhouette. Not strand fur or cloth simulation.",
        uvFallback: "Legacy baked meshes without UVs receive local spherical projection; supply seam-aware UVs for precise placement."
      },
      composition: [
        "model capture",
        "model bundle import/export",
        "scene compose",
        "scene clone",
        "node patch/transform/duplicate/group/reparent/ground/place",
        "offline composer with guarded edit download"
      ],
      modelAuthoring: {
        tool: "bin/model-forge",
        scope: "Standalone agent-first editor for exactly one model document (<id>.model.json, or <id>.model-bundle.json with frozen nested dependencies); owns the model asset contract and the shared recipe kernel",
        discovery: "model-forge discover --compact",
        handoff: [
          "model-forge -d <document> export --format model-bundle --out <file>",
          `${program.name()} -p <project> model import --file <file> --dry-run`,
          `${program.name()} -p <project> model import --file <file> [--replace --expected-revision <n> --expected-state <hash>]`
        ],
        sceneForgeRole: "model list/inspect/import/instantiate/capture/export remain here for the project registry and scene composition"
      },
      rigging: {
        commands: ["rig inspect", "rig bind", "rig pose", "rig remove"],
        scope: "model instance",
        joints: 64,
        clips: 16,
        interpolation: "quaternion linear",
        bindings: ["nearest joint", "two-joint blend", "explicit mesh to joint"],
        export: "glTF skins and rotation clips"
      },
      littlewild: {
        commands: ["littlewild sync", "littlewild export", "littlewild import"],
        manifest: "littlewild-export (schema --kind littlewild-export)",
        importFormats: [
          "littlewild-definition",
          "littlewild-3d-asset",
          "littlewild-creature-package"
        ],
        importScope: "Visual models only; creature gameplay and companion state stay in the source package",
        importGuards: ["--expected-revision", "--expected-state"],
        importOutputs: {
          variants: "Array of imported model IDs (retained compatibility field)",
          variantModels: "Map of original source variant names to model IDs; use this instead of inferring capitalization or suffixes",
          example: { "world-round": "pipTrailWorldRound" }
        },
        families: Object.keys(littlewildFamilies),
        output: "<target>/<family>/<id>/definition.json visual facet; other facets are preserved",
        geometry: "boxes and unchanged lw-<primitive> geometries stay native; other meshes are baked",
        rig: "pets only: tag nodes rig:<role>",
        rigRoles: littlewildPetRoles,
        limits: littlewildLimits,
        check: "littlewild sync --check fails when a definition is stale"
      },
      procedural: proceduralCatalog(program.name()),
      lights: ["point", "spot", "directional"],
      materialShading: ["standard", "unlit"],
      materialDepthWrite: "Optional boolean. Use false for alpha-blended shadow decals (opacity < 1); GLB uses alphaMode BLEND.",
      physicalMaterials: {
        fields: ["sheen", "sheenColor", "sheenRoughness", "clearcoat", "clearcoatRoughness"],
        range: "Scalar fields 0..1; sheenColor #RRGGBB. Standard PBR shading only.",
        authoring: "putMaterial in apply; schema --kind material --raw",
        exports: [
          "GLB/glTF KHR_materials_sheen and KHR_materials_clearcoat",
          "Littlewild visual"
        ]
      },
      previewPresentation: {
        values: ["inspection", "portrait"],
        authoring: "setEnvironment in apply; environment.presentation in scene schema",
        scope: "Preview-only light rig and portrait shadow floor; source geometry unchanged"
      },
      previewLooks: ["filmic", "neutral", "linear"],
      patterns: ["linear", "radial", "grid", "path"],
      expressions: {
        operators: expressionOperators,
        maxDepth: 16,
        trigonometry: "degrees",
        execution: "bounded data AST; no executable code"
      },
      review: {
        command: "review",
        views: viewNames,
        outputs: [
          "individual PNGs",
          "contact-sheet.png",
          "review.json with camera settings and source hash",
          "replay-plan.json with fixed cameras"
        ],
        browserSessions: 1
      },
      examples: "example list, example show <id>, example create <id> <directory>",
      discovery: "describe [command path...] for machine-readable options and defaults",
      exports: exportFormats,
      conventions: {
        units: "meters",
        up: "Y",
        handedness: "right",
        rotation: "degrees, local XYZ Euler",
        defaultFacing: "+Z",
        profiles: "XY, extruded along +Z",
        lathe: "radius/Y profile revolved about Y"
      },
      agentContract: {
        success: "stdout: {ok:true,data}",
        error: "stderr: {ok:false,error:{code,message,details?}}; exit 1",
        input: "--file path, --file - (stdin), or --data JSON",
        mutations: "Atomic scene batches with revision and scene/library state guards; put replaces, patch merges named fields",
        idempotency: "Reapplying identical put operations does not increment revision",
        discovery: `${program.name()} schema --kind batch --raw`
      },
      limits: {
        expandedObjects: 2e4,
        expandedTriangles: 2e6,
        patternCopies: 256,
        modelDepth: 16,
        authoredLights: 32,
        shadowLights: 4,
        inputBytes: 16777216
      },
      unsupported: [
        "inverse kinematics and weight painting",
        "arbitrary GLSL shaders",
        "sculpting",
        "external texture image import and automatic UV unwrapping",
        "physics",
        "native .blend authoring",
        "native .tscn authoring",
        "mesh import",
        "arbitrary JavaScript in recipes"
      ]
    })
  );
  program.command("schema").description("Print the JSON Schema for agent-generated data").addOption(new Option("--kind <name>", "Contract").choices(schemaKinds).default("scene")).option("--raw", "Print bare JSON Schema for validators").action((opts) => {
    const schema = jsonSchema(opts.kind);
    if (opts.raw) writeOut(JSON.stringify(schema, null, 2) + "\n");
    else output(schema);
  });
}

// src/commands/projects.ts
function registerProjectsCommands(c) {
  const {
    program,
    scene,
    model,
    global,
    snapshot,
    input,
    output,
    sourceOptions: sourceOptions2,
    editOptions: editOptions2,
    at: at2,
    resolvePath
  } = c;
  program.command("init <directory>").description("Create a project with an empty main scene").option("--name <name>", "Project name").action(async (dir, opts) => output(await initProject(resolvePath(dir), opts.name)));
  scene.command("list").action(async () => {
    const s = await snapshot();
    output({ activeScene: s.manifest.activeScene, scenes: s.manifest.scenes });
  });
  scene.command("create <id>").option("--name <name>").action(async (id, opts) => output(await createScene(global().project, id, opts.name)));
  scene.command("use <id>").action(async (id) => output(await useScene(global().project, id)));
  scene.command("restore <revision>").option("--expected-revision <n>", "Current revision guard", integer).action(
    async (revision, opts) => output(
      await restoreScene(
        global().project,
        global().scene,
        integer(revision),
        opts.expectedRevision
      )
    )
  );
  model.command("list").action(async () => {
    const s = await snapshot();
    output(
      Object.entries(s.models).map(([id, m]) => ({
        id,
        name: m.name,
        category: m.category,
        description: m.description,
        parameters: m.parameters,
        path: s.manifest.models[id]
      }))
    );
  });
  editOptions2(
    sourceOptions2(
      model.command("import").description("Copy a model recipe or dependency bundle into this project")
    )
  ).option("--replace", "Replace an existing model after validating every scene").action(
    async (opts) => output(await importModel(global().project, await input(opts), opts.replace, opts))
  );
  editOptions2(
    model.command("instantiate <model> <id>").description("Place a reusable model in the scene").option("--at <x,y,z>", "Position in meters", "0,0,0").option("--parameters <json>", "Named numeric overrides", "{}").option("--parent <id>", "Parent node").option("--rotate <x,y,z>", "XYZ degrees", "0,0,0").option("--scale <x,y,z>", "Local scale", "1,1,1").option("--name <name>", "Display name")
  ).action(async (mid, id, opts) => {
    const node = parse(NodeSchema, {
      type: "model",
      id,
      name: opts.name,
      model: mid,
      parent: opts.parent,
      parameters: parseJson(opts.parameters),
      transform: { position: at2(opts.at), rotation: at2(opts.rotate), scale: at2(opts.scale) }
    });
    output(
      await commitOperations(global().project, global().scene, [{ op: "putNode", node }], opts)
    );
  });
}

// src/commands/editing.ts
function registerEditingCommands(c) {
  const { program, global, snapshot, input, output, sourceOptions: sourceOptions2, editOptions: editOptions2, at: at2 } = c;
  editOptions2(
    sourceOptions2(
      program.command("apply").description("Apply a batch transaction: {operations:[...]}")
    )
  ).action(async (opts) => {
    const batch = parse(BatchSchema, await input(opts));
    if (global().scene && batch.scene && global().scene !== batch.scene)
      fail("SCENE_MISMATCH", "Batch targets another scene.");
    if (opts.expectedRevision !== void 0 && batch.expectedRevision !== void 0 && opts.expectedRevision !== batch.expectedRevision)
      fail("GUARD_MISMATCH", "CLI revision conflicts with the batch.");
    if (opts.expectedState && batch.expectedState && opts.expectedState !== batch.expectedState)
      fail("GUARD_MISMATCH", "CLI state conflicts with the batch.");
    output(
      await commitOperations(global().project, global().scene ?? batch.scene, batch.operations, {
        ...opts,
        expectedRevision: opts.expectedRevision ?? batch.expectedRevision,
        expectedState: opts.expectedState ?? batch.expectedState
      })
    );
  });
  editOptions2(
    sourceOptions2(
      program.command("put <kind> <id>").description("Upsert a complete node, material or geometry by stable ID")
    )
  ).action(async (kind, id, opts) => {
    parse(Id, id);
    const data = await input(opts);
    let operation;
    if (kind === "node") {
      if (!data || typeof data !== "object" || Array.isArray(data))
        fail("SCHEMA_INVALID", "Node input must be an object.");
      operation = { op: "putNode", node: parse(NodeSchema, { ...data, id }) };
    } else if (kind === "geometry")
      operation = { op: "putGeometry", id, geometry: parse(GeometrySchema, data) };
    else if (kind === "material")
      operation = { op: "putMaterial", id, material: parse(MaterialSchema, data) };
    else return fail("INVALID_OPTION", "put kind must be node, geometry or material.");
    output(await commitOperations(global().project, global().scene, [operation], opts));
  });
  editOptions2(
    program.command("remove <id>").description("Remove a node").option("--cascade", "Also remove its descendants")
  ).action(
    async (id, opts) => output(
      await commitOperations(
        global().project,
        global().scene,
        [{ op: "removeNode", id, cascade: !!opts.cascade }],
        opts
      )
    )
  );
  editOptions2(
    program.command("add <type> <id>").description("Quick primitive: box, sphere, cylinder, cone, torus, capsule or plane").option("--size <x,y,z>", "Box dimensions; plane uses x,y", "1,1,1").option("--radius <n>", "Radius", Number, 0.5).option("--height <n>", "Height/length", Number, 1).option("--tube <n>", "Torus tube radius", Number, 0.15).option("--at <x,y,z>", "Position", "0,0,0").option("--rotate <x,y,z>", "XYZ degrees", "0,0,0").option("--material <id>", "Existing material; default clay is created if absent", "clay").option("--parent <id>", "Parent node")
  ).action(async (type, id, opts) => {
    parse(Id, id);
    const s = await snapshot();
    const size = at2(opts.size);
    const shapes = {
      box: { type: "box", size },
      sphere: { type: "sphere", radius: opts.radius },
      cylinder: {
        type: "cylinder",
        radiusTop: opts.radius,
        radiusBottom: opts.radius,
        height: opts.height
      },
      cone: { type: "cone", radius: opts.radius, height: opts.height },
      torus: { type: "torus", radius: opts.radius, tube: opts.tube },
      capsule: { type: "capsule", radius: opts.radius, length: opts.height },
      plane: { type: "plane", size: size.slice(0, 2) }
    };
    if (!Object.hasOwn(shapes, type))
      fail(
        "INVALID_OPTION",
        `Unsupported quick primitive ${type}. Use schema --kind geometry for advanced shapes.`
      );
    const gid = id + "_geo";
    parse(Id, gid);
    const ops = [];
    if (opts.material === "clay" && !Object.hasOwn(s.scene.materials, "clay"))
      ops.push({
        op: "putMaterial",
        id: "clay",
        material: parse(MaterialSchema, { color: "#cc9270" })
      });
    ops.push(
      { op: "putGeometry", id: gid, geometry: parse(GeometrySchema, shapes[type]) },
      {
        op: "putNode",
        node: parse(NodeSchema, {
          id,
          type: "mesh",
          geometry: gid,
          material: opts.material,
          parent: opts.parent,
          transform: { position: at2(opts.at), rotation: at2(opts.rotate) }
        })
      }
    );
    output(
      await commitOperations(global().project, global().scene, ops, {
        ...opts,
        expectedRevision: opts.expectedRevision ?? s.scene.revision
      })
    );
  });
}

// src/commands/inspection.ts
function registerInspectionCommands(c) {
  const { program, snapshot, output } = c;
  program.command("inspect").description("Inspect source data and compiled bounds/statistics").option("--id <id>", "Inspect one authored node").option("--source", "Include the complete source document").action(async (opts) => {
    const s = await snapshot();
    const built = compileScene(s.scene, s.models);
    try {
      const node = opts.id ? s.scene.nodes.find((n) => n.id === opts.id) : void 0;
      if (opts.id && !node) fail("NOT_FOUND", `Node ${opts.id} does not exist.`);
      output({
        project: s.manifest.name,
        scene: s.scene.id,
        revision: s.scene.revision,
        stateHash: s.stateHash,
        stats: built.stats,
        ...node ? { node } : {},
        ...opts.source ? { source: s.scene } : {}
      });
    } finally {
      built.dispose();
    }
  });
  program.command("validate").description("Validate schema, references, parameters and generated geometry").action(async () => {
    const s = await snapshot();
    const built = compileScene(s.scene, s.models);
    output({
      valid: true,
      scene: s.scene.id,
      revision: s.scene.revision,
      stateHash: s.stateHash,
      stats: built.stats
    });
    built.dispose();
  });
}

// src/commands/outputs.ts
import { Option as Option2 } from "commander";
import { createServer } from "node:http";
function registerOutputsCommands(c) {
  const { program, snapshot, output, resolvePath, global } = c;
  program.command("export").description("Export the current scene or one node subtree").addOption(new Option2("-f, --format <format>").choices([...exportFormats]).default("glb")).requiredOption("-o, --out <path>", "Output file").option("--validate", "Run Khronos validation; reject invalid glTF before writing").option("--node <id>", "Export one authored node at its world transform").option("--model <id>", "Export a standalone model").option("--parameters <json>", "Model parameter overrides").action(async (opts) => {
    const s = await snapshot();
    const target = authoringTarget(s.scene, s.models, {
      model: opts.model,
      node: opts.node,
      parameters: opts.parameters ? parseParameters(opts.parameters) : void 0
    });
    const result = await exportScene(target, s.models, opts.format, opts.node);
    const validation = opts.validate ? await validateExport(result.data, opts.format) : void 0;
    if (validation && validation.numErrors)
      fail(
        "EXPORT_INVALID",
        "Khronos validation rejected the export; no output was written.",
        validation
      );
    await atomicWrite(resolvePath(opts.out), result.data);
    output({
      path: resolvePath(opts.out),
      format: opts.format,
      bytes: Buffer.byteLength(result.data),
      stats: result.stats,
      warnings: result.warnings,
      validation
    });
  });
  program.command("preview").description("Generate an offline Three.js scene composer").option("--all-scenes", "Bundle all project scenes with an offline scene chooser").option("--model <id>", "Inspect one model without editing a scene").option("--node <id>", "Isolate a subtree").option("--parameters <json>", "Model parameter overrides").option("-o, --out <path>", "Output HTML", "preview.html").option("--serve", "Serve on localhost and rebuild on page refresh").option("--port <port>", "Local port; 0 chooses an available port", integer, 0).action(async (opts) => {
    if (opts.allScenes && (opts.model || opts.node || opts.parameters))
      fail(
        "INVALID_OPTION",
        "--all-scenes cannot be combined with a model, node or parameter target."
      );
    const buildPage = async () => {
      if (opts.allScenes) {
        const project = await loadProjectScenes(global().project);
        return createProjectPreview(
          project.scenes,
          project.models,
          global().scene ?? project.manifest.activeScene
        );
      }
      const s = await snapshot();
      return createPreview(
        authoringTarget(s.scene, s.models, {
          model: opts.model,
          node: opts.node,
          parameters: opts.parameters ? parseParameters(opts.parameters) : void 0
        }),
        s.models,
        { stateHash: s.stateHash, editable: !opts.model && !opts.node }
      );
    };
    const html = await buildPage();
    await atomicWrite(resolvePath(opts.out), html);
    if (!opts.serve) {
      output({ path: resolvePath(opts.out), offline: true });
      return;
    }
    if (opts.port > 65535) fail("INVALID_OPTION", "Port must be between 0 and 65535.");
    const server = createServer(async (req, res) => {
      if (!["/", "/index.html"].includes(new URL(req.url ?? "/", "http://localhost").pathname)) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      try {
        const page = await buildPage();
        res.writeHead(200, {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store"
        });
        res.end(page);
      } catch (error) {
        res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Scene build failed: " + errorMessage(error));
      }
    });
    await new Promise((resolve, reject2) => {
      server.once("error", reject2);
      server.listen(opts.port, "127.0.0.1", () => resolve());
    });
    output({
      path: resolvePath(opts.out),
      url: `http://127.0.0.1:${server.address().port}`,
      rebuild: "Refresh the browser after editing the scene. Ctrl+C stops the server."
    });
    process.once("SIGINT", () => server.close());
    process.once("SIGTERM", () => server.close());
  });
  program.command("screenshot").description("Render a PNG through headless Chromium").option("--model <id>", "Capture a standalone model").option("--node <id>", "Isolate one authored subtree").option("--parameters <json>", "Model parameter overrides").option("--azimuth <degrees>", "Orbit camera azimuth, used with --view orbit", Number, 45).option("--elevation <degrees>", "Orbit camera elevation", Number, 30).addOption(
    new Option2("--projection <type>").choices(["auto", "perspective", "orthographic"]).default("auto")
  ).option("--padding <factor>", "Framing margin", Number, 1.12).option("--wireframe", "Capture wireframe").requiredOption("-o, --out <path>", "PNG path").option("--width <px>", "Image width", integer, 1600).option("--height <px>", "Image height", integer, 1e3).addOption(new Option2("--view <view>").choices([...viewNames]).default("iso")).option("--grid", "Include the ground grid").option("--ui", "Capture the full preview interface").action(async (opts) => {
    if (opts.width < 64 || opts.height < 64 || opts.width > 4096 || opts.height > 4096)
      fail("INVALID_OPTION", "Screenshot dimensions must be between 64 and 4096 pixels.");
    const s = await snapshot();
    const target = authoringTarget(s.scene, s.models, {
      model: opts.model,
      node: opts.node,
      parameters: opts.parameters ? parseParameters(opts.parameters) : void 0
    });
    if (opts.view === "authored" && !target.camera)
      fail("INVALID_CAMERA", "No authored camera is defined.");
    const html = await createPreview(target, s.models, {
      stateHash: s.stateHash,
      editable: !opts.model && !opts.node,
      includeLibrary: !!opts.ui
    });
    output(
      await screenshot(html, opts.out, {
        width: opts.width,
        height: opts.height,
        view: opts.view,
        grid: !!opts.grid,
        ui: !!opts.ui,
        camera: {
          azimuth: opts.azimuth,
          elevation: opts.elevation,
          projection: opts.projection,
          padding: opts.padding
        },
        wireframe: !!opts.wireframe
      })
    );
  });
}

// src/commands/runtime.ts
import { promises as fs9 } from "node:fs";
async function exists(file) {
  try {
    await fs9.access(file);
    return true;
  } catch {
    return false;
  }
}
async function probe() {
  try {
    return await loadPlaywright();
  } catch (error) {
    if (error instanceof ForgeError) return error;
    throw error;
  }
}
function registerRuntimeCommands(c) {
  const { program, output } = c;
  program.command("doctor").description("Check runtime, Playwright and Chromium installation").action(async () => {
    const playwright = await probe();
    if (playwright instanceof ForgeError) {
      const browser2 = process.env.FORGE_CHROMIUM_PATH;
      return output({
        node: process.version,
        playwright: { installed: false, details: playwright.details },
        chromium: { path: browser2 ?? null, installed: browser2 ? await exists(browser2) : false },
        screenshotSetup: playwrightRemedies.join(" ")
      });
    }
    const browser = process.env.FORGE_CHROMIUM_PATH ?? playwright.module.chromium.executablePath();
    const available = await exists(browser);
    output({
      node: process.version,
      playwright: { installed: true, resolvedFrom: playwright.resolvedFrom },
      chromium: { path: browser, installed: available },
      screenshotSetup: available ? "Run a screenshot to verify OS libraries and WebGL." : "Run npx playwright install chromium, or npx playwright install --with-deps chromium on Linux."
    });
  });
}

// src/commands/composition.ts
import { Option as Option3 } from "commander";
function registerCompositionCommands(c) {
  const { program, scene, model, global, snapshot, output, input, sourceOptions: sourceOptions2, editOptions: editOptions2, at: at2 } = c;
  scene.command("clone <id>").description("Copy the selected scene under a new ID").option("--name <name>").action(
    async (id, opts) => output(await cloneScene(global().project, global().scene, id, opts.name))
  );
  editOptions2(
    sourceOptions2(
      scene.command("compose").description("Place model instances from a declarative composition recipe")
    )
  ).action(async (opts) => {
    const recipe = parse(CompositionSchema, await input(opts));
    const target = global().scene ?? recipe.scene;
    if (global().scene && recipe.scene && global().scene !== recipe.scene)
      fail("SCENE_MISMATCH", "Composition targets another scene.");
    if (opts.expectedRevision !== void 0 && recipe.expectedRevision !== void 0 && opts.expectedRevision !== recipe.expectedRevision)
      fail("GUARD_MISMATCH", "CLI revision conflicts with the recipe revision.");
    if (opts.expectedState && recipe.expectedState && opts.expectedState !== recipe.expectedState)
      fail("GUARD_MISMATCH", "CLI state conflicts with the recipe state.");
    const operations = [...recipe.groups, ...recipe.instances].map((node2) => ({
      op: "putNode",
      node: node2
    }));
    output(
      await commitOperations(global().project, target, operations, {
        ...opts,
        expectedRevision: opts.expectedRevision ?? recipe.expectedRevision,
        expectedState: opts.expectedState ?? recipe.expectedState
      })
    );
  });
  editOptions2(
    model.command("capture <id>").description("Create a reusable model from selected scene nodes").requiredOption("--nodes <ids>", "Comma-separated root IDs").option("--name <name>").option("--replace", "Replace an existing model after dependency validation")
  ).action(
    async (id, opts) => output(
      await captureProjectModel(
        global().project,
        global().scene,
        opts.nodes.split(",").map((v) => v.trim()),
        id,
        opts.name,
        opts.replace,
        opts
      )
    )
  );
  model.command("export <id>").description("Export a portable model bundle including nested model dependencies").requiredOption("-o, --out <path>").action(async (id, opts) => {
    const s = await snapshot();
    const models = modelDependencies(s.models, id);
    await writeJson(c.resolvePath(opts.out), {
      schemaVersion: 1,
      kind: "model-bundle",
      entry: id,
      models
    });
    output({ path: opts.out, entry: id, models: Object.keys(models) });
  });
  model.command("inspect <id>").description("Inspect a model, parameters, dimensions and dependencies").option("--parameters <json>", "Inspect a parameter variant").action(async (id, opts) => {
    const s = await snapshot();
    const library = modelDependencies(s.models, id);
    const built = compileScene(
      parse(SceneSchema, {
        schemaVersion: 1,
        kind: "scene",
        id: "model",
        name: s.models[id].name,
        nodes: [
          {
            type: "model",
            id: "root",
            model: id,
            parameters: opts.parameters ? await input({ data: opts.parameters }) : {}
          }
        ]
      }),
      library
    );
    try {
      output({
        model: s.models[id],
        dependencies: Object.keys(library).filter((mid) => mid !== id),
        stats: built.stats
      });
    } finally {
      built.dispose();
    }
  });
  const node = program.command("node").description("Compose a scene with transforms, groups and relative placement");
  const commit = async (op, opts) => output(
    await commitOperations(global().project, global().scene, [parse(OperationSchema, op)], opts)
  );
  editOptions2(
    node.command("transform <id>").description("Update selected local transform components").option("--at <x,y,z>").option("--rotate <x,y,z>").option("--scale <x,y,z>")
  ).action(async (id, opts) => {
    const transform2 = {};
    if (opts.at) transform2.position = at2(opts.at);
    if (opts.rotate) transform2.rotation = at2(opts.rotate);
    if (opts.scale) transform2.scale = at2(opts.scale);
    if (!Object.keys(transform2).length)
      fail("INPUT_REQUIRED", "Provide --at, --rotate or --scale.");
    await commit({ op: "patchNode", id, patch: { transform: transform2 } }, opts);
  });
  editOptions2(
    sourceOptions2(
      node.command("patch <id>").description("Change name, visibility, tags, transform or model overrides")
    )
  ).action(
    async (id, opts) => commit({ op: "patchNode", id, patch: parse(NodePatchSchema, await input(opts)) }, opts)
  );
  editOptions2(
    node.command("duplicate <id> <newId>").description("Duplicate a whole authored subtree").option("--offset <x,y,z>", "Local offset", "0,0,0")
  ).action(
    async (id, newId, opts) => commit({ op: "duplicateNode", id, newId, offset: at2(opts.offset) }, opts)
  );
  editOptions2(
    node.command("group <id>").description("Group sibling nodes without moving them").requiredOption("--nodes <ids>").option("--name <name>")
  ).action(
    async (id, opts) => commit(
      {
        op: "groupNodes",
        id,
        nodes: opts.nodes.split(",").map((v) => v.trim()),
        name: opts.name
      },
      opts
    )
  );
  editOptions2(
    node.command("reparent <id>").description("Move under a parent or to scene root; preserve world placement by default").option("--parent <id>").option("--local", "Keep local transform instead of preserving world placement")
  ).action(
    async (id, opts) => commit({ op: "reparentNode", id, parent: opts.parent ?? null, keepWorld: !opts.local }, opts)
  );
  editOptions2(
    node.command("ground <id>").description("Place the bottom of a subtree on a world Y plane").option("--y <number>", "World Y", Number, 0)
  ).action(async (id, opts) => commit({ op: "groundNode", id, y: opts.y }, opts));
  editOptions2(
    node.command("place <id>").description("Place an object beside another using world-space bounds").requiredOption("--to <id>", "Target object").addOption(
      new Option3("--side <side>").choices(["right", "left", "front", "back", "above", "below"]).default("right")
    ).option("--gap <meters>", "Gap between bounds", Number, 0).option("--keep-other-axes", "Do not center along the other axes")
  ).action(
    async (id, opts) => commit(
      {
        op: "placeNode",
        id,
        target: opts.to,
        side: opts.side,
        gap: opts.gap,
        center: !opts.keepOtherAxes
      },
      opts
    )
  );
}

// src/commands/agent.ts
import { Option as Option4 } from "commander";
var filterOptions = (cmd) => cmd.option("--ids <ids>", "Comma-separated authored node IDs").option("--tag <tag>").addOption(new Option4("--type <type>").choices(["group", "mesh", "model", "light"])).option("--model <id>").option("--parent <id>", "Direct parent ID").option("--root", "Only nodes at the scene root");
var selector = (o) => {
  if (o.parent && o.root) fail("INVALID_OPTION", "--root conflicts with --parent.");
  return parse(SelectorSchema, {
    ids: o.ids?.split(",").map((s) => s.trim()),
    tag: o.tag,
    type: o.type,
    model: o.model,
    parent: o.root ? null : o.parent
  });
};
function commandDescription(command, prefix = "") {
  const path13 = [prefix, command.name()].filter(Boolean).join(" ");
  return {
    command: path13,
    description: command.description(),
    arguments: command.registeredArguments.map((a) => ({
      name: a.name(),
      description: a.description,
      required: a.required,
      variadic: a.variadic,
      default: a.defaultValue,
      choices: a.argChoices
    })),
    options: command.options.map((o) => ({
      flags: o.flags,
      description: o.description,
      required: o.mandatory,
      valueRequired: o.required,
      default: o.defaultValue,
      choices: o.argChoices
    })),
    subcommands: command.commands.map((c) => commandDescription(c, path13))
  };
}
function registerAgentCommands(c) {
  const { program, scene, snapshot, global, output, input, sourceOptions: sourceOptions2, editOptions: editOptions2 } = c;
  program.command("describe [path...]").description("Machine-readable command arguments, flags, defaults and choices").action((parts) => {
    let command = program, prefix = "";
    for (const part of parts) {
      const child = command.commands.find((c2) => c2.name() === part);
      if (!child)
        fail("NOT_FOUND", `Unknown command ${part}.`, {
          available: command.commands.map((c2) => c2.name())
        });
      prefix = [prefix, command.name()].filter(Boolean).join(" ");
      command = child;
    }
    output(commandDescription(command, prefix));
  });
  const node = program.commands.find((c2) => c2.name() === "node");
  filterOptions(
    node.command("list").description("Query authored nodes with optional world bounds and pagination")
  ).option("--details", "Include source, world matrix, bounds and subtree statistics").option("--limit <n>", "Maximum rows (1\u20131000)", Number, 100).option("--offset <n>", "Start row", Number, 0).action(async (opts) => {
    if (!Number.isInteger(opts.limit) || opts.limit < 1 || opts.limit > 1e3 || !Number.isInteger(opts.offset) || opts.offset < 0)
      fail("INVALID_OPTION", "Use limit 1\u20131000 and a nonnegative integer offset.");
    const s = await snapshot(), nodes2 = inspectNodes(s.scene, s.models, selector(opts), !!opts.details);
    output({
      scene: s.scene.id,
      revision: s.scene.revision,
      stateHash: s.stateHash,
      total: nodes2.length,
      offset: opts.offset,
      nodes: nodes2.slice(opts.offset, opts.offset + opts.limit),
      nextOffset: opts.offset + opts.limit < nodes2.length ? opts.offset + opts.limit : null
    });
  });
  editOptions2(
    sourceOptions2(
      filterOptions(
        node.command("edit").description("Patch every matching authored node in one transaction")
      )
    )
  ).action(async (opts) => {
    if (!opts.ids && !opts.tag && !opts.type && !opts.model && !opts.parent && !opts.root)
      fail("INPUT_REQUIRED", "Use a selector such as --ids, --tag or --type for bulk edits.");
    output(
      await commitOperations(
        global().project,
        global().scene,
        [
          {
            op: "patchNodes",
            selector: selector(opts),
            patch: parse(NodePatchSchema, await input(opts))
          }
        ],
        opts
      )
    );
  });
  scene.command("pack").description("Export editable scene source with all nested model dependencies").requiredOption("-o, --out <file>").action(async (opts) => {
    const s = await snapshot(), bundle = packScene(s.scene, s.models);
    await writeJson(c.resolvePath(opts.out), bundle);
    output({
      path: opts.out,
      scene: bundle.scene.id,
      models: Object.keys(bundle.models),
      sourceStateHash: s.stateHash
    });
  });
  sourceOptions2(
    scene.command("unpack <directory>").description("Restore a scene bundle into a new self-contained project")
  ).action(
    async (directory, opts) => output(await unpackScene(c.resolvePath(directory), await input(opts)))
  );
  sourceOptions2(
    program.command("audit").description("Check visible geometry and project-specific quality budgets")
  ).option("--model <id>", "Audit a standalone model").option("--node <id>", "Audit one subtree at its world transform").option("--parameters <json>", "Model parameter overrides").option("--strict", "Treat quality warnings as failures").action(async (opts) => {
    const s = await snapshot();
    const parameters = opts.parameters ? parseParameters(opts.parameters) : void 0;
    const target = authoringTarget(s.scene, s.models, {
      model: opts.model,
      node: opts.node,
      parameters
    });
    const policy = opts.file || opts.data ? parse(QualityPolicySchema, await input(opts)) : {};
    const report = { ...auditScene(target, s.models, policy), sourceStateHash: s.stateHash };
    if (opts.strict && report.summary.warnings) report.passed = false;
    if (!report.passed)
      fail(
        "QUALITY_GATE_FAILED",
        "The visible deliverable did not pass the quality gate.",
        report
      );
    output(report);
  });
  program.command("review").description(
    "Capture multiple perspectives in one browser session, with a PNG contact sheet and camera manifest"
  ).requiredOption("-o, --out <directory>").option("--file <path>", "Data-driven review plan; use - for stdin").option("--views <names>", "Comma-separated views; default iso,front,right,back,left,top").option("--turntable <count>", "Evenly spaced orbit views (2\u201336)", Number).option("--elevation <degrees>", "Turntable elevation", Number, 25).option("--width <px>", "Frame width (64\u20132048)", Number, 800).option("--height <px>", "Frame height (64\u20132048)", Number, 600).addOption(
    new Option4("--projection <type>").choices(["auto", "perspective", "orthographic"]).default("auto")
  ).option("--padding <factor>", "Framing margin (1.02\u20133)", Number, 1.12).option("--grid").option("--wireframe").option("--no-contact-sheet").option("--overwrite", "Replace named outputs in an existing directory").option("--model <id>").option("--node <id>").option("--parameters <json>", "Model parameter overrides").option("--background <hex>", "Background color, #rrggbb").action(async (opts, command) => {
    let plan;
    if (opts.file) {
      for (const name of [
        "views",
        "turntable",
        "elevation",
        "width",
        "height",
        "projection",
        "padding",
        "grid",
        "wireframe",
        "contactSheet"
      ])
        if (command.getOptionValueSource(name) === "cli")
          fail(
            "INVALID_OPTION",
            `--file cannot be combined with review setting ${name}; set it in the plan.`
          );
      plan = parse(ReviewPlanSchema, await input(opts));
    } else {
      if (opts.views && opts.turntable !== void 0)
        fail("INVALID_OPTION", "Choose --views or --turntable.");
      if (opts.turntable !== void 0 && (!Number.isInteger(opts.turntable) || opts.turntable < 2 || opts.turntable > 36))
        fail("INVALID_OPTION", "Turntable count must be an integer from 2 to 36.");
      const frames = opts.turntable !== void 0 ? Array.from({ length: opts.turntable }, (_, i) => ({
        id: `orbit-${String(i).padStart(2, "0")}`,
        camera: {
          view: "orbit",
          azimuth: i * 360 / opts.turntable,
          elevation: opts.elevation,
          projection: opts.projection,
          padding: opts.padding
        }
      })) : (opts.views ?? "iso,front,right,back,left,top").split(",").map((view) => ({
        id: view.trim(),
        camera: { view: view.trim(), projection: opts.projection, padding: opts.padding }
      }));
      plan = parse(ReviewPlanSchema, {
        schemaVersion: 1,
        kind: "review",
        width: opts.width,
        height: opts.height,
        grid: !!opts.grid,
        wireframe: !!opts.wireframe,
        contactSheet: opts.contactSheet,
        frames
      });
    }
    const s = await snapshot();
    const parameters = opts.parameters ? parseParameters(opts.parameters) : void 0;
    const target = authoringTarget(s.scene, s.models, {
      model: opts.model,
      node: opts.node,
      parameters
    });
    if (opts.background)
      target.environment = { ...target.environment, background: opts.background };
    output(
      await reviewScene(target, s.models, c.resolvePath(opts.out), plan, {
        overwrite: opts.overwrite,
        sourceStateHash: s.stateHash,
        target: opts.model ? { model: opts.model, parameters: parameters ?? {} } : opts.node ? { scene: s.scene.id, node: opts.node } : { scene: s.scene.id }
      })
    );
  });
}

// src/commands/littlewild.ts
import path11 from "node:path";
import { Option as Option5 } from "commander";

// src/infra/littlewild-import.ts
async function importLittlewildDefinition(project, file, input, options) {
  const record = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const isPackage = record.format === "littlewild-creature-package";
  if (isPackage && record.schemaVersion !== 1)
    fail("LITTLEWILD_IMPORT", "Expected a version 1 littlewild-creature-package.");
  const visual = isPackage ? record.appearanceManifest : record.format === "littlewild-definition" ? record.visual : record;
  if (!visual || typeof visual !== "object" || Array.isArray(visual))
    fail("LITTLEWILD_IMPORT", `${file} has no visual facet to import.`);
  const { models, variantModels } = littlewildImportPlan(
    visual,
    options.prefix
  );
  const entry = Object.keys(models)[0];
  const result = await importModel(
    project,
    { schemaVersion: 1, kind: "model-bundle", entry, models },
    options.replace,
    options
  );
  return {
    ...result,
    source: file,
    sourceFormat: record.format,
    importedFacet: "visual",
    variants: Object.keys(models),
    variantModels,
    ...isPackage ? {
      warnings: [
        "Only appearance models are imported. Gameplay, companion state, behavior mappings and rig bindings remain in the source creature package."
      ]
    } : {}
  };
}

// src/commands/littlewild.ts
function registerLittlewildCommands(c) {
  const { program, snapshot, output, resolvePath, global, editOptions: editOptions2 } = c;
  const group = program.command("littlewild").description("Exchange models with Littlewild engine definitions");
  group.command("sync").description("Export every asset in a littlewild-export manifest into Littlewild definitions").requiredOption("--file <path>", "littlewild.export.json manifest").option("--asset <id>", "Export only one asset from the manifest").option("--dry-run", "Compile and compare without writing").option("--check", "Fail when any definition is out of date; never writes").action(async (opts) => {
    const file = resolvePath(opts.file), manifest = parse(LittlewildExportSchema, await readInputFile(file, "--file")), target = path11.resolve(path11.dirname(file), manifest.target), s = await snapshot();
    const assets = manifest.assets.filter((a) => !opts.asset || a.id === opts.asset);
    if (!assets.length) fail("NOT_FOUND", `Asset ${opts.asset} is not in the manifest.`);
    const results = [];
    for (const asset of assets)
      results.push(
        await writeLittlewildAsset(
          asset,
          s.models,
          path11.join(target, asset.family, asset.id, "definition.json"),
          { dryRun: opts.dryRun, check: opts.check }
        )
      );
    const stale = results.filter((r) => r.changed).map((r) => r.id);
    if (opts.check && stale.length)
      fail(
        "LITTLEWILD_STALE",
        "Littlewild definitions differ from their Scene Forge recipes. Run littlewild sync.",
        { stale }
      );
    output({ target, assets: results, stale });
  });
  group.command("export").description("Export one model as a Littlewild definition model variant").requiredOption("--model <id>", "Scene Forge model to export").requiredOption("--out <path>", "Littlewild <family>/<id>/definition.json to create or update").addOption(
    new Option5(
      "--family <family>",
      "Littlewild family; defaults to the <family> directory of --out, else items"
    ).choices(["items", "buildings", "creatures", "pets"])
  ).option("--variant <name>", "Littlewild model variant", "world").option(
    "--name <name>",
    "Display name; defaults to an existing definition's name, else the model name"
  ).option("--parameters <json>", "Model parameter overrides").option("--materials <json>", "Inline material replacements keyed by model material ID").option("--dry-run", "Compile and compare without writing").action(async (opts) => {
    const s = await snapshot(), out = resolvePath(opts.out), model = s.models[opts.model];
    if (!model) fail("NOT_FOUND", `Model ${opts.model} does not exist.`);
    const identity2 = await littlewildExportIdentity(out, {
      family: opts.family,
      name: opts.name,
      fallbackName: model.name
    });
    const asset = parse(LittlewildAssetSchema, {
      ...identity2,
      models: {
        [opts.variant]: {
          model: opts.model,
          parameters: opts.parameters ? parseJson(opts.parameters) : {},
          materials: opts.materials ? parseJson(opts.materials) : {}
        }
      }
    });
    output(await writeLittlewildAsset(asset, s.models, out, { dryRun: opts.dryRun }));
  });
  editOptions2(group.command("import")).description(
    "Import visuals as editable models; returns variants (model IDs) and variantModels (source variant \u2192 model ID)"
  ).requiredOption(
    "--definition <path>",
    "Littlewild definition, creature package or 3D asset JSON"
  ).option("--prefix <id>", "Model ID prefix; defaults to the camel-cased asset ID").option("--replace", "Replace existing models with the same IDs").action(async (opts) => {
    const definition = resolvePath(opts.definition);
    output(
      await importLittlewildDefinition(
        global().project,
        definition,
        await readInputFile(definition, "--definition"),
        {
          prefix: opts.prefix,
          dryRun: opts.dryRun,
          replace: opts.replace,
          expectedRevision: opts.expectedRevision,
          expectedState: opts.expectedState
        }
      )
    );
  });
}

// src/commands/procedural.ts
import { Option as Option6 } from "commander";

// src/domain/procedural.ts
function required(message, hint) {
  throw Object.assign(new ForgeError("INPUT_REQUIRED", message), { hint });
}
var invalid = (flag, expected, value) => fail("INVALID_OPTION", `${flag} expects ${expected}, got ${JSON.stringify(value)}.`, {
  flag,
  value
});
function numbersOf(text, flag, expected, count) {
  const parts = text.split(",");
  const values = parts.map(Number);
  if (parts.some((part) => !part.trim()) || values.some((n) => !Number.isFinite(n)) || count !== void 0 && values.length !== count)
    invalid(flag, expected, text);
  return values;
}
function parsePoints(text, flag, minimum = 1) {
  const points = text.split(";").map((part) => numbersOf(part, flag, "semicolon-separated x,z points", 2));
  if (points.length < minimum) invalid(flag, `at least ${minimum} x,z points`, text);
  return points;
}
function parseRange(text, flag) {
  const parts = text.split("..");
  const [low, high] = parts.map((part) => part.trim() ? Number(part) : NaN);
  const range2 = [low, parts.length === 1 ? low : high];
  if (parts.length > 2 || range2.some((v) => !Number.isFinite(v)) || range2[0] > range2[1])
    invalid(flag, "a range min..max (or one value)", text);
  return range2;
}
function parseArea(text, flag = "--area") {
  const [type, body = ""] = text.split(/:(.*)/s);
  if (type === "rect") {
    const [x0, z0, x1, z1] = numbersOf(body, flag, "rect:x0,z0,x1,z1", 4);
    return {
      type: "rect",
      min: [Math.min(x0, x1), Math.min(z0, z1)],
      max: [Math.max(x0, x1), Math.max(z0, z1)]
    };
  }
  if (type === "circle") {
    const [x, z13, radius] = numbersOf(body, flag, "circle:x,z,radius", 3);
    return { type: "circle", center: [x, z13], radius };
  }
  if (type === "polygon") return { type: "polygon", points: parsePoints(body, flag, 3) };
  return invalid(flag, "rect:x0,z0,x1,z1, circle:x,z,r or polygon:x,z;x,z;x,z", text);
}
function parseItems(text) {
  return text.split(",").map((entry) => {
    const [model, weight] = entry.trim().split(":");
    if (!model) invalid("--model", "model IDs, optionally weighted as id:weight", text);
    if (weight === void 0) return { model };
    const value = Number(weight);
    if (!weight.trim() || !(value > 0)) invalid("--model", "a positive weight after id:", text);
    return { model, weight: value };
  });
}
function parseGrid(text) {
  const match = /^(\d+)x(\d+)$/i.exec(text.trim());
  const counts = match ? [Number(match[1]), Number(match[2])] : void 0;
  if (!counts || counts.some((n) => n < 1))
    return invalid("--grid", "COLUMNSxROWS such as 4x3", text);
  return counts;
}
var recipeFlags = [
  "model",
  "area",
  "spacing",
  "count",
  "parent",
  "on",
  "sink",
  "maxSlope",
  "scale",
  "yaw",
  "tilt",
  "max",
  "exclude",
  "avoid",
  "margin"
];
function common(flags, defaultGroup, defaultYaw) {
  if (!flags.model)
    required(
      "Pass --model <id[,id:weight...]> or a recipe --file.",
      "Run model list for the registered model IDs; weight them as id:weight."
    );
  const items = parseItems(flags.model);
  if ((flags.sink !== void 0 || flags.maxSlope !== void 0) && !flags.on)
    fail("INVALID_OPTION", "--sink and --max-slope apply only with --on <terrain node>.");
  if (flags.margin !== void 0 && !flags.avoid)
    fail("INVALID_OPTION", "--margin applies only with --avoid <ids>.");
  const yaw = flags.yaw ? parseRange(flags.yaw, "--yaw") : defaultYaw;
  const tilt = flags.tilt ? parseRange(flags.tilt, "--tilt") : void 0;
  return {
    schemaVersion: 1,
    kind: "scatter",
    ...flags.seed !== void 0 ? { seed: flags.seed } : {},
    group: flags.group ?? `${items[0].model.slice(0, 48)}-${defaultGroup}`,
    ...flags.parent ? { parent: flags.parent } : {},
    ...flags.exclude?.length ? { exclude: flags.exclude.map((a) => parseArea(a, "--exclude")) } : {},
    ...flags.avoid ? {
      avoidNodes: {
        ids: flags.avoid.split(",").map((id) => id.trim()),
        ...flags.margin !== void 0 ? { margin: flags.margin } : {}
      }
    } : {},
    ...flags.max !== void 0 ? { maxCount: flags.max } : {},
    items,
    ...flags.scale ? { scale: parseRange(flags.scale, "--scale") } : {},
    ...yaw || tilt ? { rotation: { ...yaw ? { yaw } : {}, ...tilt ? { tilt } : {} } } : {},
    ...flags.on ? {
      ground: {
        mode: "terrain",
        node: flags.on,
        ...flags.sink !== void 0 ? { sink: flags.sink } : {},
        ...flags.maxSlope !== void 0 ? { maxSlope: flags.maxSlope } : {}
      }
    } : {}
  };
}
function terrainFootprint(scene, node) {
  const [sx, sz] = terrainSpec(scene, node).size;
  const frame = nodeFrame(scene, node, "terrain");
  const corners = [
    [-sx / 2, -sz / 2],
    [sx / 2, -sz / 2],
    [sx / 2, sz / 2],
    [-sx / 2, sz / 2]
  ].map(([x, z13]) => {
    const p = applySimilarity(frame, [x, 0, z13]);
    return [p[0], p[2]];
  });
  if (Math.abs(frame.yaw % (2 * Math.PI)) > 1e-12) return { type: "polygon", points: corners };
  return { type: "rect", min: corners[0], max: corners[2] };
}
function scatterRecipe(flags, scene) {
  if (flags.spacing === void 0 === (flags.count === void 0))
    required(
      "Pass exactly one of --spacing <meters> (even blue noise) or --count <n>.",
      "Use --spacing for an even natural spread; use layout for paths and grids."
    );
  let area;
  if (flags.area) area = parseArea(flags.area);
  else if (flags.on && !flags.parent) area = terrainFootprint(scene, flags.on);
  else
    return required(
      "Pass --area rect:x0,z0,x1,z1|circle:x,z,r|polygon:x,z;...",
      "--area may be omitted only with --on <terrain> and no --parent: it then covers the terrain."
    );
  return {
    ...common(flags, "scatter"),
    area,
    distribution: flags.spacing !== void 0 ? { type: "poisson", minDistance: flags.spacing } : { type: "random", count: flags.count }
  };
}
function layoutRecipe(flags) {
  if (!!flags.path === !!flags.grid)
    required(
      'Pass exactly one of --path "x,z;x,z;..." or --grid COLUMNSxROWS.',
      "A path places along a polyline with --spacing; a grid places COLUMNSxROWS with --step."
    );
  if (flags.path) {
    if (flags.spacing === void 0)
      required(
        "--path needs --spacing <meters>.",
        "Pass --spacing: the distance between placements."
      );
    if (flags.step || flags.jitter !== void 0 || flags.center)
      fail("INVALID_OPTION", "--step, --jitter and --center apply only to --grid.");
    return {
      ...common(flags, "layout", [0, 0]),
      distribution: {
        type: "path",
        points: parsePoints(flags.path, "--path", 2),
        spacing: flags.spacing,
        orient: flags.orient ?? "yaw"
      }
    };
  }
  if (flags.spacing !== void 0 || flags.orient)
    fail("INVALID_OPTION", "--spacing and --orient apply only to --path; use --step for --grid.");
  if (!flags.step)
    return required(
      "--grid needs --step <meters>.",
      "Pass --step s: COLUMNSxROWS placements spaced s apart on both axes."
    );
  const steps = numbersOf(flags.step, "--step", "one spacing s, or s,s", void 0);
  if (steps.length > 2 || steps.some((s) => !(s > 0)) || steps[0] !== steps.at(-1))
    throw Object.assign(
      new ForgeError("INVALID_OPTION", "Grid layouts use one positive step on both axes.", {
        step: flags.step
      }),
      { hint: "Pass --step s. For different row spacing, lay out each row with --path." }
    );
  const [columns, rows] = parseGrid(flags.grid);
  const step = steps[0];
  const [cx, cz] = flags.center ? numbersOf(flags.center, "--center", "x,z", 2) : [0, 0];
  return {
    ...common(flags, "layout", [0, 0]),
    area: gridArea(columns, rows, step, [cx, cz]),
    distribution: {
      type: "grid",
      step,
      ...flags.jitter !== void 0 ? { jitter: flags.jitter } : {}
    }
  };
}

// src/commands/procedural.ts
var numeric = (value) => {
  const n = Number(value);
  if (!value.trim() || !Number.isFinite(n))
    fail("INVALID_OPTION", `Expected a number, got ${JSON.stringify(value)}.`);
  return n;
};
var collect2 = (value, previous = []) => [...previous, value];
var placementHints = {
  DUPLICATE_ID: "The group (or one of its <group>-<n> IDs) exists. Pass --replace with --expected-revision/--expected-state to regenerate the group, or choose another --group.",
  SCATTER_EMPTY: "Nothing was placed; read details.rejected. Lower --spacing, widen --area, relax --max-slope, --exclude or --avoid/--margin, or pass --allow-empty.",
  PROCEDURAL_BUDGET: "Raise --spacing or --step, shrink --area or the path, or lower --max/--count. Limits: catalog procedural.limits."
};
var replaceHints = {
  ...placementHints,
  DUPLICATE_ID: "Choose another --group. --replace regenerates only a group tagged scatter (made by scatter or layout), never other content of that ID, and its <group>-<n> IDs must be free."
};
var placementOptions = (cmd) => cmd.option(
  "--seed <n>",
  "Seed 0..4294967295; the same seed replays identically (default 1)",
  integer
).option("--group <id>", "Group node owning the placements <group>-<n>").option("--parent <id>", "Existing parent node; x,z coordinates are in its frame").option("--on <node>", "Ground every placement on this heightfield terrain node").option("--sink <meters>", "With --on: sink origins below the surface", numeric).option("--max-slope <degrees>", "With --on: reject steeper ground (0-90)", numeric).option("--scale <min..max>", "Uniform scale range, or one value").option("--yaw <min..max>", "Yaw range in degrees, or one value").option("--tilt <min..max>", "Tilt range about X and Z in degrees, or one value (default 0)").option("--max <n>", "Keep at most n placements (keyed subset)", integer).option("--exclude <area>", "Keep-out area (repeatable), same syntax as --area", collect2).option("--avoid <ids>", "Keep clear of these nodes' XZ bounds").option("--margin <meters>", "With --avoid: extra clearance", numeric).option("--replace", "Regenerate: remove an existing scatter group of the same ID first").option("--allow-empty", "Write an empty group instead of failing with SCATTER_EMPTY");
function registerProceduralCommands(c) {
  const { program, global, output, input, sourceOptions: sourceOptions2, editOptions: editOptions2, snapshot } = c;
  const name = program.name();
  async function place(opts, recipeOf) {
    const { project, scene } = global();
    const result = await commitPlanned(
      project,
      scene,
      (s) => {
        try {
          const plan = planScatter(s.scene, s.models, recipeOf(s.scene), {
            replace: !!opts.replace,
            allowEmpty: !!opts.allowEmpty
          });
          return {
            operations: plan.operations,
            report: { recipe: plan.recipe, placement: plan.placement }
          };
        } catch (error) {
          throw withHint(error, opts.replace ? replaceHints : placementHints);
        }
      },
      opts
    );
    const cli = [name, "-p", project, ...scene ? ["-s", scene] : []];
    const tag = `scatter:${result.placement.recipeHash.slice(0, 8)}`;
    const nextCommands = result.dryRun ? [
      [
        ...cli,
        "scatter",
        "--data",
        JSON.stringify(result.recipe),
        ...opts.replace ? ["--replace"] : [],
        ...opts.allowEmpty ? ["--allow-empty"] : [],
        "--expected-revision",
        String(result.revision),
        "--expected-state",
        result.stateHash
      ]
    ] : [
      [...cli, "node", "list", "--tag", tag, "--details", "--limit", "5"],
      [...cli, "review", "--out", `${project}/exports/review-r${result.revision}`]
    ];
    return { ...result, nextCommands };
  }
  async function recipeInput(opts) {
    const used = recipeFlags.filter((flag) => opts[flag] !== void 0);
    if (used.length)
      throw withHint(
        new ForgeError(
          "INVALID_OPTION",
          "A recipe file already defines the placement; drop the recipe flags.",
          { flags: used }
        ),
        { INVALID_OPTION: "With --file/--data only --seed and --group override the recipe." }
      );
    const recipe = await input(opts);
    if (!recipe || typeof recipe !== "object" || Array.isArray(recipe)) return recipe;
    return {
      ...recipe,
      ...opts.seed !== void 0 ? { seed: opts.seed } : {},
      ...opts.group !== void 0 ? { group: opts.group } : {}
    };
  }
  editOptions2(
    placementOptions(
      sourceOptions2(
        program.command("scatter").description(
          "Scatter registered models over an area or terrain, deterministically from a seed"
        )
      ).option("--model <ids>", "Registered models, optionally weighted: rock,tree:3").option(
        "--area <area>",
        "rect:x0,z0,x1,z1 | circle:x,z,r | polygon:x,z;x,z;x,z (default with --on: the terrain)"
      ).option("--spacing <meters>", "Minimum distance between placements (blue noise)", numeric).option("--count <n>", "Uniform random placements instead of --spacing", integer)
    )
  ).action(async (opts) => {
    const fromRecipe = opts.file !== void 0 || opts.data !== void 0;
    const recipe = fromRecipe ? await recipeInput(opts) : void 0;
    output(await place(opts, (scene) => fromRecipe ? recipe : scatterRecipe(opts, scene)));
  });
  editOptions2(
    placementOptions(
      program.command("layout").description("Place models evenly along a path or on a grid (yaw 0 unless --yaw)").option("--model <ids>", "Registered models, optionally weighted: post,lamp:0.2").option("--path <points>", 'Polyline "x,z;x,z;..."; instances face along it').option("--spacing <meters>", "With --path: distance between placements", numeric).addOption(
        new Option6("--orient <mode>", "With --path: yaw follows the path").choices([
          "yaw",
          "none"
        ])
      ).option("--grid <CxR>", "Grid of COLUMNSxROWS placements, e.g. 4x3").option("--step <meters>", "With --grid: spacing on both axes").option("--jitter <0..1>", "With --grid: random offset up to jitter * step / 2", numeric).option("--center <x,z>", "With --grid: grid center (default 0,0)")
    )
  ).action(async (opts) => output(await place(opts, () => layoutRecipe(opts))));
  const terrain = program.command("terrain").description("Heightfield terrain: create from presets, then sample heights and normals");
  editOptions2(
    terrain.command("add <id>").description(
      "Create a heightfield mesh node <id> with geometry <id>_geo and material <id>_mat"
    ).addOption(
      new Option6("--preset <name>", "Terrain preset").choices(terrainPresetNames).default(defaultTerrainPreset)
    ).option("--size <w,d>", "Width (X) and depth (Z) in meters").option("--resolution <n|nx,nz>", "Vertices per axis (2-256)").option("--amplitude <meters>", "Height range", numeric).option("--seed <n>", "Noise seed 0..4294967295 (default 1)", integer).option("--at <x,y,z>", "Node position").option("--material <id>", "Use an existing material (solid; drops the height bands)").option("--color <hex>", "Solid #rrggbb material instead of the height bands").option("--replace", "Replace an existing node, geometry or material of these IDs")
  ).action(async (id, opts) => {
    parse(Id, id);
    if (opts.material && opts.color)
      fail("INVALID_OPTION", "Pass --material or --color, not both.");
    const pair = (text, flag) => {
      const values = text.split(",").map((v) => v.trim() ? Number(v) : NaN);
      if (values.length === 1) values.push(values[0]);
      if (values.length !== 2 || values.some((v) => !Number.isFinite(v)))
        fail("INVALID_OPTION", `${flag} expects one number or two comma-separated numbers.`);
      return values;
    };
    const { geometry, material: material2 } = terrainPreset(opts.preset, {
      size: opts.size ? pair(opts.size, "--size") : void 0,
      resolution: opts.resolution ? pair(opts.resolution, "--resolution") : void 0,
      amplitude: opts.amplitude,
      seed: opts.seed
    });
    const solid = opts.material || opts.color;
    if (solid) delete geometry.bands;
    const ids = { node: id, geometry: `${id}_geo`, material: opts.material ?? `${id}_mat` };
    const { project, scene } = global();
    const result = await commitPlanned(
      project,
      scene,
      (s) => {
        const taken = [
          s.scene.nodes.some((n) => n.id === ids.node) && `node ${ids.node}`,
          Object.hasOwn(s.scene.geometries, ids.geometry) && `geometry ${ids.geometry}`,
          !opts.material && Object.hasOwn(s.scene.materials, ids.material) && `material ${ids.material}`
        ].filter(Boolean);
        if (taken.length && !opts.replace)
          throw withHint(
            new ForgeError("DUPLICATE_ID", `Terrain ${id} would overwrite ${taken.join(", ")}.`, {
              taken
            }),
            {
              DUPLICATE_ID: "Pass --replace (with the guards) to regenerate this terrain, then rerun its scatters with --replace; or choose another ID."
            }
          );
        if (opts.material && !Object.hasOwn(s.scene.materials, opts.material))
          fail("REFERENCE_MISSING", `Material ${opts.material} does not exist.`);
        const operations = [
          ...opts.material ? [] : [
            {
              op: "putMaterial",
              id: ids.material,
              material: opts.color ? parse(MaterialSchema, { color: opts.color, roughness: 0.95 }) : material2
            }
          ],
          { op: "putGeometry", id: ids.geometry, geometry },
          {
            op: "putNode",
            node: {
              id,
              type: "mesh",
              geometry: ids.geometry,
              material: ids.material,
              tags: ["terrain"],
              ...opts.at ? { transform: { position: c.at(opts.at) } } : {}
            }
          }
        ];
        return {
          operations,
          report: {
            terrain: { ...ids, preset: opts.preset, bands: !solid, geometry },
            // Placements keep the heights they were planned on; regenerate them on new ground.
            ...taken.length ? {
              staleScatterGroups: s.scene.nodes.filter((n) => n.type === "group" && n.tags.includes("scatter")).map((n) => n.id)
            } : {}
          }
        };
      },
      opts
    );
    const cli = [name, "-p", project, ...scene ? ["-s", scene] : []];
    output({
      ...result,
      nextCommands: [
        [...cli, "terrain", "sample", id, "--at", "0,0"],
        [...cli, "scatter", "--model", "<model>", "--on", id, "--spacing", "4", "--dry-run"],
        [...cli, "review", "--out", `${project}/exports/review-r${result.revision}`]
      ]
    });
  });
  terrain.command("sample <node>").description("Read-only world-space terrain heights and normals at x,z points").requiredOption("--at <points>", 'World x,z points: "x,z;x,z;..." (at most 256)').action(async (node, opts) => {
    const points = parsePoints(opts.at, "--at");
    if (points.length > 256) fail("INVALID_OPTION", "--at accepts at most 256 points.");
    const s = await snapshot();
    output({
      scene: s.scene.id,
      revision: s.scene.revision,
      stateHash: s.stateHash,
      terrain: node,
      samples: sampleTerrainNode(s.scene, node, points).map((p) => ({
        x: p.x,
        z: p.z,
        y: round4(p.y),
        normal: p.normal.map(round4),
        inside: p.inside
      }))
    });
  });
}

// src/commands/create-cli.ts
function createCli(overrides = {}, identity2 = { name: "forge3d" }) {
  const runtime = {
    cwd: process.cwd(),
    stdin: process.stdin,
    writeOut: (text) => {
      process.stdout.write(text);
    },
    writeErr: (text) => {
      process.stderr.write(text);
    },
    ...overrides
  };
  const program = new Command3().name(identity2.name).description("Data-driven 3D modeling for agents. JSON in, reproducible geometry out.").version(VERSION).option(
    "-p, --project <directory>",
    "Project directory; otherwise find the nearest project",
    runtime.cwd
  ).option("-s, --scene <id>", "Scene to use; otherwise use activeScene").option("--compact", "Write compact JSON for smaller agent responses").showHelpAfterError(false).exitOverride().configureOutput({ writeOut: runtime.writeOut, writeErr: () => {
  } });
  if (identity2.helpFooter) program.addHelpText("after", identity2.helpFooter);
  const resolvePath = (value) => path12.resolve(runtime.cwd, value);
  const global = () => {
    const options = program.opts();
    return { ...options, project: resolvePath(options.project) };
  };
  const context = {
    program,
    scene: program.command("scene").description("Manage scenes in the current project"),
    model: program.command("model").description("Manage reusable model recipes"),
    global,
    snapshot: () => loadProject(global().project, global().scene),
    output: (data) => runtime.writeOut(
      JSON.stringify({ ok: true, data }, null, program.opts().compact ? void 0 : 2) + "\n"
    ),
    input: (options) => readInput(runtime, options),
    sourceOptions,
    editOptions,
    at,
    resolvePath,
    writeOut: runtime.writeOut
  };
  registerProjectsCommands(context);
  registerDiscoveryCommands(context);
  registerEditingCommands(context);
  registerInspectionCommands(context);
  registerOutputsCommands(context);
  registerRuntimeCommands(context);
  registerCompositionCommands(context);
  registerAgentCommands(context);
  registerExampleCommands(context);
  registerRigCommands(context);
  registerLittlewildCommands(context);
  registerProceduralCommands(context);
  return {
    program,
    /** One invocation per factory instance, with a returned status rather than process.exit. */
    async run(args) {
      try {
        await program.parseAsync(args, { from: "user" });
        return 0;
      } catch (error) {
        if (error instanceof CommanderError2 && error.exitCode === 0) return 0;
        runtime.writeErr(formatCliError(error));
        return 1;
      }
    }
  };
}
export {
  AreaSchema,
  BatchSchema,
  CameraRequestSchema,
  CameraSchema,
  CameraSnapshotSchema,
  Color,
  CompositionSchema,
  DEFAULT_SEED,
  DistributionSchema,
  EnvironmentSchema,
  ForgeError,
  GeometrySchema,
  GroundSchema,
  HEIGHTFIELD_MAX_RESOLUTION,
  HeightfieldGeometrySchema,
  HeightfieldNoiseSchema,
  Id,
  LittlewildAssetSchema,
  LittlewildExportSchema,
  LittlewildId,
  MaterialSchema,
  ModelBundleSchema,
  ModelSchema,
  NodePatchSchema,
  NodeSchema,
  NumberValue,
  OperationSchema,
  PROCEDURAL_MAX_CANDIDATES,
  PROCEDURAL_MAX_PLACEMENTS,
  PatternSchema,
  ProjectSchema,
  QualityPolicySchema,
  ReviewPlanSchema,
  RigSchema,
  SEED_MAX,
  Scalar,
  ScatterItemSchema,
  ScatterRecipeSchema,
  SceneBundleSchema,
  SceneSchema,
  SelectorSchema,
  SurfaceSchema,
  Transform,
  Vec2,
  Vec3,
  applyOperations,
  applySimilarity,
  applySpatialOperation,
  applySurface,
  areaBounds,
  assertLittlewildComplexity,
  atomicWrite,
  auditScene,
  authoringTarget,
  bindRig,
  cameraData,
  canonical,
  captureDependencies,
  captureModel,
  captureProjectModel,
  checkGuards,
  checkSeed,
  cloneScene,
  commitOperations,
  commitPlanned,
  compileScene,
  createCli,
  createExample,
  createLight,
  createMaterial,
  createPreview,
  createProjectPreview,
  createRandom,
  createResourcePool,
  createScene,
  createSurfacePool,
  cyrb128,
  defaultTerrainPreset,
  definitionText,
  ensureSurfaceTangents,
  errorCode,
  errorMessage,
  exampleBundle,
  exportFormats,
  exportScene,
  expressionOperators,
  fail,
  findProject,
  fitCamera,
  generateSurface,
  gltfScene,
  gridArea,
  gridLayout,
  guards,
  heightGrid,
  heightfieldGeometry,
  heightfieldSampler,
  importModel,
  importedNodeIds,
  initProject,
  insideArea,
  insideBounds,
  inspectNodes,
  invertSimilarity,
  jsonSchema,
  listExamples,
  littlewildExportIdentity,
  littlewildFamilies,
  littlewildId,
  littlewildImportPlan,
  littlewildLimits,
  littlewildModel,
  littlewildModels,
  littlewildPetRoles,
  littlewildVisual,
  loadPlaywright,
  loadProject,
  loadProjectScenes,
  matrixTransform,
  maxSurfaceRecipes,
  modelDependencies,
  modelParameters,
  modelStateHash,
  newScene,
  nodeBase,
  nodeById,
  nodeFrame,
  orientLight,
  packScene,
  parse,
  pathLayout,
  planScatter,
  playwrightEnvironment,
  playwrightRemedies,
  playwrightSearchRoots,
  poissonDisk,
  prepareSceneEdit,
  primitiveGeometry,
  radians,
  readDefinition,
  readJson,
  resolveData,
  resolveSurfaceAlgorithm,
  restoreScene,
  reuseLittlewildMeshes,
  reviewRender,
  reviewScene,
  rigClips,
  round4,
  sampleHeightfield,
  sampleTerrainNode,
  scalar,
  sceneChanges,
  schemaKinds,
  schemas,
  screenshot,
  selectNodes,
  semanticBindings,
  sha256Hex,
  sphereUVs,
  stateHash,
  subtreeIds,
  surfaceAlgorithm,
  terrainPreset,
  terrainPresetNames,
  terrainPresets,
  terrainSampler,
  terrainSpec,
  transform,
  triangles,
  uniformRandom,
  unpackScene,
  useScene,
  uuid,
  validateDocument,
  validateExport,
  validateRig,
  viewNames,
  withCaptureSession,
  withLock,
  writeJson,
  writeLittlewildAsset
};
//# sourceMappingURL=index.js.map
