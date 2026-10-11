// Shared value contracts: stable identifiers, bounded numbers, parametric scalar
// expressions, vectors, colors and node transforms. Every other schema family builds
// on these; they carry no document or operation semantics of their own.
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
export const Vec2 = z.tuple([Scalar, Scalar]);
export const Color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
export const Transform = z
  .object({ position: Vec3.optional(), rotation: Vec3.optional(), scale: Vec3.optional() })
  .strict();

export type V3 = [ScalarValue, ScalarValue, ScalarValue];
export type V2 = [ScalarValue, ScalarValue];
export type TransformSpec = z.infer<typeof Transform>;
