import { z } from 'zod';
import { Id, NumberValue, Color } from './schema-values.js';

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
