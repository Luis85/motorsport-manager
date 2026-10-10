// src/domain/errors.ts
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

// src/domain/schema.ts
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
var segments = z.number().int().min(3).max(128);
var GeometrySchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("box"), size: Vec3 }),
  z.strictObject({ type: z.literal("sphere"), radius: Scalar, segments: segments.optional() }),
  z.strictObject({
    type: z.literal("cylinder"),
    radiusTop: Scalar,
    radiusBottom: Scalar,
    height: Scalar,
    segments: segments.optional(),
    openEnded: z.boolean().optional()
  }),
  z.strictObject({
    type: z.literal("cone"),
    radius: Scalar,
    height: Scalar,
    segments: segments.optional()
  }),
  z.strictObject({
    type: z.literal("torus"),
    radius: Scalar,
    tube: Scalar,
    segments: segments.optional()
  }),
  z.strictObject({
    type: z.literal("capsule"),
    radius: Scalar,
    length: Scalar,
    segments: segments.optional()
  }),
  z.strictObject({ type: z.literal("plane"), size: Vec2 }),
  z.strictObject({
    type: z.literal("tube"),
    points: z.array(Vec3).min(2).max(256),
    radius: Scalar,
    tubularSegments: z.number().int().min(4).max(512).default(64),
    radialSegments: z.number().int().min(3).max(32).default(8),
    closed: z.boolean().default(false),
    capEnds: z.boolean().default(true)
  }),
  z.strictObject({
    type: z.literal("lathe"),
    points: z.array(Vec2).min(2).max(512),
    segments: segments.optional()
  }),
  z.strictObject({
    type: z.literal("extrude"),
    points: z.array(Vec2).min(3).max(512),
    holes: z.array(z.array(Vec2).min(3).max(512)).max(32).optional(),
    depth: Scalar,
    bevel: Scalar.optional(),
    bevelSegments: segments.optional()
  }),
  z.strictObject({
    type: z.literal("mesh"),
    positions: z.array(Vec3).min(3).max(1e5),
    indices: z.array(z.number().int().nonnegative()).min(3).max(6e5),
    normals: z.array(Vec3).min(3).max(1e5).optional(),
    uvs: z.array(Vec2).min(3).max(1e5).optional()
  }),
  z.strictObject({
    type: z.literal("boolean"),
    operation: z.enum(["union", "subtract", "intersect"]),
    left: Id,
    right: Id,
    leftTransform: Transform.optional(),
    rightTransform: Transform.optional()
  })
]);
var MaterialSchema = z.object({
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
  shading: z.enum(["standard", "unlit"]).optional()
}).strict();
var PatternSchema = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("path"),
    points: z.array(Vec3).min(1).max(256),
    orient: z.enum(["none", "yaw"]).default("none")
  }),
  z.object({ type: z.literal("linear"), count: Scalar, step: Vec3 }).strict(),
  z.object({
    type: z.literal("radial"),
    count: Scalar,
    radius: Scalar,
    startAngle: Scalar.default(0),
    sweep: Scalar.default(360),
    orient: z.boolean().default(true)
  }).strict(),
  z.object({
    type: z.literal("grid"),
    counts: Vec3,
    step: Vec3,
    centered: z.boolean().default(false)
  }).strict()
]);
var JointVector = z.tuple([NumberValue, NumberValue, NumberValue]);
var RigSchema = z.strictObject({
  joints: z.array(
    z.strictObject({
      id: Id,
      parent: Id.optional(),
      position: JointVector,
      rotation: JointVector.default([0, 0, 0])
    })
  ).min(1).max(64),
  binding: z.enum(["rigid", "smooth"]).default("rigid"),
  bindings: z.record(z.string().min(1).max(512), Id).default({}),
  pose: z.record(Id, JointVector).default({}),
  clips: z.array(
    z.strictObject({
      id: Id,
      duration: z.number().positive().max(600),
      tracks: z.array(
        z.strictObject({
          joint: Id,
          keyframes: z.array(
            z.strictObject({
              time: z.number().min(0).max(600),
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
  name: z.string().max(120).optional(),
  parent: Id.optional(),
  transform: Transform.optional(),
  visible: z.boolean().default(true),
  tags: z.array(z.string().max(64)).max(32).default([]),
  pattern: PatternSchema.optional()
};
var NodeSchema = z.discriminatedUnion("type", [
  z.object({
    ...nodeBase,
    type: z.literal("light"),
    light: z.enum(["point", "spot", "directional"]),
    color: Color.default("#ffffff"),
    intensity: z.number().finite().min(0).max(1e4).default(50),
    distance: z.number().finite().min(0).max(1e5).default(0),
    angle: z.number().min(1).max(89).default(35),
    penumbra: z.number().min(0).max(1).default(0.25),
    castShadow: z.boolean().default(false)
  }).strict(),
  z.object({ ...nodeBase, type: z.literal("group") }).strict(),
  z.object({ ...nodeBase, type: z.literal("mesh"), geometry: Id, material: Id }).strict(),
  z.object({
    ...nodeBase,
    type: z.literal("model"),
    model: Id,
    rig: RigSchema.optional(),
    parameters: z.record(Id, Scalar).default({}),
    materialOverrides: z.record(Id, Id).default({})
  }).strict()
]);
var content = {
  geometries: z.record(Id, GeometrySchema).default({}),
  materials: z.record(Id, MaterialSchema).default({}),
  nodes: z.array(NodeSchema).max(1e4).default([])
};
var CameraSchema = z.object({
  position: z.tuple([NumberValue, NumberValue, NumberValue]),
  target: z.tuple([NumberValue, NumberValue, NumberValue]),
  fov: z.number().min(5).max(120).default(40)
}).strict();
var EnvironmentSchema = z.object({
  background: Color.default("#171d25"),
  exposure: z.number().min(0.1).max(4).optional(),
  toneMapping: z.enum(["filmic", "neutral", "linear"]).optional(),
  presentation: z.enum(["inspection", "portrait"]).optional(),
  ambient: z.number().min(0).max(5).default(1.8),
  keyIntensity: z.number().min(0).max(10).default(3.5),
  keyPosition: z.tuple([NumberValue, NumberValue, NumberValue]).default([5, 10, 7])
}).strict();
var SceneSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("scene"),
  id: Id,
  name: z.string().min(1).max(120),
  revision: z.number().int().nonnegative().default(0),
  units: z.literal("meters").default("meters"),
  parameters: z.record(Id, NumberValue).default({}),
  ...content,
  camera: CameraSchema.optional(),
  environment: EnvironmentSchema.default({
    background: "#171d25",
    ambient: 1.8,
    keyIntensity: 3.5,
    keyPosition: [5, 10, 7]
  })
}).strict();
var ModelSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("model"),
  id: Id,
  category: z.string().max(64).optional(),
  description: z.string().max(600).optional(),
  name: z.string().min(1).max(120),
  parameters: z.record(
    Id,
    z.object({
      default: NumberValue,
      min: NumberValue.optional(),
      max: NumberValue.optional(),
      description: z.string().max(300).optional(),
      integer: z.boolean().optional()
    }).strict()
  ).default({}),
  ...content
}).strict();
var ProjectSchema = z.object({
  schemaVersion: z.literal(1),
  name: z.string().min(1).max(120),
  activeScene: Id,
  scenes: z.record(Id, z.string()),
  models: z.record(Id, z.string())
}).strict();
var NodePatchSchema = z.object({
  name: z.string().max(120).optional(),
  visible: z.boolean().optional(),
  tags: z.array(z.string().max(64)).max(32).optional(),
  transform: Transform.optional(),
  pattern: PatternSchema.nullable().optional(),
  rig: RigSchema.nullable().optional(),
  color: Color.optional(),
  intensity: z.number().finite().min(0).max(1e4).optional(),
  distance: z.number().finite().min(0).max(1e5).optional(),
  angle: z.number().min(1).max(89).optional(),
  penumbra: z.number().min(0).max(1).optional(),
  castShadow: z.boolean().optional(),
  parameters: z.record(Id, Scalar).optional(),
  materialOverrides: z.record(Id, Id).optional()
}).strict();
var SelectorSchema = z.object({
  ids: z.array(Id).min(1).max(1e3).optional(),
  tag: z.string().max(64).optional(),
  type: z.enum(["group", "mesh", "model", "light"]).optional(),
  model: Id.optional(),
  parent: Id.nullable().optional()
}).strict();
var OperationSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("putNode"), node: NodeSchema }).strict(),
  z.object({ op: z.literal("patchNodes"), selector: SelectorSchema, patch: NodePatchSchema }).strict(),
  z.object({ op: z.literal("removeNode"), id: Id, cascade: z.boolean().default(false) }).strict(),
  z.object({ op: z.literal("putGeometry"), id: Id, geometry: GeometrySchema }).strict(),
  z.object({ op: z.literal("removeGeometry"), id: Id }).strict(),
  z.object({ op: z.literal("putMaterial"), id: Id, material: MaterialSchema }).strict(),
  z.object({ op: z.literal("removeMaterial"), id: Id }).strict(),
  z.object({ op: z.literal("setParameter"), id: Id, value: NumberValue }).strict(),
  z.object({ op: z.literal("setCamera"), camera: CameraSchema }).strict(),
  z.object({ op: z.literal("setEnvironment"), environment: EnvironmentSchema }).strict(),
  z.object({ op: z.literal("patchNode"), id: Id, patch: NodePatchSchema }).strict(),
  z.object({ op: z.literal("duplicateNode"), id: Id, newId: Id, offset: Vec3.default([0, 0, 0]) }).strict(),
  z.object({
    op: z.literal("reparentNode"),
    id: Id,
    parent: Id.nullable(),
    keepWorld: z.boolean().default(true)
  }).strict(),
  z.object({
    op: z.literal("groupNodes"),
    id: Id,
    nodes: z.array(Id).min(1).max(1e3),
    name: z.string().max(120).optional()
  }).strict(),
  z.object({ op: z.literal("groundNode"), id: Id, y: NumberValue.default(0) }).strict(),
  z.object({
    op: z.literal("placeNode"),
    id: Id,
    target: Id,
    side: z.enum(["right", "left", "front", "back", "above", "below"]),
    gap: z.number().min(0).max(1e6).default(0),
    center: z.boolean().default(true)
  }).strict()
]);
var guards = {
  scene: Id.optional(),
  expectedRevision: z.number().int().nonnegative().optional(),
  expectedState: z.string().regex(/^[a-f0-9]{64}$/).optional()
};
var BatchSchema = z.object({ ...guards, operations: z.array(OperationSchema).min(1).max(1e4) }).strict();
var CompositionSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("composition"),
  ...guards,
  groups: z.array(z.object({ ...nodeBase, type: z.literal("group").default("group") }).strict()).default([]),
  instances: z.array(
    z.object({
      ...nodeBase,
      type: z.literal("model").default("model"),
      model: Id,
      parameters: z.record(Id, Scalar).default({}),
      materialOverrides: z.record(Id, Id).default({})
    }).strict()
  ).min(1).max(1e4)
}).strict();
var ModelBundleSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("model-bundle"),
  entry: Id,
  models: z.record(Id, ModelSchema)
}).strict();
var SceneBundleSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("scene-bundle"),
  scene: SceneSchema,
  models: z.record(Id, ModelSchema)
}).strict();
var littlewildFamilies = {
  items: "item",
  buildings: "building",
  creatures: "actor",
  pets: "pet"
};
var LittlewildId = z.string().regex(/^[a-z0-9][a-z0-9_-]{0,60}$/);
var LittlewildVariantSchema = z.object({
  model: Id,
  parameters: z.record(Id, NumberValue).default({}),
  /** Replace a model material with an inline specification for this variant. */
  materials: z.record(Id, MaterialSchema).default({})
}).strict();
var LittlewildAssetSchema = z.object({
  id: LittlewildId,
  family: z.enum(["items", "buildings", "creatures", "pets"]),
  name: z.string().min(1).max(120),
  models: z.record(LittlewildId, LittlewildVariantSchema).refine((v) => Object.keys(v).length, {
    message: "At least one Littlewild model variant is required."
  }),
  metadata: z.record(z.string().max(64), z.union([z.number(), z.string().max(120)])).default({})
}).strict();
var LittlewildExportSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("littlewild-export"),
  target: z.string().min(1).max(512),
  assets: z.array(LittlewildAssetSchema).min(1).max(128)
}).strict();
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
var CameraNumber = z.number().finite();
var NumericVec3 = z.tuple([CameraNumber, CameraNumber, CameraNumber]);
var CameraSnapshotSchema = z.object({
  projection: z.enum(["perspective", "orthographic"]),
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
var CameraRequestSchema = z.object({
  view: z.enum(viewNames).default("iso"),
  projection: z.enum(["auto", "perspective", "orthographic"]).default("auto"),
  azimuth: NumberValue.default(45),
  elevation: z.number().min(-89.9).max(89.9).default(30),
  padding: z.number().min(1.02).max(3).default(1.12),
  fov: z.number().min(5).max(120).default(40),
  fixed: CameraSnapshotSchema.optional()
}).strict();
var ReviewPlanSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("review"),
  width: z.number().int().min(64).max(2048).default(800),
  height: z.number().int().min(64).max(2048).default(600),
  grid: z.boolean().default(false),
  wireframe: z.boolean().default(false),
  contactSheet: z.boolean().default(true),
  background: Color.optional(),
  frames: z.array(z.object({ id: Id, camera: CameraRequestSchema }).strict()).min(1).max(36)
}).strict();
var QualityPolicySchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("quality-policy"),
  maxTriangles: z.number().int().nonnegative().optional(),
  maxMeshes: z.number().int().nonnegative().optional(),
  maxMaterials: z.number().int().nonnegative().optional(),
  maxGeometries: z.number().int().nonnegative().optional(),
  maxExtent: z.number().positive().finite().optional(),
  allowTransparency: z.boolean().default(true),
  allowDoubleSided: z.boolean().default(true),
  requireUVs: z.boolean().default(false)
}).strict();
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
  "littlewild-export": LittlewildExportSchema
};
var schemaKinds = Object.keys(schemas);
function jsonSchema(kind) {
  if (!Object.hasOwn(schemas, kind))
    fail("UNKNOWN_SCHEMA", `Unknown schema ${kind}.`, { available: Object.keys(schemas) });
  return z.toJSONSchema(schemas[kind], {
    target: "draft-2020-12",
    io: "input"
  });
}

// src/domain/rig.ts
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

// src/domain/scalar.ts
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

// src/domain/validate.ts
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
  const nodes = new Map(d.nodes.map((n) => [n.id, n]));
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
      current = nodes.get(current)?.parent;
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
    const positive = (v, label, allowZero = false) => {
      if (typeof v !== "number" || !Number.isFinite(v) || (allowZero ? v < 0 : v <= 0))
        fail(
          "INVALID_GEOMETRY",
          `${id}.${label} must be ${allowZero ? "nonnegative" : "positive"}.`
        );
    };
    if ("size" in g) g.size.forEach((v) => positive(v, "size"));
    for (const k of ["radius", "height", "tube", "depth"])
      if (k in g) positive(g[k], k);
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
      positive(g.radiusTop, "radiusTop", true);
      positive(g.radiusBottom, "radiusBottom", true);
      if (g.radiusTop === 0 && g.radiusBottom === 0)
        fail("INVALID_GEOMETRY", `${id} needs at least one nonzero radius.`);
    }
    if (g.type === "capsule") positive(g.length, "length", true);
    if (g.type === "extrude" && g.bevel !== void 0) positive(g.bevel, "bevel", true);
    if (g.type === "lathe") g.points.forEach((p) => positive(p[0], "point radius", true));
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

// src/application/rigging.ts
import * as THREE2 from "three";

// src/application/transforms.ts
import * as THREE from "three";

// src/domain/identity.ts
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

// src/application/transforms.ts
var radians = (v) => THREE.MathUtils.degToRad(v);
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

// src/application/rigging.ts
var rotation = (value) => new THREE2.Euler(...value.map(THREE2.MathUtils.degToRad));
var rigClips = (root) => {
  const clips = [];
  root.traverse((object) => clips.push(...object.animations));
  return clips;
};
function bindRig(root, spec) {
  validateRig(spec);
  const meshes = [];
  root.traverse((object) => {
    if (object instanceof THREE2.SkinnedMesh)
      fail("RIG_NESTED", "A rig cannot contain another rig.");
    if (object instanceof THREE2.Mesh) meshes.push(object);
  });
  if (!meshes.length) fail("RIG_EMPTY", "A rig needs a model containing meshes.");
  if (meshes.reduce((sum, mesh) => sum + mesh.geometry.getAttribute("position").count, 0) > 2e5)
    fail("RIG_BUDGET", "A rig supports at most 200,000 skin vertices.");
  const knownPaths = new Set(meshes.map((mesh) => mesh.name.slice(root.name.length + 1)));
  for (const path12 of Object.keys(spec.bindings))
    if (!knownPaths.has(path12))
      fail(
        "RIG_BINDING",
        `Rig binding ${path12} does not match a mesh path relative to ${root.name}.`
      );
  root.updateWorldMatrix(true, true);
  const inverse = root.matrixWorld.clone().invert();
  const ordered = [...spec.joints].sort((a, b) => Number(!!a.parent) - Number(!!b.parent));
  const bones = new Map(
    ordered.map((joint) => {
      const bone = new THREE2.Bone();
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
  const skeleton = new THREE2.Skeleton([...bones.values()]);
  const origins = [...bones.values()].map(
    (bone) => bone.getWorldPosition(new THREE2.Vector3()).applyMatrix4(inverse)
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
      const point = new THREE2.Vector3().fromBufferAttribute(positions, i);
      const nearest = origins.map((origin, index) => ({ index, distance: point.distanceTo(origin) })).sort((a, b) => a.distance - b.distance || a.index - b.index);
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
    geometry.setAttribute("skinIndex", new THREE2.Uint16BufferAttribute(indices, 4));
    geometry.setAttribute("skinWeight", new THREE2.Float32BufferAttribute(weights, 4));
    const skin = new THREE2.SkinnedMesh(geometry, mesh.material);
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
    (clip) => new THREE2.AnimationClip(
      `${root.name}/${clip.id}`,
      clip.duration,
      clip.tracks.map(
        (track) => new THREE2.QuaternionKeyframeTrack(
          `${bones.get(track.joint).uuid}.quaternion`,
          track.keyframes.map((frame) => frame.time),
          track.keyframes.flatMap(
            (frame) => new THREE2.Quaternion().setFromEuler(rotation(frame.rotation)).toArray()
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

// src/application/lights.ts
import * as THREE3 from "three";
function orientLight(light) {
  for (const child of [...light.children])
    if (child.name === "forgeLightTarget") light.remove(child);
  const target = new THREE3.Object3D();
  target.name = "forgeLightTarget";
  target.position.set(0, 0, -1);
  light.add(target);
  light.target = target;
}
function createLight(node) {
  const light = node.light === "directional" ? new THREE3.DirectionalLight(node.color, node.intensity) : node.light === "spot" ? new THREE3.SpotLight(
    node.color,
    node.intensity,
    node.distance,
    THREE3.MathUtils.degToRad(node.angle),
    node.penumbra,
    2
  ) : new THREE3.PointLight(node.color, node.intensity, node.distance, 2);
  light.castShadow = node.castShadow;
  if (light instanceof THREE3.SpotLight || light instanceof THREE3.DirectionalLight)
    orientLight(light);
  return light;
}

// src/application/compiler.ts
import * as THREE7 from "three";

// src/application/materials.ts
import * as THREE4 from "three";
function createMaterial(m) {
  if (m.depthWrite === false && m.opacity >= 1)
    fail(
      "MATERIAL_DEPTH_WRITE",
      "Disabling depth writes requires opacity below 1 for portable alpha blending."
    );
  const common = {
    color: m.color,
    opacity: m.opacity,
    transparent: m.opacity < 1,
    depthWrite: m.depthWrite ?? true,
    side: m.doubleSided ? THREE4.DoubleSide : THREE4.FrontSide
  };
  if (m.shading === "unlit") return new THREE4.MeshBasicMaterial(common);
  const standard = {
    ...common,
    metalness: m.metalness,
    roughness: m.roughness,
    emissive: m.emissive ?? "#000000",
    emissiveIntensity: m.emissiveIntensity ?? 1,
    flatShading: m.flatShading
  };
  const physical = Object.fromEntries(
    ["sheen", "sheenColor", "sheenRoughness", "clearcoat", "clearcoatRoughness"].filter((key) => m[key] !== void 0).map((key) => [key, m[key]])
  );
  return Object.keys(physical).length ? new THREE4.MeshPhysicalMaterial({ ...standard, ...physical }) : new THREE4.MeshStandardMaterial(standard);
}

// src/application/tube.ts
import * as THREE5 from "three";
function tubeGeometry(spec) {
  const curve = new THREE5.CatmullRomCurve3(
    spec.points.map((point) => new THREE5.Vector3(...point)),
    spec.closed,
    "centripetal"
  );
  const geometry = new THREE5.TubeGeometry(
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
      const va = new THREE5.Vector3().fromArray(positions, a * 3).sub(center), vb = new THREE5.Vector3().fromArray(positions, b * 3).sub(center);
      indices.push(...va.cross(vb).dot(normal) > 0 ? [base, a, b] : [base, b, a]);
    }
  }
  geometry.setAttribute("position", new THREE5.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE5.Float32BufferAttribute(normals, 3));
  geometry.setAttribute("uv", new THREE5.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  return geometry;
}

// src/application/resources.ts
import * as THREE6 from "three";
import { Brush, Evaluator, ADDITION, SUBTRACTION, INTERSECTION } from "three-bvh-csg/src/index.js";

// src/domain/canonical.ts
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value;
    return `{${Object.keys(record).filter((key) => record[key] !== void 0).sort().map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

// src/application/resources.ts
function createResourcePool(warnings) {
  const geometries = /* @__PURE__ */ new Set();
  const materials = /* @__PURE__ */ new Set();
  const geometryPool = /* @__PURE__ */ new Map();
  const materialPool = /* @__PURE__ */ new Map();
  function scopeResources(scope, path12, overrides = {}) {
    const geometryCache = /* @__PURE__ */ new Map();
    const materialCache = /* @__PURE__ */ new Map();
    function material(id) {
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
      const result = createMaterial(m);
      result.name = `${path12}/${id}`;
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
          result = new THREE6.BoxGeometry(...g.size);
          break;
        case "sphere":
          result = new THREE6.SphereGeometry(
            g.radius,
            g.segments ?? 32,
            Math.max(8, (g.segments ?? 32) / 2)
          );
          break;
        case "cylinder":
          result = new THREE6.CylinderGeometry(
            g.radiusTop,
            g.radiusBottom,
            g.height,
            g.segments ?? 32,
            1,
            g.openEnded ?? false
          );
          break;
        case "cone":
          result = new THREE6.ConeGeometry(g.radius, g.height, g.segments ?? 32);
          break;
        case "torus":
          result = new THREE6.TorusGeometry(g.radius, g.tube, 12, g.segments ?? 48);
          break;
        case "capsule":
          result = new THREE6.CapsuleGeometry(g.radius, g.length, 8, g.segments ?? 24);
          break;
        case "tube":
          result = tubeGeometry(g);
          break;
        case "plane":
          result = new THREE6.PlaneGeometry(...g.size);
          break;
        case "lathe":
          result = new THREE6.LatheGeometry(
            g.points.map((p) => new THREE6.Vector2(p[0], p[1])),
            g.segments ?? 32
          );
          break;
        case "extrude": {
          const shape = new THREE6.Shape(
            g.points.map((p) => new THREE6.Vector2(p[0], p[1]))
          );
          shape.holes = (g.holes ?? []).map(
            (points) => new THREE6.Path(points.map((p) => new THREE6.Vector2(p[0], p[1])))
          );
          result = new THREE6.ExtrudeGeometry(shape, {
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
          result = new THREE6.BufferGeometry();
          result.setAttribute("position", new THREE6.Float32BufferAttribute(g.positions.flat(), 3));
          result.setIndex(g.indices);
          if (g.normals)
            result.setAttribute("normal", new THREE6.Float32BufferAttribute(g.normals.flat(), 3));
          else result.computeVertexNormals();
          if (g.uvs) result.setAttribute("uv", new THREE6.Float32BufferAttribute(g.uvs.flat(), 2));
          else
            warnings.add(
              "Custom meshes without UVs cannot carry texture coordinates into exports. Supply one uv pair per position when needed."
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
      geometries.add(result);
      result.name = `${path12}/${id}`;
      result.uuid = uuid(`geometry/${key}`);
      if ((g.type === "lathe" || g.type === "capsule") && result.index) {
        const positions = result.getAttribute("position");
        const kept = [];
        const a = new THREE6.Vector3(), b = new THREE6.Vector3(), c = new THREE6.Vector3();
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
        const normal = new THREE6.Vector3();
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
      const baked = new THREE6.BufferGeometry().copy(result);
      baked.uuid = result.uuid;
      geometries.delete(result);
      result.dispose();
      result = baked;
      geometries.add(result);
      geometryCache.set(id, result);
      geometryPool.set(key, result);
      return result;
    }
    return { geometry, material };
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
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => material.dispose());
      geometries.clear();
      materials.clear();
      geometryPool.clear();
      materialPool.clear();
    }
  };
}

// src/application/compiler.ts
function compileScene(document2, models = {}, options = {}) {
  validateDocument(document2, models);
  const scene = new THREE7.Scene();
  scene.name = document2.name;
  scene.uuid = uuid(document2.id);
  const content2 = new THREE7.Group();
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
  function buildScope(source, target, path12, parameters, overrides = {}, inheritedSlots = {}) {
    const scope = resolveData(source, parameters);
    const slots = (id) => [`${path12}/${id}`, ...inheritedSlots[id] ?? []];
    const { geometry, material } = resources.scopeResources(scope, path12, overrides);
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
        object = new THREE7.Mesh(g, material(node.material));
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
        object = new THREE7.Group();
        if (node.type === "model") {
          const model = models[node.model];
          const replace = Object.fromEntries(
            Object.entries(node.materialOverrides).map(([from, to]) => [from, material(to)])
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
      const nodePath = `${path12}/${node.id}`;
      let object;
      if (node.pattern) {
        if (++objectCount > 2e4) fail("SCENE_BUDGET", "Expanded scene exceeds 20,000 objects.");
        object = new THREE7.Group();
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
    const bounds = new THREE7.Box3().setFromObject(content2);
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
        size: empty ? [0, 0, 0] : bounds.getSize(new THREE7.Vector3()).toArray()
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

// src/application/quality.ts
import {
  Box3 as Box32,
  Vector3 as Vector35,
  Mesh as Mesh3,
  SkinnedMesh as SkinnedMesh2,
  DoubleSide as DoubleSide2
} from "three";
function auditScene(scene, models = {}, input = {}) {
  const policy = parse(QualityPolicySchema, { schemaVersion: 1, kind: "quality-policy", ...input });
  const built = compileScene(scene, models);
  try {
    const findings = /* @__PURE__ */ new Map();
    const add = (code, severity, message, hint, path12, count = 1) => {
      const f = findings.get(code) ?? { code, severity, message, count: 0, paths: [], hint };
      f.count += count;
      if (path12 && !f.paths.includes(path12) && f.paths.length < 10) f.paths.push(path12);
      findings.set(code, f);
    };
    const geometries = /* @__PURE__ */ new Set(), materials = /* @__PURE__ */ new Set();
    const degenerate = /* @__PURE__ */ new Map();
    const bounds = new Box32();
    const a = new Vector35(), b = new Vector35(), c = new Vector35(), ab = new Vector35(), ac = new Vector35();
    let meshes = 0, triangles2 = 0, geometryBytes = 0, nodes = 0;
    built.content.traverseVisible((object) => {
      if (object.userData.forgeId) nodes++;
      if (!(object instanceof Mesh3)) return;
      meshes++;
      const g = object.geometry;
      const position = g.getAttribute("position");
      const count = (g.index?.count ?? position.count) / 3;
      triangles2 += count;
      if (!geometries.has(g)) {
        geometries.add(g);
        geometryBytes += (g.index?.array.byteLength ?? 0) + Object.values(g.attributes).reduce((sum, attr) => sum + attr.array.byteLength, 0);
      }
      if (object instanceof SkinnedMesh2) {
        object.computeBoundingBox();
        if (object.boundingBox)
          bounds.union(object.boundingBox.clone().applyMatrix4(object.matrixWorld));
      } else {
        if (!g.boundingBox) g.computeBoundingBox();
        bounds.union(g.boundingBox.clone().applyMatrix4(object.matrixWorld));
      }
      if (!degenerate.has(g)) {
        let invalid2 = 0;
        for (let i = 0; i < count * 3; i += 3) {
          const at2 = (offset) => g.index ? g.index.getX(i + offset) : i + offset;
          a.fromBufferAttribute(position, at2(0));
          b.fromBufferAttribute(position, at2(1));
          c.fromBufferAttribute(position, at2(2));
          ab.subVectors(b, a);
          ac.subVectors(c, a);
          const edge = Math.max(ab.lengthSq(), ac.lengthSq(), b.distanceToSquared(c));
          if (ab.cross(ac).lengthSq() <= edge * edge * 1e-24) invalid2++;
        }
        degenerate.set(g, invalid2);
      }
      const invalid = degenerate.get(g);
      if (invalid)
        add(
          "DEGENERATE_TRIANGLES",
          "error",
          "Visible geometry contains zero-area or nearly collinear triangles.",
          "Repair mesh indices/positions or revise boolean operands; inspect the listed paths.",
          object.name,
          invalid
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
    const size = bounds.isEmpty() ? [0, 0, 0] : bounds.getSize(new Vector35()).toArray();
    const metrics = {
      nodes,
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

// src/application/inspection.ts
import { Box3 as Box33, Vector3 as Vector36, Mesh as Mesh4 } from "three";
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
  const nodes = selectNodes(scene, selector2);
  if (!detailed)
    return nodes.map((n) => ({
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
    return nodes.map((node) => {
      const object = built.content.getObjectByName(`${scene.id}/${node.id}`);
      const box = new Box33().setFromObject(object);
      let meshes = 0, triangles2 = 0;
      object.traverse((child) => {
        if (child instanceof Mesh4) {
          meshes++;
          triangles2 += (child.geometry.index?.count ?? child.geometry.getAttribute("position").count) / 3;
        }
      });
      return {
        node,
        worldPosition: object.getWorldPosition(new Vector36()).toArray(),
        worldMatrix: object.matrixWorld.toArray(),
        bounds: box.isEmpty() ? null : {
          min: box.min.toArray(),
          max: box.max.toArray(),
          size: box.getSize(new Vector36()).toArray()
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

// src/application/composition.ts
import { Box3 as Box34, Euler as Euler2, Matrix4, Quaternion as Quaternion2, Vector3 as Vector37 } from "three";
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
  const position = new Vector37(), scale = new Vector37(), rotation2 = new Quaternion2();
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
    const position = object.getWorldPosition(new Vector37()).add(delta);
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
    let delta = new Vector37();
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
          delta.subVectors(target.getCenter(new Vector37()), box.getCenter(new Vector37()));
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
  const nodes = resolveData(
    structuredClone(scene.nodes.filter((n) => selected.has(n.id))),
    scene.parameters
  );
  for (const node of nodes)
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
  for (const node of nodes) {
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
    nodes,
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

// src/application/operations.ts
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

// src/application/gltf-scene.ts
import * as THREE8 from "three";
import { clone } from "three/addons/utils/SkeletonUtils.js";
function gltfScene(root) {
  const copy = clone(root);
  const original = [], cloned = [];
  root.traverse((object) => original.push(object));
  copy.traverse((object) => cloned.push(object));
  cloned.forEach((object, i) => {
    object.uuid = original[i].uuid;
  });
  const scene = copy instanceof THREE8.Scene ? copy : new THREE8.Scene();
  if (scene !== copy) {
    scene.name = root.name;
    scene.add(copy);
  }
  const skins = [];
  scene.traverse((object) => {
    if (object instanceof THREE8.SkinnedMesh) skins.push(object);
    if (object instanceof THREE8.SpotLight || object instanceof THREE8.DirectionalLight)
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

// src/infra/blob-reader.ts
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

// src/infra/export.ts
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { OBJExporter } from "three/addons/exporters/OBJExporter.js";
import { STLExporter } from "three/addons/exporters/STLExporter.js";
import { Box3 as Box35, Vector3 as Vector38, Mesh as Mesh5 } from "three";

// src/application/target.ts
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

// src/infra/export.ts
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
    const bounds = new Box35().setFromObject(built.scene);
    const usedMaterials = /* @__PURE__ */ new Set();
    const usedGeometries = /* @__PURE__ */ new Set();
    let nodes = 0, meshes = 0, triangles2 = 0;
    built.scene.traverse((object) => {
      if (object.userData.forgeId) nodes++;
      if (object instanceof Mesh5) {
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
      nodes,
      meshes,
      triangles: triangles2,
      materials: usedMaterials.size,
      geometries: usedGeometries.size,
      bounds: {
        min: bounds.isEmpty() ? [0, 0, 0] : bounds.min.toArray(),
        max: bounds.isEmpty() ? [0, 0, 0] : bounds.max.toArray(),
        size: bounds.isEmpty() ? [0, 0, 0] : bounds.getSize(new Vector38()).toArray()
      }
    };
    let data;
    const warnings = [...built.stats.warnings];
    if (format === "glb" || format === "gltf") {
      installBlobReader();
      const portable = gltfScene(built.scene);
      const result = await new GLTFExporter().parseAsync(portable, {
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

// src/infra/state-hash.ts
import { createHash } from "node:crypto";
var stateHash = (scene, models) => createHash("sha256").update(canonical({ scene, models })).digest("hex");

// src/version.ts
var VERSION = "0.6.0";

// src/infra/capture.ts
import { promises as fs } from "node:fs";
import path2 from "node:path";
import os from "node:os";

// src/infra/playwright.ts
import { createRequire } from "node:module";
import { realpathSync } from "node:fs";
import path from "node:path";
var notFound = (error) => ["MODULE_NOT_FOUND", "ERR_MODULE_NOT_FOUND"].includes(errorCode(error) ?? "");
function realDirectory(file) {
  if (!file) return void 0;
  try {
    return path.dirname(realpathSync(file));
  } catch {
    return path.dirname(path.resolve(file));
  }
}
function playwrightSearchRoots(environment) {
  const entry = realDirectory(environment.entry);
  const prefix = path.dirname(environment.execPath);
  const roots = [
    environment.cwd,
    ...entry ? [path.join(entry, "..", "source", "scene-forge")] : [],
    environment.platform === "win32" ? prefix : path.join(prefix, "..", "lib")
  ];
  return [...new Set(roots.map((root) => path.resolve(root)))];
}
var playwrightRemedies = [
  "From a repository checkout: cd source/scene-forge && npm ci (bin/scene-forge then finds source/scene-forge/node_modules/playwright).",
  "Anywhere: npm install --global playwright, or set NODE_PATH to a node_modules directory that contains playwright.",
  "Then provide Chromium: npx playwright install chromium (Linux: --with-deps), or set FORGE_CHROMIUM_PATH."
];
var defaultEnvironment = () => ({
  cwd: process.cwd(),
  entry: process.argv[1],
  execPath: process.execPath,
  platform: process.platform
});
async function loadPlaywright(environment = defaultEnvironment(), importDefault = () => import("playwright")) {
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
      const load = createRequire(path.join(root, "noop.js"));
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

// src/infra/capture.ts
var dependencies = {
  createTemp: () => fs.mkdtemp(path2.join(os.tmpdir(), "forge-capture-")),
  async launch() {
    const { chromium } = (await loadPlaywright()).module;
    return chromium.launch({
      headless: true,
      executablePath: process.env.FORGE_CHROMIUM_PATH,
      args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader"]
    });
  }
};
async function withCaptureSession(html, options, action, ports = dependencies) {
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
      () => window.forgeReady || window.forgeError,
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
      await fs.rm(temp, { recursive: true, force: true });
    }
  }
}

// src/infra/files.ts
import { promises as fs2, createReadStream } from "node:fs";
import path3 from "node:path";
import { randomUUID } from "node:crypto";
async function readJson(file) {
  try {
    const chunks = [];
    let bytes = 0;
    for await (const chunk of createReadStream(file)) {
      bytes += chunk.length;
      if (bytes > 16 * 1024 * 1024) fail("INPUT_TOO_LARGE", `JSON file exceeds 16 MiB: ${file}`);
      chunks.push(chunk);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch (error) {
    if (error instanceof ForgeError) throw error;
    if (errorCode(error) === "ENOENT") fail("NOT_FOUND", `File does not exist: ${file}`);
    fail("JSON_READ_FAILED", `Cannot read JSON file ${file}.`, { reason: errorMessage(error) });
  }
}
async function atomicWrite(file, data) {
  await fs2.mkdir(path3.dirname(file), { recursive: true });
  const tmp = `${file}.${randomUUID()}.tmp`;
  try {
    await fs2.writeFile(tmp, data, { flag: "wx" });
    await fs2.rename(tmp, file);
  } finally {
    await fs2.rm(tmp, { force: true });
  }
}
var writeJson = (file, value) => atomicWrite(file, JSON.stringify(value, null, 2) + "\n");
async function inside(root, relative) {
  const candidate = path3.resolve(root, relative);
  const rel = path3.relative(root, candidate);
  if (path3.isAbsolute(relative) || rel.startsWith("..") || path3.isAbsolute(rel))
    fail("INVALID_PATH", `Project path escapes the project: ${relative}`);
  let ancestor = candidate;
  let actual;
  while (true) {
    try {
      actual = await fs2.realpath(ancestor);
      break;
    } catch (error) {
      if (errorCode(error) !== "ENOENT") throw error;
      const parent = path3.dirname(ancestor);
      if (parent === ancestor) throw error;
      ancestor = parent;
    }
  }
  const resolved = path3.resolve(actual, path3.relative(ancestor, candidate));
  if (path3.relative(root, resolved).startsWith(".."))
    fail("INVALID_PATH", `Project path resolves outside the project: ${relative}`);
  return candidate;
}
async function findProject(start) {
  let current = await fs2.realpath(path3.resolve(start)).catch(() => fail("PROJECT_NOT_FOUND", `Directory ${start} does not exist.`));
  while (true) {
    try {
      await fs2.access(path3.join(current, "forge.project.json"));
      return current;
    } catch {
    }
    const parent = path3.dirname(current);
    if (parent === current)
      fail(
        "PROJECT_NOT_FOUND",
        "No forge.project.json found. Run init <directory> to create a project."
      );
    current = parent;
  }
}
async function withLock(root, action) {
  const lock = path3.join(root, ".forge.lock");
  let handle;
  try {
    handle = await fs2.open(lock, "wx");
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
      await fs2.rm(lock, { force: true });
    }
  }
}

// src/infra/assets.ts
import { promises as fs3 } from "node:fs";
import { fileURLToPath } from "node:url";

// src/infra/embedded-assets.ts
var embeddedAssets = void 0;

// src/infra/assets.ts
function candidates(name) {
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
  for (const file of candidates(name)) {
    try {
      return await fs3.readFile(file, "utf8");
    } catch (error) {
      if (!["ENOENT", "ENOTDIR"].includes(errorCode(error) ?? "")) throw error;
    }
  }
  return fail("BUILD_REQUIRED", `Packaged asset ${name} is missing. Run npm run build.`);
}

// src/infra/preview.ts
import path4 from "node:path";

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
    await atomicWrite(path4.resolve(output), bytes);
    return {
      path: path4.resolve(output),
      width: options.width,
      height: options.height,
      view: options.view,
      camera
    };
  });
}

// src/infra/project.ts
import { promises as fs4 } from "node:fs";
import path5 from "node:path";

// src/application/edit.ts
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

// src/infra/project.ts
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
  return parse(ProjectSchema, await readJson(path5.join(root, "forge.project.json")));
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
  const root = path5.resolve(directory);
  await fs4.mkdir(root, { recursive: true });
  return withLock(root, async () => {
    const manifestPath = path5.join(root, "forge.project.json");
    for (const file of [manifestPath, path5.join(root, "scenes/main.scene.json")]) {
      try {
        await fs4.access(file);
        fail("ALREADY_EXISTS", `Initialization would overwrite ${file}. Choose a new directory.`);
      } catch (error) {
        if (errorCode(error) !== "ENOENT") throw error;
      }
    }
    const manifest = {
      schemaVersion: 1,
      name: name ?? path5.basename(root),
      activeScene: "main",
      scenes: { main: "scenes/main.scene.json" },
      models: {}
    };
    parse(ProjectSchema, manifest);
    await writeJson(path5.join(root, "scenes/main.scene.json"), newScene("main", "Main scene"));
    await fs4.mkdir(path5.join(root, "models"), { recursive: true });
    await fs4.mkdir(path5.join(root, "exports"), { recursive: true });
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
      await fs4.access(path5.join(root, relative));
      fail("ALREADY_EXISTS", `Unregistered scene file ${relative} already exists.`);
    } catch (error) {
      if (errorCode(error) !== "ENOENT") throw error;
    }
    await writeJson(await inside(root, relative), newScene(id, name));
    manifest.scenes[id] = relative;
    await writeJson(path5.join(root, "forge.project.json"), manifest);
    return { id, path: relative };
  });
}
async function useScene(start, id) {
  const root = await findProject(start);
  return withLock(root, async () => {
    const manifest = await readManifest(root);
    if (!Object.hasOwn(manifest.scenes, id)) fail("NOT_FOUND", `Scene ${id} does not exist.`);
    manifest.activeScene = id;
    await writeJson(path5.join(root, "forge.project.json"), manifest);
    return { activeScene: id };
  });
}
async function commitOperations(start, sceneId, ops, options = {}) {
  const root = await findProject(start);
  return withLock(root, async () => {
    const snapshot = await loadUnlocked(root, sceneId);
    const { next, result } = prepareSceneEdit(snapshot, ops, options, stateHash);
    if (result.changed && !options.dryRun) {
      const { scene, manifest } = snapshot;
      await writeJson(await inside(root, `history/${scene.id}/${scene.revision}.json`), scene);
      await writeJson(await inside(root, manifest.scenes[scene.id]), next);
    }
    return result;
  });
}
async function importModel(start, input, replace = false, options = {}) {
  const data = input && typeof input === "object" && "kind" in input && input.kind === "model-bundle" ? parse(ModelBundleSchema, input) : (() => {
    const m = parse(ModelSchema, input);
    return { entry: m.id, models: { [m.id]: m } };
  })();
  if (!Object.hasOwn(data.models, data.entry))
    fail("REFERENCE_MISSING", "Bundle entry model is missing.");
  const root = await findProject(start);
  return withLock(root, async () => {
    const snapshot = await loadUnlocked(root);
    checkGuards(snapshot, options);
    return registerModels(root, data.models, data.entry, replace, snapshot, options.dryRun);
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
      previous = await fs4.readFile(file);
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
    await writeJson(path5.join(root, "forge.project.json"), manifest);
  } catch (error) {
    for (const write of writes) {
      if (write.previous) await atomicWrite(write.file, write.previous);
      else await fs4.rm(write.file, { force: true });
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
      await fs4.access(file);
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
    await writeJson(path5.join(root, "forge.project.json"), snapshot.manifest);
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

// src/application/camera.ts
import { Box3 as Box36, Vector3 as Vector39, PerspectiveCamera, OrthographicCamera, MathUtils as MathUtils4 } from "three";
function fitCamera(box, aspect, request, authored) {
  if (request.fixed) {
    const c = request.fixed;
    const camera2 = c.projection === "perspective" ? new PerspectiveCamera(c.fov, c.aspect, c.near, c.far) : new OrthographicCamera(c.left, c.right, c.top, c.bottom, c.near, c.far);
    camera2.position.fromArray(c.position);
    camera2.up.fromArray(c.up);
    camera2.zoom = c.zoom;
    const target2 = new Vector39().fromArray(c.target);
    camera2.lookAt(target2);
    camera2.updateProjectionMatrix();
    camera2.updateMatrixWorld(true);
    return { camera: camera2, target: target2 };
  }
  if (box.isEmpty()) box = new Box36(new Vector39(-0.5, -0.5, -0.5), new Vector39(0.5, 0.5, 0.5));
  const center = box.getCenter(new Vector39()), size = box.getSize(new Vector39());
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
  const direction = request.view === "orbit" ? new Vector39(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e)) : new Vector39(
    ...directions[request.view] ?? directions.iso
  ).normalize();
  const worldUp = Math.abs(direction.y) > 0.999 ? new Vector39(0, 0, direction.y > 0 ? -1 : 1) : new Vector39(0, 1, 0);
  const right = new Vector39().crossVectors(worldUp, direction).normalize(), up = new Vector39().crossVectors(direction, right);
  const corners = [];
  for (const x of [-0.5, 0.5])
    for (const y of [-0.5, 0.5])
      for (const z4 of [-0.5, 0.5]) corners.push(new Vector39(size.x * x, size.y * y, size.z * z4));
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

// src/infra/review.ts
import { promises as fs5 } from "node:fs";
import path6 from "node:path";
import { createHash as createHash2 } from "node:crypto";
import { REVISION } from "three";
async function reviewScene(scene, models, output, input, options = {}) {
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
  const destination = path6.resolve(output);
  const exists2 = await fs5.readdir(destination).catch((error) => {
    if (errorCode(error) === "ENOENT") return [];
    throw error;
  });
  if (exists2.length && !options.overwrite)
    fail(
      "ALREADY_EXISTS",
      "Review directory is not empty. Choose a new directory or pass --overwrite."
    );
  const started = Date.now();
  const html = await createPreview(scene, models, {
    editable: false,
    includeLibrary: false,
    stateHash: options.sourceStateHash
  });
  return withCaptureSession(html, plan, async ({ temp, browser, page, capture }) => {
    const stats = await page.evaluate(() => window.forgeViewer.stats);
    const frames = [];
    for (const frame of plan.frames) {
      const { bytes, camera } = await capture(frame.camera, plan.grid, plan.wireframe);
      await fs5.writeFile(path6.join(temp, `${frame.id}.png`), bytes);
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
          url: "data:image/png;base64," + (await fs5.readFile(path6.join(temp, f.file))).toString("base64")
        }))
      );
      const result = await page.evaluate(
        async ({ images: images2, width, height }) => {
          const scale = Math.min(1, 640 / width, 480 / height), cellWidth = Math.max(1, Math.round(width * scale)), cellHeight = Math.max(1, Math.round(height * scale)), columns = Math.min(3, Math.ceil(Math.sqrt(images2.length))), rows = Math.ceil(images2.length / columns), label = 32;
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
          return { url: canvas.toDataURL("image/png"), width: canvas.width, height: canvas.height };
        },
        { images, width: plan.width, height: plan.height }
      );
      await fs5.writeFile(
        path6.join(temp, "contact-sheet.png"),
        Buffer.from(result.url.split(",")[1], "base64")
      );
      contactSheet = { file: "contact-sheet.png", width: result.width, height: result.height };
    }
    const manifest = {
      schemaVersion: 1,
      kind: "review-result",
      provenance: {
        tool: "scene-forge",
        version: VERSION,
        three: REVISION,
        node: process.version,
        platform: process.platform,
        arch: process.arch,
        chromium: browser.version(),
        rendererRequested: "ANGLE SwiftShader",
        documentTransport: "inline-html"
      },
      scene: scene.id,
      revision: scene.revision,
      sourceStateHash: options.sourceStateHash ?? originalStateHash,
      renderStateHash: stateHash(scene, models),
      target: options.target ?? { scene: scene.id },
      plan,
      stats,
      frames,
      contactSheet,
      replayPlan: "replay-plan.json",
      durationMs: Date.now() - started
    };
    const replay = parse(ReviewPlanSchema, {
      ...plan,
      background: scene.environment.background,
      frames: frames.map((f) => ({ id: f.id, camera: { fixed: f.camera } }))
    });
    await fs5.mkdir(destination, { recursive: true });
    for (const name of [...frames.map((f) => f.file), ...contactSheet ? [contactSheet.file] : []])
      await atomicWrite(path6.join(destination, name), await fs5.readFile(path6.join(temp, name)));
    await writeJson(path6.join(destination, "replay-plan.json"), replay);
    await writeJson(path6.join(destination, "review.json"), manifest);
    return {
      directory: destination,
      manifest: path6.join(destination, "review.json"),
      replayPlan: path6.join(destination, "replay-plan.json"),
      contactSheet: contactSheet ? path6.join(destination, contactSheet.file) : void 0,
      frames: frames.map((f) => ({ ...f, path: path6.join(destination, f.file) })),
      stats,
      durationMs: manifest.durationMs,
      sourceStateHash: manifest.sourceStateHash
    };
  });
}

// src/infra/bundle.ts
import { promises as fs6 } from "node:fs";
import path7 from "node:path";
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
  const root = path7.resolve(directory);
  await fs6.mkdir(path7.dirname(root), { recursive: true });
  try {
    await fs6.mkdir(root);
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
      const file = path7.join(root, relative);
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
    for (const file of files) await fs6.rm(file, { force: true });
    for (const relative of ["scenes", "models", ""])
      await fs6.rmdir(path7.join(root, relative)).catch(() => {
      });
    throw error;
  }
}

// src/commands/rigging.ts
import { Mesh as Mesh6 } from "three";
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
        if (child instanceof Mesh6) meshes.push(child.name.slice(object.name.length + 1));
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
import { z as z2 } from "zod";
var Entry = z2.object({
  id: Id,
  name: z2.string(),
  description: z2.string(),
  features: z2.array(z2.string()),
  models: z2.array(Id),
  stats: z2.unknown()
}).strict();
async function exampleData(name) {
  return JSON.parse(await readAsset(`examples/${name}`));
}
var listExamples = async () => parse(z2.array(Entry), await exampleData("index.json"));
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
import { Command as Command2, CommanderError as CommanderError2 } from "commander";
import path11 from "node:path";

// src/commands/errors.ts
import { CommanderError } from "commander";
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
        hint: {
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
          EMPTY_SELECTION: "Run node list with the same filters and check the IDs/tags."
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
import { z as z3 } from "zod";
import path8 from "node:path";
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
    for await (const chunk of runtime.stdin) {
      bytes += chunk.length;
      if (bytes > 16 * 1024 * 1024) fail("INPUT_TOO_LARGE", "Input exceeds 16 MiB.");
      chunks.push(Buffer.from(chunk));
    }
    return parseJson(Buffer.concat(chunks).toString("utf8"));
  }
  return readJson(path8.resolve(runtime.cwd, options.file));
}
var parseParameters = (value) => parse(z3.record(Id, NumberValue), parseJson(value));

// src/commands/discovery.ts
import { Option } from "commander";

// src/application/littlewild.ts
import * as THREE9 from "three";
var littlewildLimits = {
  meshVertices: 8192,
  meshTriangles: 16384,
  definitionVertices: 4e4
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
  const shape = new THREE9.Shape();
  shape.moveTo(-0.5, 0);
  shape.lineTo(0.5, 0);
  shape.lineTo(0, 0.62);
  shape.closePath();
  const geometry = new THREE9.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false });
  geometry.translate(0, 0, -0.5);
  return geometry;
}
function primitiveGeometry(kind) {
  switch (kind) {
    case "ball":
      return new THREE9.IcosahedronGeometry(1, 0);
    case "tiny":
      return new THREE9.SphereGeometry(1, 6, 4);
    case "soft":
      return new THREE9.SphereGeometry(1, 10, 7);
    case "cone":
      return new THREE9.ConeGeometry(1, 1, 7);
    case "cylinder":
      return new THREE9.CylinderGeometry(1, 1, 1, 8);
    case "ring":
      return new THREE9.TorusGeometry(1, 0.07, 4, 16);
    case "roof":
      return roofGeometry();
    case "ground": {
      const g = new THREE9.BufferGeometry();
      g.setAttribute(
        "position",
        new THREE9.Float32BufferAttribute(
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
var nativeCounts = /* @__PURE__ */ new Map();
function nativePrimitive(object) {
  const kind = /^lw-(ball|soft|tiny|cone|cylinder|ring|roof|ground)$/.exec(
    String(object.userData.geometry ?? "")
  )?.[1];
  if (!kind) return null;
  if (!nativeCounts.has(kind)) {
    const g = primitiveGeometry(kind);
    nativeCounts.set(kind, g.getAttribute("position").count);
    g.dispose();
  }
  return object.geometry.getAttribute("position").count === nativeCounts.get(kind) ? kind : null;
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
function materialData(material) {
  const m = material;
  const result = {
    color: `#${m.color.getHexString()}`,
    roughness: round(m.roughness ?? 1, 1e-3),
    metalness: round(m.metalness ?? 0, 1e-3),
    flatShading: !!m.flatShading
  };
  if (material instanceof THREE9.MeshPhysicalMaterial) {
    result.sheen = round(material.sheen, 1e-3);
    result.sheenColor = `#${material.sheenColor.getHexString()}`;
    result.sheenRoughness = round(material.sheenRoughness, 1e-3);
    result.clearcoat = round(material.clearcoat, 1e-3);
    result.clearcoatRoughness = round(material.clearcoatRoughness, 1e-3);
  }
  if (m.emissive && m.emissive.getHex() !== 0) {
    result.emissive = `#${m.emissive.getHexString()}`;
    result.emissiveIntensity = round(m.emissiveIntensity ?? 1, 1e-3);
  }
  if (material.side === THREE9.DoubleSide) result.doubleSided = true;
  if (!material.depthWrite) result.depthWrite = false;
  if (material.opacity < 1) {
    result.opacity = round(material.opacity, 1e-3);
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
  if (geometry.index) result.indices = Array.from(geometry.index.array);
  return result;
}
function boxSize(geometry) {
  const position = geometry.getAttribute("position");
  if (!position || position.count !== 24 || geometry.index?.count !== 36) return null;
  geometry.computeBoundingBox();
  const box = geometry.boundingBox, size = box.getSize(new THREE9.Vector3()).toArray(), center = box.getCenter(new THREE9.Vector3()).toArray();
  if (center.some((v) => Math.abs(v) > 1e-6) || size.some((v) => v <= 0)) return null;
  for (let i = 0; i < 24; i++)
    for (let axis = 0; axis < 3; axis++)
      if (Math.abs(Math.abs(position.getComponent(i, axis)) - size[axis] / 2) > 1e-6) return null;
  return size;
}
function littlewildModel(root, options) {
  const materials = {}, materialRoles = /* @__PURE__ */ new Map(), meshes = {}, meshIds = /* @__PURE__ */ new Map(), ids = /* @__PURE__ */ new Set(), rig = {}, warnings = /* @__PURE__ */ new Set(), stats = { nodes: 0, meshes: 0, primitives: 0, vertices: 0, triangles: 0 };
  const roles = new Set(littlewildPetRoles);
  function role(material) {
    if (Array.isArray(material))
      fail("LITTLEWILD_EXPORT", "Multi-material meshes are unsupported.");
    const known = materialRoles.get(material);
    if (known) return known;
    if (material.type === "MeshBasicMaterial")
      warnings.add("Unlit materials are exported as standard Littlewild materials.");
    const data = materialData(material), base = (material.name.split("/").pop() || "material").slice(0, 72);
    let name = base;
    for (let n = 2; materials[name] && JSON.stringify(materials[name]) !== JSON.stringify(data); n++)
      name = `${base}-${n}`;
    materials[name] = data;
    materialRoles.set(material, name);
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
    if (object instanceof THREE9.Light) {
      warnings.add("Lights are not part of Littlewild assets and were skipped.");
      return null;
    }
    const id = nodeId(object, parentId), node = { primitive: "group", id };
    stats.nodes++;
    transform2(object, node);
    if (!object.visible) node.visible = false;
    if (object instanceof THREE9.Mesh) {
      const geometry = object.geometry, size = boxSize(geometry);
      node.material = role(object.material);
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
          meshId = `m-${hash(JSON.stringify(data))}`;
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
  const nodes = root.children.flatMap((child) => convert(child, "asset") ?? []);
  if (!stats.primitives && !stats.meshes)
    fail("LITTLEWILD_EXPORT", "The model has no visible geometry.");
  if (stats.vertices > littlewildLimits.definitionVertices)
    fail(
      "LITTLEWILD_BUDGET",
      `Model bakes ${stats.vertices} vertices; Littlewild allows ${littlewildLimits.definitionVertices}.`
    );
  return {
    nodes,
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
        "cylinder",
        "cone",
        "torus",
        "capsule",
        "plane",
        "lathe",
        "extrude",
        "mesh",
        "boolean",
        "tube"
      ],
      composition: [
        "model capture",
        "model bundle import/export",
        "scene compose",
        "scene clone",
        "node patch/transform/duplicate/group/reparent/ground/place",
        "offline composer with guarded edit download"
      ],
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
        families: Object.keys(littlewildFamilies),
        output: "<target>/<family>/<id>/definition.json visual facet; other facets are preserved",
        geometry: "boxes and unchanged lw-<primitive> geometries stay native; other meshes are baked",
        rig: "pets only: tag nodes rig:<role>",
        rigRoles: littlewildPetRoles,
        limits: littlewildLimits,
        check: "littlewild sync --check fails when a definition is stale"
      },
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
        "texture images and automatic UV unwrapping",
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
    await new Promise((resolve, reject) => {
      server.once("error", reject);
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
import { promises as fs7 } from "node:fs";
async function exists(file) {
  try {
    await fs7.access(file);
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
  const path12 = [prefix, command.name()].filter(Boolean).join(" ");
  return {
    command: path12,
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
    subcommands: command.commands.map((c) => commandDescription(c, path12))
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
    const s = await snapshot(), nodes = inspectNodes(s.scene, s.models, selector(opts), !!opts.details);
    output({
      scene: s.scene.id,
      revision: s.scene.revision,
      stateHash: s.stateHash,
      total: nodes.length,
      offset: opts.offset,
      nodes: nodes.slice(opts.offset, opts.offset + opts.limit),
      nextOffset: opts.offset + opts.limit < nodes.length ? opts.offset + opts.limit : null
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
import path10 from "node:path";
import { Option as Option5 } from "commander";

// src/infra/littlewild.ts
import path9 from "node:path";
import { promises as fs8 } from "node:fs";
var plain = (value) => !!value && typeof value === "object" && !Array.isArray(value);
function definitionText(value) {
  return JSON.stringify(value, null, 2).replace(
    /\[\s+(-?[\d.e+-]+(?:,\s+-?[\d.e+-]+)*)\s+\]/g,
    (_, body) => `[${String(body).replace(/,\s+/g, ", ")}]`
  ) + "\n";
}
function renameMaterials(nodes, names) {
  for (const node of nodes) {
    if (node.material && names.has(node.material)) node.material = names.get(node.material);
    if (node.children) renameMaterials(node.children, names);
  }
}
function collect(nodes, key, into) {
  for (const node of nodes) {
    if (!plain(node)) continue;
    if (typeof node[key] === "string") into.add(node[key]);
    if (Array.isArray(node.children)) collect(node.children, key, into);
  }
  return into;
}
function littlewildVisual(asset, models, existing) {
  const category = littlewildFamilies[asset.family], previous = plain(existing?.visual) ? existing.visual : {}, previousModels = plain(previous.models) ? previous.models : {}, previousMaterials = plain(previous.materials) ? previous.materials : {}, previousMeshes = plain(previous.meshes) ? previous.meshes : {};
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
      const result = littlewildModel(root, { rig: asset.family === "pets" });
      const names = /* @__PURE__ */ new Map();
      for (const [role, data] of Object.entries(result.materials)) {
        let name = role;
        if (materials[name] && JSON.stringify(materials[name]) !== JSON.stringify(data))
          name = `${role}-${variant}`.slice(0, 80);
        materials[name] = data;
        if (name !== role) names.set(role, name);
      }
      renameMaterials(result.nodes, names);
      Object.assign(meshes, result.meshes);
      exported[variant] = { nodes: result.nodes };
      if (Object.keys(result.rig).length) rig[variant] = result.rig;
      result.warnings.forEach((w) => warnings.add(w));
      report.push({ variant, model: spec.model, ...result.stats });
    } finally {
      built.dispose();
    }
  }
  const finalModels = { ...previousModels, ...exported };
  for (const [name, model] of Object.entries(previousModels)) {
    if (Object.hasOwn(exported, name) || !plain(model) || !Array.isArray(model.nodes)) continue;
    for (const role of collect(model.nodes, "material", /* @__PURE__ */ new Set()))
      if (Object.hasOwn(previousMaterials, role)) {
        if (materials[role] && JSON.stringify(materials[role]) !== JSON.stringify(previousMaterials[role]))
          warnings.add(`Retained variant ${name} now uses the re-exported material ${role}.`);
        else materials[role] ??= previousMaterials[role];
      }
    for (const id of collect(model.nodes, "mesh", /* @__PURE__ */ new Set()))
      if (Object.hasOwn(previousMeshes, id)) meshes[id] ??= previousMeshes[id];
  }
  const vertices = Object.values(meshes).reduce(
    (sum, mesh) => sum + (plain(mesh) && Array.isArray(mesh.positions) ? mesh.positions.length / 3 : 0),
    0
  );
  if (vertices > littlewildLimits.definitionVertices)
    fail(
      "LITTLEWILD_BUDGET",
      `${asset.id} bakes ${vertices} vertices; Littlewild allows ${littlewildLimits.definitionVertices}.`
    );
  const previousRig = asset.family === "pets" && plain(previous.rig) ? previous.rig : {};
  const finalRig = asset.family === "pets" ? Object.fromEntries(
    Object.entries({ ...previousRig, ...rig }).filter(
      ([name]) => Object.hasOwn(finalModels, name) && (Object.hasOwn(rig, name) || !Object.hasOwn(exported, name))
    )
  ) : previous.rig;
  const metadata = {
    ...plain(previous.metadata) ? previous.metadata : {},
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
    ...finalRig === void 0 || plain(finalRig) && !Object.keys(finalRig).length ? {} : { rig: finalRig },
    ...Object.keys(meshes).length ? { meshes } : {}
  };
  return { visual, report, warnings: [...warnings] };
}
async function readDefinition(file) {
  try {
    await fs8.access(file);
  } catch (error) {
    if (errorCode(error) === "ENOENT") return void 0;
    throw error;
  }
  const value = await readJson(file);
  if (!plain(value)) fail("LITTLEWILD_EXPORT", `${file} is not a Littlewild definition.`);
  return value;
}
async function writeLittlewildAsset(asset, models, file, options = {}) {
  const existing = await readDefinition(file);
  if (existing && (existing.format !== "littlewild-definition" || existing.family !== asset.family || existing.id !== asset.id))
    fail(
      "LITTLEWILD_EXPORT",
      `${file} belongs to ${String(existing.family)}/${String(existing.id)}, not ${asset.family}/${asset.id}.`
    );
  if (path9.basename(path9.dirname(file)) !== asset.id || path9.basename(path9.dirname(path9.dirname(file))) !== asset.family)
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
  const text = definitionText(definition);
  let previousText;
  try {
    previousText = await fs8.readFile(file, "utf8");
  } catch {
    previousText = void 0;
  }
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

// src/application/littlewild-import.ts
import * as THREE10 from "three";

// src/application/littlewild-materials.ts
var plain2 = (value) => !!value && typeof value === "object" && !Array.isArray(value);
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
    if (props !== void 0 && !plain2(props))
      fail("LITTLEWILD_IMPORT", `Node ${nodeId} materialProps must be an object.`);
    const data = {
      ...typeof base === "string" ? { color: base } : plain2(base) ? base : {},
      ...plain2(props) ? props : {}
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
    const material = {
      roughness: 0.98,
      metalness: 0,
      opacity: 1,
      flatShading: !mesh,
      ...mapped
    };
    const key = canonical([role, material]);
    const found = byValue.get(key);
    if (found) return found;
    const stem = (Object.hasOwn(materials, role) ? role : `c${role.replace("#", "")}`).replace(
      /[^A-Za-z0-9_-]/g,
      "-"
    );
    const prefix = /^[A-Za-z]/.test(stem) ? stem : `m${stem}`;
    const hasOverride = plain2(props) && Object.keys(props).length > 0;
    let id = `${prefix.slice(0, hasOverride ? 32 : 64)}${hasOverride ? `-${nodeId.slice(0, 30)}` : ""}`;
    const start = id;
    let collision = 1;
    while (Object.hasOwn(used, id)) id = `${start.slice(0, 55)}-${collision++}`;
    used[id] = material;
    byValue.set(key, id);
    return id;
  };
}

// src/application/littlewild-import.ts
var plain3 = (value) => !!value && typeof value === "object" && !Array.isArray(value);
var degrees = (value) => Number(THREE10.MathUtils.radToDeg(value).toFixed(4));
var triples = (values, step) => {
  const out = [];
  for (let i = 0; i < values.length; i += 3)
    out.push([0, 1, 2].map((k) => Number((Math.round(values[i + k] / step) * step).toFixed(5))));
  return out;
};
function bake(geometry) {
  const indexed = geometry.index ? geometry : geometry.toNonIndexed();
  const position = indexed.getAttribute("position"), normal = indexed.getAttribute("normal");
  const indices = indexed.index ? Array.from(indexed.index.array) : Array.from({ length: position.count }, (_, i) => i);
  return {
    type: "mesh",
    positions: triples(position.array, 1e-5),
    indices,
    ...normal ? { normals: triples(normal.array, 1e-4) } : {}
  };
}
function forgeId(value, fallback) {
  const id = value.replace(/[^A-Za-z0-9_-]/g, "-").slice(0, 64);
  return /^[A-Za-z]/.test(id) ? id : `n${id}`.slice(0, 64) || fallback;
}
var camel = (value) => value.replace(/[-_]+([a-z0-9])/g, (_, c) => c.toUpperCase()).replace(/[^A-Za-z0-9]/g, "");
function littlewildModels(asset, prefix) {
  if (asset.format !== "littlewild-3d-asset" || asset.schemaVersion !== 1 || !plain3(asset.models))
    fail("LITTLEWILD_IMPORT", "Expected a littlewild-3d-asset visual definition.");
  const base = forgeId(prefix ?? camel(String(asset.id)), "littlewild"), meshes = plain3(asset.meshes) ? asset.meshes : {}, materials = plain3(asset.materials) ? asset.materials : {}, rig = asset.category === "pet" && plain3(asset.rig) ? asset.rig : {};
  const roles = new Set(littlewildPetRoles);
  const models = {};
  for (const [variant, model] of Object.entries(asset.models)) {
    if (!plain3(model) || !Array.isArray(model.nodes))
      fail("LITTLEWILD_IMPORT", `Variant ${variant} has no nodes.`);
    const suffix = camel(`-${variant}`);
    const id = `${base.slice(0, Math.max(1, 64 - suffix.length))}${suffix}`.slice(0, 64);
    if (Object.hasOwn(models, id))
      fail(
        "LITTLEWILD_IMPORT",
        `Variants collide at model ID ${id}. Choose distinct variant names or a shorter prefix.`
      );
    const geometries = { box: { type: "box", size: [1, 1, 1] } }, usedMaterials = {}, nodes = [], ids = /* @__PURE__ */ new Set(), tags = /* @__PURE__ */ new Map();
    for (const [role, refs] of Object.entries(plain3(rig[variant]) ? rig[variant] : {}))
      if (roles.has(role))
        for (const ref of Array.isArray(refs) ? refs : [refs])
          tags.set(String(ref), [...tags.get(String(ref)) ?? [], `rig:${role}`]);
    const resolveMaterial = importedMaterials(materials, usedMaterials);
    let counter = 0;
    const visit = (input, parent) => {
      if (!plain3(input)) return;
      const primitive = String(input.primitive), lwId = typeof input.id === "string" ? input.id : void 0;
      let nodeId = forgeId(lwId ?? `${primitive}${++counter}`, `node${++counter}`);
      while (ids.has(nodeId)) nodeId = `${nodeId.slice(0, 58)}${++counter}`;
      ids.add(nodeId);
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
            if (!plain3(data) || !Array.isArray(data.positions))
              fail("LITTLEWILD_IMPORT", `Missing mesh ${String(input.mesh)}.`);
            const positions = data.positions;
            geometries[geometryId] = {
              type: "mesh",
              positions: triples(positions, 1e-5),
              indices: Array.isArray(data.indices) ? data.indices : Array.from({ length: positions.length / 3 }, (_, i) => i),
              ...Array.isArray(data.normals) ? { normals: triples(data.normals, 1e-4) } : {}
            };
          } else geometries[geometryId] = bake(primitiveGeometry(primitive));
        }
        const role = String(input.material);
        const materialId = resolveMaterial(role, input.materialProps, nodeId, primitive === "mesh");
        Object.assign(node, { geometry: geometryId, material: materialId });
      }
      nodes.push(node);
      for (const child of Array.isArray(input.children) ? input.children : []) visit(child, nodeId);
    };
    for (const node of model.nodes) visit(node);
    if (!Object.values(usedMaterials).length)
      fail("LITTLEWILD_IMPORT", `Variant ${variant} has no geometry.`);
    const used = new Set(nodes.map((n) => n.geometry).filter(Boolean));
    models[id] = {
      schemaVersion: 1,
      kind: "model",
      id,
      name: `${String(asset.name)} (${variant})`.slice(0, 120),
      category: `littlewild-${String(asset.category)}`,
      description: `Imported from Littlewild ${String(asset.category)}:${String(asset.id)}/${variant}.`,
      geometries: Object.fromEntries(Object.entries(geometries).filter(([k]) => used.has(k))),
      materials: usedMaterials,
      nodes
    };
  }
  return models;
}

// src/infra/littlewild-import.ts
async function importLittlewildDefinition(project, file, options) {
  const input = await readJson(file);
  const record = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const isPackage = record.format === "littlewild-creature-package";
  if (isPackage && record.schemaVersion !== 1)
    fail("LITTLEWILD_IMPORT", "Expected a version 1 littlewild-creature-package.");
  const visual = isPackage ? record.appearanceManifest : record.format === "littlewild-definition" ? record.visual : record;
  if (!visual || typeof visual !== "object" || Array.isArray(visual))
    fail("LITTLEWILD_IMPORT", `${file} has no visual facet to import.`);
  const models = littlewildModels(visual, options.prefix);
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
    const file = resolvePath(opts.file), manifest = parse(LittlewildExportSchema, await readJson(file)), target = path10.resolve(path10.dirname(file), manifest.target), s = await snapshot();
    const assets = manifest.assets.filter((a) => !opts.asset || a.id === opts.asset);
    if (!assets.length) fail("NOT_FOUND", `Asset ${opts.asset} is not in the manifest.`);
    const results = [];
    for (const asset of assets)
      results.push(
        await writeLittlewildAsset(
          asset,
          s.models,
          path10.join(target, asset.family, asset.id, "definition.json"),
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
    new Option5("--family <family>").choices(["items", "buildings", "creatures", "pets"]).default("items")
  ).option("--variant <name>", "Littlewild model variant", "world").option("--name <name>", "Display name; defaults to the model name").option("--parameters <json>", "Model parameter overrides").option("--materials <json>", "Inline material replacements keyed by model material ID").option("--dry-run", "Compile and compare without writing").action(async (opts) => {
    const s = await snapshot(), out = resolvePath(opts.out), model = s.models[opts.model];
    if (!model) fail("NOT_FOUND", `Model ${opts.model} does not exist.`);
    const asset = parse(LittlewildAssetSchema, {
      id: path10.basename(path10.dirname(out)),
      family: opts.family,
      name: opts.name ?? model.name,
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
  editOptions2(group.command("import")).description("Import Littlewild definition or creature package visuals as editable models").requiredOption(
    "--definition <path>",
    "Littlewild definition, creature package or 3D asset JSON"
  ).option("--prefix <id>", "Model ID prefix; defaults to the camel-cased asset ID").option("--replace", "Replace existing models with the same IDs").action(async (opts) => {
    output(
      await importLittlewildDefinition(global().project, resolvePath(opts.definition), {
        prefix: opts.prefix,
        dryRun: opts.dryRun,
        replace: opts.replace,
        expectedRevision: opts.expectedRevision,
        expectedState: opts.expectedState
      })
    );
  });
}

// src/commands/create-cli.ts
function createCli(overrides = {}, identity = { name: "forge3d" }) {
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
  const program = new Command2().name(identity.name).description("Data-driven 3D modeling for agents. JSON in, reproducible geometry out.").version(VERSION).option(
    "-p, --project <directory>",
    "Project directory; otherwise find the nearest project",
    runtime.cwd
  ).option("-s, --scene <id>", "Scene to use; otherwise use activeScene").option("--compact", "Write compact JSON for smaller agent responses").showHelpAfterError(false).exitOverride().configureOutput({ writeOut: runtime.writeOut, writeErr: () => {
  } });
  if (identity.helpFooter) program.addHelpText("after", identity.helpFooter);
  const resolvePath = (value) => path11.resolve(runtime.cwd, value);
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
  BatchSchema,
  CameraRequestSchema,
  CameraSchema,
  CameraSnapshotSchema,
  CompositionSchema,
  EnvironmentSchema,
  ForgeError,
  GeometrySchema,
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
  PatternSchema,
  ProjectSchema,
  QualityPolicySchema,
  ReviewPlanSchema,
  RigSchema,
  Scalar,
  SceneBundleSchema,
  SceneSchema,
  SelectorSchema,
  Transform,
  Vec3,
  applyOperations,
  applySpatialOperation,
  atomicWrite,
  auditScene,
  authoringTarget,
  bindRig,
  cameraData,
  captureModel,
  captureProjectModel,
  cloneScene,
  commitOperations,
  compileScene,
  createCli,
  createExample,
  createPreview,
  createProjectPreview,
  createScene,
  exampleBundle,
  exportFormats,
  exportScene,
  expressionOperators,
  fail,
  findProject,
  fitCamera,
  importModel,
  initProject,
  inspectNodes,
  jsonSchema,
  listExamples,
  littlewildFamilies,
  loadProject,
  loadProjectScenes,
  matrixTransform,
  modelDependencies,
  modelParameters,
  newScene,
  nodeById,
  packScene,
  parse,
  prepareSceneEdit,
  readJson,
  resolveData,
  restoreScene,
  reviewScene,
  rigClips,
  scalar,
  sceneChanges,
  schemaKinds,
  schemas,
  screenshot,
  selectNodes,
  stateHash,
  subtreeIds,
  unpackScene,
  useScene,
  validateDocument,
  validateExport,
  validateRig,
  viewNames,
  withLock,
  writeJson
};
//# sourceMappingURL=index.js.map
